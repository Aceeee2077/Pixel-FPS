import type { Game } from '../core/Game';
import { BUY_ITEMS } from '../game/round/BuySystem';
import { getWeapon } from '../data/weapons';
import { PRIMARY, WEAPONS, type WeaponId } from '../weapons/WeaponConfig';
import { KNIVES, RIFLE_SKINS, knifeInfo, weaponImage, weaponTitle, type KnifeStyle, type RifleSkin } from '../weapons/WeaponAppearance';
import { MAPS, RANDOM_MAP_ID, mapById, type MapDefinition } from '../world/Maps';
import { KNIFE_UNLOCKS, MAX_LEVEL, RIFLE_UNLOCKS, WEAPON_ORDER } from '../core/Progress';
import { finishName, getLang, knifeName, mapBlurb, mapTag, mapTheme, setLang, t, toggleLang, type Lang } from '../core/I18n';
import { EquipmentPages } from './EquipmentPages';
export type Screen = 'menu' | 'playing' | 'pause' | 'results' | 'quit';
const icon = '<svg viewBox="0 0 32 32"><path d="M5 5h15l7 7v7-0l-9 8H5V5zm7 6v5h9l-4-5h-5zm0 10v2h5l3-2h-8z" fill="currentColor"/></svg>';
export function gunIcon(id: string) {
    const body = id === 'sniper' ? '<path d="M66 38h74v10H66zM92 24h45v11H92zM145 45h86v5h-86zM98 51h17v24H98z"/>' : id === 'shotgun' ? '<path d="M66 40h140v12H66zM155 55h46v8h-46zM89 51l20 2-7 22H87z"/>' : id === 'smg' ? '<path d="M65 32h94v23H65zM159 40h39v9h-39zM112 55h14v32h-14zM82 55h15v22H82z"/>' : '<path d="M65 36h100v19H65zM165 41h54v8h-54zM103 55h21l-4 26h-17zM76 55h13v21H76zM90 29h47v7H90z"/>';
    return `<svg viewBox="0 0 240 100" aria-hidden="true"><g fill="currentColor">${body}<path d="M20 40l45-4v19H45L20 66z"/></g></svg>`;
}
export class UI {
    root = document.querySelector<HTMLElement>('#ui')!;
    screen: Screen = 'menu';
    dialog = '';
    lastUpdate = 0;
    hitUntil = 0;
    hitHead = false;
    hitBack = false;
    backstabUntil = 0;
    eliminationUntil = 0;
    damageUntil = 0;
    private captureUiMode = '';
    private knifeLabel = '';
    private earnedWeapon = '';
    private lastPreviewId: WeaponId = 'rifle';
    private equipment: EquipmentPages;
    constructor(public game: Game) {
        setLang(game.settings.data.lang);
        this.render();
        this.equipment = new EquipmentPages(game, this);
        // Listeners live on the stable #ui wrapper, so rebuilding the markup never loses them.
        this.root.addEventListener('click', e => { const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]'); if (target)
            this.action(target.dataset.action!); const langPick = (e.target as HTMLElement).closest<HTMLElement>('[data-lang]'); if (langPick) this.setLanguage(langPick.dataset.lang as Lang); const weapon = (e.target as HTMLElement).closest<HTMLElement>('[data-weapon]'); if (weapon) {
            this.game.settings.data.primary = weapon.dataset.weapon!;
            this.game.settings.save();
            this.loadout(weapon.dataset.weapon as WeaponId);
            this.menuLoadout();
        }
        const knife = (e.target as HTMLElement).closest<HTMLElement>('[data-knife]');
        const skin = (e.target as HTMLElement).closest<HTMLElement>('[data-rifle-skin]');
        const preview = (e.target as HTMLElement).closest<HTMLElement>('[data-preview]');
        const mapPick = (e.target as HTMLElement).closest<HTMLElement>('[data-map]');
        if (mapPick) {
            this.game.settings.data.map = mapPick.dataset.map!;
            this.game.settings.save();
            this.menuMaps();
        }
        else if (knife || skin) {
            if (knife) this.game.settings.data.knifeStyle = knife.dataset.knife as KnifeStyle;
            if (skin) this.game.settings.data.rifleSkin = skin.dataset.rifleSkin as RifleSkin;
            this.game.settings.save(); this.loadout(knife ? 'knife' : 'rifle'); this.menuLoadout();
            const selector=knife ? `[data-knife="${knife.dataset.knife}"]` : `[data-rifle-skin="${skin!.dataset.rifleSkin}"]`;
            this.root.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
        } else if (preview) this.loadout(preview.dataset.preview as WeaponId);
        });
        this.root.addEventListener('click', e => this.equipment.handleClick(e.target as HTMLElement));
        this.root.addEventListener('input', e => { const input = e.target as HTMLInputElement; const key = input.dataset.setting; if (!key) {
            this.equipment.handleInput(input); return;
        } const data = this.game.settings.data as unknown as Record<string, unknown>; data[key] = input.type === 'range' ? Number(input.value) : input.value; this.game.settings.save(); this.game.applySettings(); const out = document.querySelector(`#value-${key}`); if (out)
            out.textContent = key === 'volume' || key === 'sfx' ? Math.round(Number(input.value) * 100) + '%' : input.value; });
        this.root.addEventListener('change', e => {
            const select = e.target as HTMLSelectElement;
            if (select.dataset.catalogFilter !== undefined && this.equipment.filter !== select.value) this.equipment.handleInput(select);
        });
        this.menuLoadout();
    }
    /** Static markup, rebuilt on every language switch so all copy flows through `t()`. */
    private render() {
        const langChip = (code: Lang, text: string) => `<span class="${getLang() === code ? 'on' : ''}">${text}</span>`;
        this.root.innerHTML = `
      <main id="menu" class="menu screen">
        <header class="lobby-top"><a class="brand" href="#" aria-label="BlockStrike home">${icon}<span>BLOCK<span class="brand-light">STRIKE</span><small>${t('hero.brandTag')}</small></span></a><nav><span class="nav-active">${t('nav.play')}</span><button data-action="armory">${t('nav.armory')}</button><button data-action="loadout">${t('nav.loadout')}</button><button data-action="collection">${t('nav.collection')}</button><button data-action="settings">${t('nav.settings')}</button><button data-action="quit">${t('nav.quit')}</button><button class="lang-toggle" data-action="lang" aria-label="${t('lang.switch')}">${langChip('zh', '中文')}<i>·</i>${langChip('en', 'EN')}</button></nav><span class="build"><i></i> ${t('nav.localPlay')} <b>${t('nav.arenas')}</b></span></header>
        <div class="lobby-body">
          <section class="lobby-hero">
            <div class="eyebrow"><span class="tiny-block"></span> ${t('hero.eyebrow')}</div>
            <h1>${t('hero.title')}<br><span>${t('hero.titleAccent')}</span></h1>
            <p>${t('hero.copy')}<br>${t('hero.copy2')}</p>
            <div class="hero-tags"><span>${t('hero.tag.player')}</span><span>${t('hero.tag.bots')}</span><span>${t('hero.tag.maps')}</span><span>${t('hero.tag.levels')}</span></div>
            <div class="lobby-chips" id="menu-levels"></div>
            <button class="lobby-loadout" data-action="loadout"><span class="eyebrow">${t('hero.loadout')} <span>↗</span></span><div class="weapon-preview-icon" id="menu-gun"></div><div class="lobby-loadout-row"><strong id="menu-weapon">M4A4</strong><span>${t('hero.loadoutAction')}</span></div></button>
          </section>
          <section class="lobby-map">
            <div class="lobby-map-head"><span class="eyebrow">${t('map.select')}</span><b id="menu-map-name">BLOCKYARD</b><small id="menu-map-theme"></small></div>
            <div class="map-stage" id="menu-map-stage"></div>
            <div class="map-grid" id="menu-map-grid"></div>
          </section>
        </div>
        <footer class="lobby-foot">
          <button class="online-button" data-action="multiplayer">${t('net.title')} <span>↗</span></button>
          <button id="play" class="play-button" data-action="play"><span>${t('nav.play')}</span><span class="arrow">↗</span></button>
          <div class="lobby-queue"><span class="eyebrow">${t('foot.ready')}</span><h2>${t('foot.mode')} <span>↗</span></h2><p><i></i> <b id="menu-map-chip">BLOCKYARD</b> <span>•</span> ${t('foot.players')} <span>•</span> ${t('foot.minutes')}</p></div>
          <span class="lobby-note">${t('foot.note')} <b class="lime">⌁</b></span>
        </footer>
      </main>
      <div id="hud" class="hidden"><div class="hud-top"><span class="mode-chip">${t('hud.freeForAll')} <b>BLOCKYARD</b></span><div class="match-chip"><span id="clock">05:00</span><small>${t('hud.freeForAll')}</small></div><div class="rank-chip"><small>${t('hud.yourScore')}</small><b id="score">0</b><span id="rank">#1 / 8</span></div></div><div id="killfeed"></div><div id="crosshair"><i></i><i></i><i></i><i></i><em></em></div><div id="hitmarker"></div><div id="scope" class="hidden"><div></div><i></i><b></b><span>SR-05 / ${t('hud.opticalSystem')}</span></div><div id="damage-vignette"></div><div id="damage-numbers"></div><div id="elimination"></div><div id="reload-label"></div><div id="protection"></div><div class="hud-bottom"><div class="health"><span class="health-plus">+</span><div><b id="hp">100</b><small>${t('hud.health')}</small></div><div class="health-track"><i id="hp-fill"></i></div></div><div class="weapon-slots"><span id="slot0"><kbd>1</kbd><b id="primary-label">M4A4</b></span><span id="slot1"><kbd>2</kbd>Glock</span><span id="slot2"><kbd>3</kbd>${t('hud.knife')}</span></div><div class="ammo"><div><small id="weapon-label">M4A4</small><strong id="ammo">30 <span>/ 90</span></strong></div><kbd>R</kbd></div></div><div class="hud-help">TAB <span>${t('hud.scoreboard')}</span> ESC <span>${t('hud.pause')}</span></div><div id="death" class="hidden"><span class="eyebrow">${t('hud.deathEyebrow')}</span><h2>${t('hud.deathTitle')}</h2><p id="killer-label"></p><div id="respawn-count">3</div><small>${t('hud.respawning')}</small></div></div>
      <div id="scoreboard" class="overlay hidden"><section class="board panel"><div class="panel-kicker">${t('board.standings')} <span>BLOCKYARD / FFA</span></div><h2>${t('board.title')}<span>${t('board.players')}</span></h2><div id="scoreboard-table"></div><p class="muted">${t('board.hint')}</p></section></div>
      <div id="pause" class="overlay hidden"><section class="panel pause-panel"><span class="eyebrow">${t('pause.eyebrow')}</span><h2>${t('pause.title')}<span class="lime">.</span></h2><p class="muted">${t('pause.copy')}</p><button class="primary" data-action="resume">${t('pause.resume')} <span>↗</span></button><button data-action="settings">${t('nav.settings')}</button><button data-action="restart">${t('pause.restart')}</button><button class="muted" data-action="menu">${t('pause.menu')}</button></section></div>
      <div id="results" class="overlay hidden"><section class="panel results-panel"><div class="panel-kicker">${t('result.kicker')} <span>BLOCKYARD / FREE FOR ALL</span></div><h2>${t('result.title')}<span class="lime">.</span></h2><div id="winner"></div><div id="podium"></div><div id="results-table"></div><div class="panel-buttons"><button class="primary" data-action="play">${t('result.again')} <span>↗</span></button><button data-action="menu">${t('result.menu')}</button></div></section></div>
      <div id="dialog" class="overlay hidden"><section class="panel dialog-panel"><button class="close" data-action="close" aria-label="${t('dialog.close')}">×</button><div id="dialog-content"></div></section></div>
      <div id="quit" class="overlay hidden"><section class="panel pause-panel"><span class="eyebrow">${t('quit.eyebrow')}</span><h2>${t('quit.title')}<span class="lime">.</span></h2><p class="muted">${t('quit.copy')}</p><button class="primary" data-action="menu">${t('quit.back')}</button></section></div>
      <div id="notice" role="status"></div>`;
        const defuseButton = document.createElement('button');
        defuseButton.id = 'play-defuse';
        defuseButton.className = 'online-button';
        defuseButton.dataset.action = 'play-defuse';
        defuseButton.textContent = `${t('hud.defuse')} · SANDSTORM 5v5`;
        this.el('play').before(defuseButton);
        const bombStatus = document.createElement('div');
        bombStatus.id = 'bomb-status';
        bombStatus.className = 'hidden';
        this.el('hud').append(bombStatus);
        const buyMenu = document.createElement('div');
        buyMenu.id = 'buy-menu';
        buyMenu.className = 'hidden';
        this.el('hud').append(buyMenu);
        // Built here so the HUD markup stays readable; the hint line explains the melee controls.
        const hint = document.createElement('div');
        hint.id = 'weapon-hint';
        this.root.querySelector('#hud')!.append(hint);
        // Weapon XP is appended to the results panel here so the static markup stays short.
        const resultsXp = document.createElement('div');
        resultsXp.id = 'results-xp';
        this.root.querySelector('.results-panel')!.insertBefore(resultsXp, this.root.querySelector('#results-table'));
        // Live map name shows up in the HUD, the scoreboard and the results header.
        for (const [selector, id] of [['.mode-chip b', 'map-label'], ['#scoreboard .panel-kicker span', 'scoreboard-map'], ['#results .panel-kicker span', 'results-map']] as const)
            (this.root.querySelector(selector) as HTMLElement).id = id;
        const captureHint = document.createElement('div');
        captureHint.id = 'capture-hint';
        captureHint.className = 'hidden';
        captureHint.setAttribute('role', 'status');
        this.root.append(captureHint);
        const network = document.createElement('button'); network.id = 'network-status'; network.dataset.action = 'copy-room'; network.className = 'hidden'; this.root.append(network);
    }
    /**
     * Flips the interface language in place: rebuild the static markup, then restore the screen and
     * whatever dialog was open so the player never loses their place.
     */
    setLanguage(lang: Lang) {
        if (lang === getLang()) return;
        this.equipment.closePreview();
        setLang(lang);
        this.game.settings.data.lang = lang;
        this.game.settings.save();
        const dialog = this.dialog;
        this.captureUiMode = '';
        this.render();
        this.show(this.screen);
        this.menuLoadout();
        if (dialog === 'armory') this.armory();
        else if (dialog === 'loadout') this.loadout();
        else if (dialog === 'collection') this.collection();
        else if (dialog === 'settings') this.settings();
        else if (dialog === 'mouse-help') this.mouseHelp();
        else if (dialog === 'multiplayer') this.multiplayer();
        this.notice(t('lang.notice'));
    }
    el(id: string) { return document.getElementById(id)!; }
    show(screen: Screen) {
        if (screen !== 'playing' && screen !== 'pause') this.equipment?.closePreview();
        this.screen = screen;
        this.dialog = '';
        this.el('dialog').classList.add('hidden');
        for (const id of ['menu', 'pause', 'results', 'quit']) this.el(id).classList.toggle('hidden', id !== screen);
        this.el('hud').classList.toggle('hidden', screen !== 'playing' && screen !== 'pause');
        this.el('scoreboard').classList.add('hidden');
        this.el('network-status').classList.toggle('hidden', !this.game.network.active);
        this.el('pause').querySelector('p')!.textContent = t(this.game.network.active ? 'net.note' : 'pause.copy');
        if (screen !== 'playing') this.setCaptureMode('idle');
        if (screen === 'results') this.results();
    }
    setCaptureMode(mode: string) {
        if (mode === this.captureUiMode) return;
        this.captureUiMode = mode;
        this.game.input.canvas.classList.toggle('compatibility-controls', mode === 'compatibility');
        const hint = this.el('capture-hint');
        hint.classList.toggle('hidden', mode !== 'requesting' && mode !== 'compatibility');
        if (mode === 'requesting') hint.textContent = t('capture.requesting');
        else if (mode === 'compatibility') hint.innerHTML = `<b>${t('capture.compatTitle')}</b><span>${t('capture.compatHint')}</span><button data-action="mouse-help">${t('capture.help')}</button>`;
    }
    mouseHelp() {
        this.game.pause();
        this.dialog = 'mouse-help';
        this.el('dialog').classList.remove('hidden');
        this.el('dialog-content').innerHTML = `<span class="eyebrow">${t('mouse.eyebrow')}</span><h2>${t('mouse.title')}</h2><p class="muted">${t('mouse.why')}</p><p>${t('mouse.how')}</p><p class="muted">${t('mouse.full')}</p><input id="game-address" aria-label="${t('mouse.address')}" readonly><div class="panel-buttons"><button data-action="copy-game-url">${t('mouse.copy')}</button><button class="primary" data-action="resume">${t('mouse.resume')}</button></div>`;
        (this.el('game-address') as HTMLInputElement).value = location.href;
    }

    multiplayer(code = '') {
        this.dialog = 'multiplayer';
        this.el('dialog').classList.remove('hidden');
        this.el('dialog-content').innerHTML = `<span class="eyebrow">BLOCKSTRIKE / WEBRTC</span><h2>${t('net.title')}</h2><p class="muted">${t('net.intro')}</p><div class="network-form"><label for="network-name">${t('net.name')}</label><input id="network-name" maxlength="16" autocomplete="nickname" value="PLAYER"><label for="network-code">${t('net.code')}</label><input id="network-code" maxlength="8" autocomplete="off" spellcheck="false" placeholder="ABCD2345"><div class="panel-buttons"><button class="primary" data-action="host-room">${t('net.create')}</button><button data-action="join-room">${t('net.join')}</button></div><p id="network-message" role="status"></p><p class="muted">${t('net.note')}</p></div>`;
        (this.el('network-code') as HTMLInputElement).value = code;
    }
    networkStatus(message: string) {
        const target = document.getElementById('network-message');
        if (target) target.textContent = message;
        this.root.querySelectorAll<HTMLButtonElement>('[data-action="host-room"],[data-action="join-room"]').forEach(b => b.disabled = this.game.network.connecting);
    }
    async copyRoom() {
        const url = new URL(location.href); url.search = ''; url.hash = ''; url.searchParams.set('room', this.game.network.room.code);
        try { await navigator.clipboard.writeText(url.href); this.notice(t('net.copied')); }
        catch { this.notice(t('net.room') + ': ' + this.game.network.room.code); }
    }

    action(action: string) { this.game.audio.ui(); if (action === 'play' || action === 'restart') {
        if (this.game.network.guest) this.notice(t('net.waitHost'));
        else this.game.start(this.game.network.host);
    }
    else if (action === 'play-defuse') this.game.start(false, 'sandstorm', 'defuse');
    else if (action === 'multiplayer') this.multiplayer();
    else if (action === 'host-room' || action === 'join-room') {
        const name = (this.el('network-name') as HTMLInputElement).value;
        const code = (this.el('network-code') as HTMLInputElement).value;
        void this.game.network.connect(action === 'host-room', code, name);
    }
    else if (action === 'copy-room') void this.copyRoom();
    else if (action === 'resume')
        this.game.resume();
    else if (action === 'menu')
        this.game.mainMenu();
    else if (action === 'armory')
        this.armory();
    else if (action === 'loadout')
        this.loadout();
    else if (action === 'collection')
        this.collection();
    else if (action === 'settings')
        this.settings();
    else if (action === 'mouse-help')
        this.mouseHelp();
    else if (action === 'lang')
        this.setLanguage(toggleLang());
    else if (action === 'copy-game-url')
        navigator.clipboard?.writeText(location.href).then(() => this.notice(t('mouse.copied'))).catch(() => this.notice(t('mouse.copyFailed')));
    else if (action === 'close') {
        this.equipment.closePreview();
        if (this.dialog === 'multiplayer') this.game.network.leave();
        this.dialog = '';
        this.el('dialog').classList.add('hidden');
    }
    else if (action === 'fullscreen') {
        if (document.fullscreenElement)
            document.exitFullscreen().catch(() => { });
        else
            document.documentElement.requestFullscreen().catch(() => this.notice(t('notice.fullscreenUnsupported')));
    }
    else if (action === 'quit')
        this.show('quit'); }
    menuLoadout() {
        const s=this.game.settings.data,id=s.primary as WeaponId,image=weaponImage(id,s);
        this.el('menu-gun').innerHTML=`${image?`<img class="menu-primary-image" src="${image}" alt="${weaponTitle(id,s).split(' / ')[0]}">`:gunIcon(id)}<img class="menu-knife-image" src="${knifeInfo(s.knifeStyle).image}" alt="${knifeName(s.knifeStyle,knifeInfo(s.knifeStyle).label)}">`;
        this.el('menu-weapon').textContent=`${weaponTitle(id,s).split(' / ')[0]} · ${knifeName(s.knifeStyle, knifeInfo(s.knifeStyle).label)}`;
        this.menuMaps();
        this.menuLevels();
    }
    /** Pixel minimap rendered straight from the map definition, so cards never drift from the layout. */
    private planSvg(def: MapDefinition, cell: number) {
        const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
        const cols = def.plan[0].length, rows = def.plan.length;
        const colour = (ch: string) => ch === '#' ? def.planColors.structure : ch === '=' ? def.planColors.deck : ch === '*' ? def.planColors.prop : ch === '~' ? def.planColors.water : ch === '^' ? def.planColors.accent : def.planColors.open;
        let out = `<svg class="map-plan" viewBox="0 0 ${cols * cell} ${rows * cell}" role="img" aria-label="${def.name} ${t('map.planLabel')}">`;
        def.plan.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '.') return; out += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${hex(colour(ch))}"/>`; }));
        return out + '</svg>';
    }
    menuMaps() {
        const s = this.game.settings.data, random = s.map === RANDOM_MAP_ID, def = mapById(s.map);
        this.el('menu-map-grid').innerHTML = `<button class="map-chip random ${random ? 'selected' : ''}" data-map="${RANDOM_MAP_ID}" aria-pressed="${random}"><span class="map-chip-art">${MAPS.slice(0, 4).map(m => this.planSvg(m, 3)).join('')}</span><b>${t('map.random')}</b><small>${t('map.randomSmall')}</small></button>` +
            MAPS.map(m => `<button class="map-chip ${!random && s.map === m.id ? 'selected' : ''}" data-map="${m.id}" aria-pressed="${!random && s.map === m.id}"><span class="map-chip-art">${this.planSvg(m, 4)}</span><b>${m.name}</b><small>${mapTag(m)}</small></button>`).join('');
        this.el('menu-map-name').textContent = random ? t('map.randomRotation') : def.name;
        this.el('menu-map-theme').textContent = random ? t('map.rotationTheme') : `${mapTag(def)} · ${mapTheme(def)}`;
        this.el('menu-map-chip').textContent = random ? t('map.randomRotation') : def.name;
        this.el('menu-map-stage').innerHTML = `<div class="map-stage-art">${this.planSvg(def, 13)}</div><div class="map-stage-info"><span class="eyebrow">${random ? t('map.rotation') : mapTag(def)} <b>${random ? '×10' : t('hud.freeForAll')}</b></span><b class="map-stage-name">${random ? t('map.rotationName') : def.name}</b><p>${random ? t('map.rotationCopy') : mapBlurb(def)}</p><div class="map-stage-tags"><span>${def.size * 2} × ${def.size * 2} M</span><span>${t('map.spawns', { n: def.spawns.length })}</span><span>${mapTheme(def)}</span></div></div>`;
    }
    /** Primary, sidearm and knife levels shown in the lobby so progression is always visible. */
    menuLevels() {
        const s = this.game.settings.data, p = this.game.progress;
        const rows: [WeaponId, string][] = [[s.primary as WeaponId, t('slot.primary')], ['pistol', t('slot.sidearm')], ['knife', t('slot.melee')]];
        const player = p.player;
        const profile = `<div class="lvl-chip"><small>${t('hud.profile')}</small><b>${t('hud.player')}</b><span class="lvl-badge">LV ${player.level}</span><small class="lvl-xp">${player.xp} XP · ${player.kills} ${t('equipment.kills')}</small></div>`;
        this.el('menu-levels').innerHTML = profile + rows.map(([id, slot]) => {
            const w = p.get(id), cost = p.cost(id);
            const name = id === 'knife' ? knifeName(s.knifeStyle, knifeInfo(s.knifeStyle).label) : weaponTitle(id, s).split(' / ')[0];
            return `<button class="lvl-chip" data-action="loadout" aria-label="${t('levelChip.aria', { name, n: w.level })}"><small>${slot}</small><b>${name}</b><span class="lvl-badge">LV ${w.level}</span><i class="lvl-bar"><em style="width:${Math.round(p.progress(id) * 100)}%"></em></i><small class="lvl-xp">${cost ? `${w.xp} / ${cost} XP` : t('level.max', { n: MAX_LEVEL })}</small></button>`;
        }).join('');
    }
    renderPreview(dt: number) { this.equipment.renderPreview(dt); }
    armory() { this.equipment.show('armory'); }
    loadout(_previewId?: WeaponId) { this.equipment.show('loadout'); }
    collection() { this.equipment.show('collection'); }
    settings() {
        this.dialog = 'settings';
        this.el('dialog').classList.remove('hidden');
        const s = this.game.settings.data;
        const slider = (key: string, label: string, min: number, max: number, step: number, value: number) => `<label class="setting-row"><span>${label}</span><input aria-label="${label}" data-setting="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><output id="value-${key}">${key === 'volume' || key === 'sfx' ? Math.round(value * 100) + '%' : value}</output></label>`;
        // Option values stay the raw setting ids so switching language never rewrites what is stored.
        const options = (ids: string[], prefix: string, current: string) => ids.map(v => `<option value="${v}" ${current === v ? 'selected' : ''}>${t(`${prefix}.${v}`)}</option>`).join('');
        this.el('dialog-content').innerHTML = `<span class="eyebrow">${t('set.eyebrow')}</span><h2>${t('set.title')}<span class="lime">.</span></h2><div class="settings-section">${t('set.controls')}</div>${slider('sensitivity', t('set.sensitivity'), .2, 3, .05, s.sensitivity)}${slider('fov', t('set.fov'), 70, 120, 1, s.fov)}<div class="settings-section">${t('set.audio')}</div>${slider('volume', t('set.volume'), 0, 1, .05, s.volume)}${slider('sfx', t('set.sfx'), 0, 1, .05, s.sfx)}<div class="settings-section">${t('set.display')}</div><label class="setting-row"><span>${t('set.quality')}</span><select aria-label="${t('set.quality')}" data-setting="quality">${options(['low', 'medium', 'high'], 'quality', s.quality)}</select></label><label class="setting-row"><span>${t('set.difficulty')}</span><select aria-label="${t('set.difficulty')}" data-setting="difficulty">${options(['easy', 'normal', 'hard'], 'difficulty', s.difficulty)}</select></label><div class="settings-section">${t('set.language')}</div><div class="lang-choice"><button data-lang="zh" class="${getLang()==='zh'?'selected':''}">中文</button><button data-lang="en" class="${getLang()==='en'?'selected':''}">English</button></div><div class="panel-buttons"><button data-action="fullscreen">${t('set.fullscreen')}</button><button class="primary" data-action="close">${t('set.done')}</button></div><p class="muted">${t('set.saved')}</p>`;
    }
    table() { return `<table><thead><tr><th>${t('board.rank')}</th><th>${t('board.player')}</th><th>${t('board.kills')}</th><th>${t('board.deaths')}</th><th>${t('board.score')}</th></tr></thead><tbody>${this.game.match.rank(this.game.actors).map((a, i) => `<tr class="${a.id === this.game.player.id ? 'local' : ''}"><td>${String(i + 1).padStart(2, '0')}</td><td><i style="background:#${a.color.toString(16)}"></i>${a.name}${a.id === this.game.player.id ? `<small>${t('board.you')}</small>` : `<small>${this.game.network.active ? t('hud.online') : t('hud.bot')}</small>`}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${a.score}</td></tr>`).join('')}</tbody></table>`; }
    results() {
        const ranks = this.game.match.rank(this.game.actors);
        const tied = ranks.filter(a => a.score === ranks[0].score);
        this.el('winner').innerHTML = `<small>${tied.length > 1 ? t('result.joint') : t('result.winner')}</small><strong>${tied.length > 1 ? tied.map(a => a.name).join(' / ') : ranks[0].name}</strong><span>${t('result.eliminations', { n: ranks[0].score })}</span>`;
        this.el('podium').innerHTML = ranks.slice(0, 3).map((a, i) => `<div><span>0${i + 1}</span><b>${a.name}</b><small>${a.kills} ${t('board.kills')} / ${a.deaths} ${t('board.deaths')}</small></div>`).join('');
        this.el('results-table').innerHTML = this.table();
        this.resultsXp();
    }
    /** Weapon XP earned this match, including the level the weapon finished on. */
    resultsXp() {
        const s = this.game.settings.data, p = this.game.progress, rows = this.game.lastXp;
        if (!rows.length) { this.el('results-xp').innerHTML = ''; return; }
        const levelled = rows.some(r => r.to > r.from);
        this.el('results-xp').innerHTML = `<div class="xp-head"><span class="eyebrow">${t('result.xp')} · ${t('hud.player')} +${this.game.matchPlayerXp} XP</span>${levelled ? `<b class="xp-levelup">${t('result.levelUp')}</b>` : ''}</div>` + rows.map(r => {
            const w = p.get(r.weapon), cost = p.cost(r.weapon);
            return `<div class="xp-row${r.to > r.from ? ' up' : ''}"><b>${weaponTitle(r.weapon, s).split(' / ')[0]}</b><span class="xp-gain">+${r.gained} XP</span><span class="lvl-badge">LV ${r.to > r.from ? `${r.from} → ${r.to}` : r.to}</span><i class="lvl-bar"><em style="width:${Math.round(p.progress(r.weapon) * 100)}%"></em></i><small>${cost ? `${w.xp} / ${cost} XP` : t('level.max', { n: MAX_LEVEL })}</small></div>`;
        }).join('');
    }
    /** `back` marks a stabbed-from-behind kill kind of hit: bigger marker, red numbers, callout. */
    hit(head = false, back = false) { this.hitUntil = this.game.time + (back ? .2 : .14); this.hitHead = head; this.hitBack = back; if (back)
        this.backstabUntil = this.game.time + 1.1; }
    xpEarned(weaponId: WeaponId, amount: number) { this.earnedWeapon = weaponTitle(weaponId, this.game.weapons.appearance) + ' +' + amount + ' XP'; }
    eliminated(name: string, streak: number) { this.eliminationUntil = this.game.time + 2.5; const label: Record<number, string> = { 2: t('elim.2'), 3: t('elim.3'), 5: t('elim.5'), 10: t('elim.10') }; this.el('elimination').innerHTML = `<small>${label[streak] || t('elim.default')}</small><b>${name} <span>+50 XP</span></b><em>${this.earnedWeapon}</em>`; }
    damageNumber(amount: number, point: {
        x: number;
        y: number;
        z: number;
    }, head = false, back = false) { const node = document.createElement('span'); node.className = 'damage-number' + (head ? ' head' : '') + (back ? ' back' : ''); node.textContent = String(Math.round(amount)); const v = this.game.camera.position.clone().set(point.x, point.y + .35, point.z).project(this.game.camera); if (v.z > 1)
        return; node.style.left = (v.x * .5 + .5) * 100 + '%'; node.style.top = (-v.y * .5 + .5) * 100 + '%'; this.el('damage-numbers').append(node); setTimeout(() => node.remove(), 650); }
    notice(message: string) { this.el('notice').textContent = message; this.el('notice').classList.add('shown'); setTimeout(() => this.el('notice').classList.remove('shown'), 3500); }
    update() {
        const g = this.game, p = g.player, w = g.weapon;
        if (this.screen === 'playing') this.setCaptureMode(g.input.mode);
        this.el('network-status').textContent = g.network.active ? `${t('net.room')} ${g.network.room.code} · ${g.actors.length}/8 · ${t('net.copy')}` : '';
        const scope = g.input.aiming && (getWeapon(w.config.id)?.modelFamily ?? w.config.id) === 'sniper' && p.alive;
        this.el('scope').classList.toggle('hidden', !scope);
        this.el('crosshair').style.setProperty('--gap', `${5 + p.speed * .6 + w.heat * 2 + (!p.grounded ? 8 : 0)}px`);
        this.el('crosshair').classList.toggle('hidden', scope || !p.alive);
        this.el('crosshair').classList.toggle('melee', w.config.id === 'knife');
        this.el('hitmarker').className = g.time < this.hitUntil ? (this.hitBack ? 'back active' : this.hitHead ? 'head active' : 'active') : '';
        this.el('weapon-hint').className = g.time < this.backstabUntil ? 'backstab' : '';
        this.el('weapon-hint').textContent = g.time < this.backstabUntil ? t('hud.backstab') : !p.alive || w.config.id !== 'knife' ? '' : g.weapons.switching ? t('hud.drawingKnife') : w.attack ? t(`melee.${w.attack}`) : t('hud.meleeHint');
        this.el('damage-vignette').style.opacity = g.time < this.damageUntil ? '.75' : '0';
        this.el('elimination').style.opacity = g.time < this.eliminationUntil ? '1' : '0';
        this.el('scoreboard').classList.toggle('hidden', !g.input.keys.has('Tab') || this.screen !== 'playing');
        this.el('death').classList.toggle('hidden', p.alive);
        this.el('respawn-count').textContent = g.modeId === 'defuse' ? t('hud.nextRound') : Math.max(1, Math.ceil(p.respawnAt - g.time)).toString();
        if (g.time - this.lastUpdate < .09 && g.time >= this.lastUpdate)
            return;
        this.lastUpdate = g.time;
        const defuse = g.modeId === 'defuse';
        const seconds = defuse ? Math.ceil(g.round.phase === 'planted' ? g.round.bomb.remaining : g.round.phaseLeft) : 0;
        this.el('clock').textContent = defuse ? `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${(Math.max(0, seconds) % 60).toString().padStart(2, '0')}` : g.match.clock;
        this.el('map-label').textContent = g.map.name;
        this.el('scoreboard-map').textContent = `${g.map.name} / ${defuse ? t('hud.defuse') : t('hud.freeForAll')}`;
        this.root.querySelector('.mode-chip')!.firstChild!.textContent = defuse ? t('hud.defuse') + ' ' : t('hud.freeForAll') + ' ';
        this.root.querySelector('.match-chip small')!.textContent = defuse ? t('hud.round', { n: g.round.round, phase: t('hud.phase.' + g.round.phase) }) : t('hud.freeForAll');
        const bombStatus = this.el('bomb-status');
        bombStatus.classList.toggle('hidden', !defuse);
        if (defuse) bombStatus.textContent = `${t('equipment.attacker')} ${g.round.scores.attackers} : ${g.round.scores.defenders} ${t('equipment.defender')} · ${t('hud.bombState.' + g.round.bomb.state)}${g.round.bomb.site ? ' / ' + g.round.bomb.site : ''} · ${g.round.bomb.carrierId === p.id ? t('hud.bombCarry') : g.round.bomb.state === 'planted' ? t('hud.bombDefuse') : ''} ${g.round.bomb.progress > 0 ? Math.ceil(g.round.bomb.progress * 10) / 10 + 's' : ''}`;
        this.el('results-map').textContent = `${g.map.name} / ${t('foot.mode')}`;
        this.el('clock').classList.toggle('urgent', defuse ? g.round.phase === 'planted' && g.round.bomb.remaining < 15 : g.match.remaining < 30);
        this.el('score').textContent = defuse ? '$' + g.round.economy.balance(p.id) : String(p.score);
        const buyMenu = this.el('buy-menu');
        buyMenu.classList.toggle('hidden', !defuse || !g.buyOpen || !g.round.canBuy);
        if (defuse && g.buyOpen && g.round.canBuy) {
            const categories = ['pistols','smgs','rifles','snipers','shotguns','machine-guns','gear','grenades'];
            const items = BUY_ITEMS.filter(item => item.category === g.buyCategory);
            buyMenu.innerHTML = '<strong>' + t('hud.buyHelp') + ' · $' + g.round.economy.balance(p.id) + '</strong>'
              + '<div class="buy-categories">' + categories.map((category, i) => '<span class="' + (category === g.buyCategory ? 'selected' : '') + '"><kbd>' + (i + 1) + '</kbd>' + t('category.' + category) + '</span>').join('') + '</div>'
              + '<div class="buy-items">' + (items.length ? items.map((item, i) => {
                  const status = g.buyStatus(item.id);
                  return '<div class="buy-item ' + (i === g.buySelection ? 'selected' : '') + ' ' + (status === 'AVAILABLE' ? 'available' : 'unavailable') + '">'
                    + (item.previewImage ? '<img src="' + item.previewImage + '" alt="">' : '<span class="buy-no-image">' + t('hud.gear') + '</span>')
                    + '<span><b>' + (item.category === 'gear' ? t('buy.' + item.id) : item.label) + '</b><small>' + t('equipment.damage') + ' ' + (item.damage ?? '—') + ' · ' + t('equipment.magazine') + ' ' + (item.ammo ?? '—') + ' · RPM ' + (item.rpm ?? '—') + '</small></span>'
                    + '<span><b>$' + item.price + '</b><small>' + t('buy.' + status) + (status === 'TOO EXPENSIVE' ? ' · ' + t('hud.need', { n: Math.max(0, item.price - g.round.economy.balance(p.id)) }) : '') + '</small></span></div>';
              }).join('') : '<p class="buy-empty">' + t('hud.buyEmpty') + '</p>') + '</div>';
        }
        this.root.querySelector('.rank-chip small')!.textContent = defuse ? t('hud.credits') : t('hud.yourScore');
        this.el('rank').textContent = defuse ? `${g.actors.filter(a => a.alive && g.defuseMode.team(a) === 'attackers').length} vs ${g.actors.filter(a => a.alive && g.defuseMode.team(a) === 'defenders').length}` : `#${g.match.rank(g.actors).findIndex(a => a.id === p.id) + 1} / ${g.actors.length}`;
        this.el('hp').textContent = String(Math.ceil(p.hp));
        this.el('hp-fill').style.width = p.hp + '%';
        this.el('hp-fill').style.background = p.hp < 30 ? '#f0836f' : '#d5f66b';
        // The knife has nothing to reload, so its panel shows the two stab damages instead.
        this.el('ammo').innerHTML = w.config.melee ? `${w.config.melee.light.damage} <span>/ ${w.config.melee.heavy.damage}</span>` : `${w.ammo.toString().padStart(2, '0')} <span>/ ${w.reserve}</span>`;
        this.el('weapon-label').textContent = w.config.melee ? t('hud.stabDamage') : weaponTitle(w.config.id,g.weapons.appearance).toUpperCase();
        this.el('ammo').closest('.ammo')!.querySelector('kbd')!.classList.toggle('hidden',!!w.config.melee);
        this.el('primary-label').textContent = weaponTitle(g.weapons.slots[0].config.id,g.weapons.appearance).split(' / ')[0];
        const knifeLabel = knifeName(g.weapons.appearance.knifeStyle, knifeInfo(g.weapons.appearance.knifeStyle).label);
        if (knifeLabel !== this.knifeLabel) {
            this.knifeLabel = knifeLabel;
            this.el('slot2').innerHTML = `<kbd>3</kbd>${knifeLabel}`;
        }
        for (let i = 0; i < 3; i++)
            this.el('slot' + i).classList.toggle('active', i === g.weapons.slot);
        this.el('reload-label').textContent = w.reloadLeft > 0 ? t('hud.reloading', { s: w.reloadLeft.toFixed(1) }) : w.ammo === 0 ? (w.reserve ? t('hud.pressReload') : t('hud.outOfAmmo')) : '';
        this.el('protection').textContent = p.alive && p.protectedUntil > g.time ? t('hud.spawnProtection') : '';
        this.el('killfeed').innerHTML = g.match.feed.filter(e => g.time - e.time < 7).map(e => `<div class="${e.local ? 'local' : ''}"><b>${e.killer}</b><span>${e.headshot ? '⌖ ' : ''}${e.weapon}</span><b>${e.victim}</b></div>`).join('');
        if (g.input.keys.has('Tab'))
            this.el('scoreboard-table').innerHTML = this.table();
    }
}
