import type { Game } from '../core/Game';
import { PRIMARY, WEAPONS, type WeaponId } from '../weapons/WeaponConfig';
import { KNIVES, RIFLE_SKINS, knifeInfo, weaponImage, weaponTitle, type KnifeStyle, type RifleSkin } from '../weapons/WeaponAppearance';
import { MAPS, RANDOM_MAP_ID, mapById, type MapDefinition } from '../world/Maps';
import { KNIFE_UNLOCKS, MAX_LEVEL, RIFLE_UNLOCKS, WEAPON_ORDER } from '../core/Progress';
import { ArmoryPreview } from './ArmoryPreview';
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
    private preview?: ArmoryPreview;
    constructor(public game: Game) {
        this.root.innerHTML = `
      <main id="menu" class="menu screen">
        <header class="lobby-top"><a class="brand" href="#" aria-label="BlockStrike home">${icon}<span>BLOCK<span class="brand-light">STRIKE</span><small>THE BLOCKS HIT DIFFERENT.</small></span></a><nav><span class="nav-active">PLAY</span><button data-action="loadout">ARMORY</button><button data-action="settings">SETTINGS</button><button data-action="quit">QUIT ↗</button></nav><span class="build"><i></i> LOCAL PLAY <b>10 ARENAS</b></span></header>
        <div class="lobby-body">
          <section class="lobby-hero">
            <div class="eyebrow"><span class="tiny-block"></span> SMALL BLOCKS. BIG ENERGY.</div>
            <h1>DROP IN.<br><span>STAND OUT.</span></h1>
            <p>Ten arenas, six weapons, one five minute free for all.<br>Pick a map, level a gun, drop in.</p>
            <div class="hero-tags"><span>01 PLAYER</span><span>07 BOTS</span><span>10 MAPS</span><span>LV 0–10</span></div>
            <div class="lobby-chips" id="menu-levels"></div>
            <button class="lobby-loadout" data-action="loadout"><span class="eyebrow">YOUR LOADOUT <span>↗</span></span><div class="weapon-preview-icon" id="menu-gun"></div><div class="lobby-loadout-row"><strong id="menu-weapon">M4A4</strong><span>ARMORY · 升级武器 ↗</span></div></button>
          </section>
          <section class="lobby-map">
            <div class="lobby-map-head"><span class="eyebrow">SELECT ARENA</span><b id="menu-map-name">BLOCKYARD</b><small id="menu-map-theme">货运堆场 · 温带</small></div>
            <div class="map-stage" id="menu-map-stage"></div>
            <div class="map-grid" id="menu-map-grid"></div>
          </section>
        </div>
        <footer class="lobby-foot">
          <button id="play" class="play-button" data-action="play"><span>PLAY</span><span class="arrow">↗</span></button>
          <div class="lobby-queue"><span class="eyebrow">READY WHEN YOU ARE</span><h2>FREE FOR ALL <span>↗</span></h2><p><i></i> <b id="menu-map-chip">BLOCKYARD</b> <span>•</span> 8 players <span>•</span> 5 minutes</p></div>
          <span class="lobby-note">BUILT FROM BLOCKS. MADE FOR PLAY. <b class="lime">⌁</b></span>
        </footer>
      </main>
      <div id="hud" class="hidden"><div class="hud-top"><span class="mode-chip">FFA <b>BLOCKYARD</b></span><div class="match-chip"><span id="clock">05:00</span><small>FREE FOR ALL</small></div><div class="rank-chip"><small>YOUR SCORE</small><b id="score">0</b><span id="rank">#1 / 8</span></div></div><div id="killfeed"></div><div id="crosshair"><i></i><i></i><i></i><i></i><em></em></div><div id="hitmarker"></div><div id="scope" class="hidden"><div></div><i></i><b></b><span>SR-05 / OPTICAL SYSTEM</span></div><div id="damage-vignette"></div><div id="damage-numbers"></div><div id="elimination"></div><div id="reload-label"></div><div id="protection"></div><div class="hud-bottom"><div class="health"><span class="health-plus">+</span><div><b id="hp">100</b><small>HEALTH</small></div><div class="health-track"><i id="hp-fill"></i></div></div><div class="weapon-slots"><span id="slot0"><kbd>1</kbd><b id="primary-label">AR-30</b></span><span id="slot1"><kbd>2</kbd>P-12</span><span id="slot2"><kbd>3</kbd>KNIFE</span></div><div class="ammo"><div><small id="weapon-label">ASSAULT RIFLE</small><strong id="ammo">30 <span>/ 90</span></strong></div><kbd>R</kbd></div></div><div class="hud-help">TAB <span>SCOREBOARD</span> ESC <span>PAUSE</span></div><div id="death" class="hidden"><span class="eyebrow">BACK IN THE FIGHT SOON</span><h2>YOU WERE ELIMINATED</h2><p id="killer-label"></p><div id="respawn-count">3</div><small>RESPAWNING AT A SAFE LOCATION</small></div></div>
      <div id="scoreboard" class="overlay hidden"><section class="board panel"><div class="panel-kicker">LIVE STANDINGS <span>BLOCKYARD / FFA</span></div><h2>THE LINEUP<span>08 PLAYERS</span></h2><div id="scoreboard-table"></div><p class="muted">HOLD TAB TO VIEW · KILLS = SCORE</p></section></div>
      <div id="pause" class="overlay hidden"><section class="panel pause-panel"><span class="eyebrow">TAKE A BREATHER</span><h2>PAUSED<span class="lime">.</span></h2><p class="muted">The match will wait for you.</p><button class="primary" data-action="resume">RESUME <span>↗</span></button><button data-action="settings">SETTINGS</button><button data-action="restart">RESTART MATCH</button><button class="muted" data-action="menu">MAIN MENU</button></section></div>
      <div id="results" class="overlay hidden"><section class="panel results-panel"><div class="panel-kicker">ROUND COMPLETE <span>BLOCKYARD / FREE FOR ALL</span></div><h2>MATCH OVER<span class="lime">.</span></h2><div id="winner"></div><div id="podium"></div><div id="results-table"></div><div class="panel-buttons"><button class="primary" data-action="play">PLAY AGAIN <span>↗</span></button><button data-action="menu">MAIN MENU</button></div></section></div>
      <div id="dialog" class="overlay hidden"><section class="panel dialog-panel"><button class="close" data-action="close" aria-label="Close dialog">×</button><div id="dialog-content"></div></section></div>
      <div id="quit" class="overlay hidden"><section class="panel pause-panel"><span class="eyebrow">GG. SEE YOU IN THE YARD.</span><h2>OVER & OUT<span class="lime">.</span></h2><p class="muted">You can close this tab to quit.</p><button class="primary" data-action="menu">BACK TO MENU ↗</button></section></div>
      <div id="notice" role="status"></div>`;
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
        this.root.addEventListener('click', e => { const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]'); if (target)
            this.action(target.dataset.action!); const weapon = (e.target as HTMLElement).closest<HTMLElement>('[data-weapon]'); if (weapon) {
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
        this.root.addEventListener('input', e => { const input = e.target as HTMLInputElement; const key = input.dataset.setting; if (!key)
            return; const data = this.game.settings.data as unknown as Record<string, unknown>; data[key] = input.type === 'range' ? Number(input.value) : input.value; this.game.settings.save(); this.game.applySettings(); const out = document.querySelector(`#value-${key}`); if (out)
            out.textContent = key === 'volume' || key === 'sfx' ? Math.round(Number(input.value) * 100) + '%' : input.value; });
        const captureHint = document.createElement('div');
        captureHint.id = 'capture-hint';
        captureHint.className = 'hidden';
        captureHint.setAttribute('role', 'status');
        this.root.append(captureHint);
        this.menuLoadout();
    }
    el(id: string) { return document.getElementById(id)!; }
    show(screen: Screen) {
        this.screen = screen;
        this.dialog = '';
        this.el('dialog').classList.add('hidden');
        for (const id of ['menu', 'pause', 'results', 'quit']) this.el(id).classList.toggle('hidden', id !== screen);
        this.el('hud').classList.toggle('hidden', screen !== 'playing' && screen !== 'pause');
        this.el('scoreboard').classList.add('hidden');
        if (screen !== 'playing') this.setCaptureMode('idle');
        if (screen === 'results') this.results();
    }
    setCaptureMode(mode: string) {
        if (mode === this.captureUiMode) return;
        this.captureUiMode = mode;
        this.game.input.canvas.classList.toggle('compatibility-controls', mode === 'compatibility');
        const hint = this.el('capture-hint');
        hint.classList.toggle('hidden', mode !== 'requesting' && mode !== 'compatibility');
        if (mode === 'requesting') hint.textContent = '正在启用鼠标控制… ESC 取消';
        else if (mode === 'compatibility') hint.innerHTML = '<b>兼容鼠标模式</b><span>移动瞄准 · 靠近边缘或按方向键转向 · ESC 暂停</span><button data-action="mouse-help">鼠标帮助 ↗</button>';
    }
    mouseHelp() {
        this.game.pause();
        this.dialog = 'mouse-help';
        this.el('dialog').classList.remove('hidden');
        this.el('dialog-content').innerHTML = `<span class="eyebrow">MOUSE CONTROLS</span><h2>鼠标控制</h2><p class="muted">当前浏览器未能授予鼠标锁定，游戏已启用兼容控制。</p><p>移动鼠标瞄准；靠近画面边缘或按方向键可持续转向。WASD 移动、左键射击、右键开镜保持可用。鼠标离开游戏窗口时会暂停。</p><p class="muted">完整的 FPS 鼠标锁定体验：复制下面的地址，在独立 Chrome 或 Edge 窗口中打开，再点击 PLAY。</p><input id="game-address" aria-label="游戏地址" readonly><div class="panel-buttons"><button data-action="copy-game-url">复制游戏地址</button><button class="primary" data-action="resume">继续游戏 ↗</button></div>`;
        (this.el('game-address') as HTMLInputElement).value = location.href;
    }
    action(action: string) { this.game.audio.ui(); if (action === 'play' || action === 'restart')
        this.game.start();
    else if (action === 'resume')
        this.game.resume();
    else if (action === 'menu')
        this.game.mainMenu();
    else if (action === 'loadout')
        this.loadout();
    else if (action === 'settings')
        this.settings();
    else if (action === 'mouse-help')
        this.mouseHelp();
    else if (action === 'copy-game-url')
        navigator.clipboard?.writeText(location.href).then(() => this.notice('游戏地址已复制，请粘贴到 Chrome / Edge 地址栏。')).catch(() => this.notice('请选中上方地址并手动复制。'));
    else if (action === 'close') {
        this.dialog = '';
        this.el('dialog').classList.add('hidden');
    }
    else if (action === 'fullscreen') {
        if (document.fullscreenElement)
            document.exitFullscreen().catch(() => { });
        else
            document.documentElement.requestFullscreen().catch(() => this.notice('Fullscreen is unavailable in this browser.'));
    }
    else if (action === 'quit')
        this.show('quit'); }
    menuLoadout() {
        const s=this.game.settings.data,id=s.primary as WeaponId,image=weaponImage(id,s);
        this.el('menu-gun').innerHTML=`${image?`<img class="menu-primary-image" src="${image}" alt="${weaponTitle(id,s)}">`:gunIcon(id)}<img class="menu-knife-image" src="${knifeInfo(s.knifeStyle).image}" alt="${knifeInfo(s.knifeStyle).label}">`;
        this.el('menu-weapon').textContent=`${weaponTitle(id,s).split(' / ')[0]} · ${knifeInfo(s.knifeStyle).name}`;
        this.menuMaps();
        this.menuLevels();
    }
    /** Pixel minimap rendered straight from the map definition, so cards never drift from the layout. */
    private planSvg(def: MapDefinition, cell: number) {
        const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
        const cols = def.plan[0].length, rows = def.plan.length;
        const colour = (ch: string) => ch === '#' ? def.planColors.structure : ch === '=' ? def.planColors.deck : ch === '*' ? def.planColors.prop : ch === '~' ? def.planColors.water : ch === '^' ? def.planColors.accent : def.planColors.open;
        let out = `<svg class="map-plan" viewBox="0 0 ${cols * cell} ${rows * cell}" role="img" aria-label="${def.name} 平面示意">`;
        def.plan.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '.') return; out += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${hex(colour(ch))}"/>`; }));
        return out + '</svg>';
    }
    menuMaps() {
        const s = this.game.settings.data, random = s.map === RANDOM_MAP_ID, def = mapById(s.map);
        this.el('menu-map-grid').innerHTML = `<button class="map-chip random ${random ? 'selected' : ''}" data-map="${RANDOM_MAP_ID}" aria-pressed="${random}"><span class="map-chip-art">${MAPS.slice(0, 4).map(m => this.planSvg(m, 3)).join('')}</span><b>RANDOM</b><small>每局随机</small></button>` +
            MAPS.map(m => `<button class="map-chip ${!random && s.map === m.id ? 'selected' : ''}" data-map="${m.id}" aria-pressed="${!random && s.map === m.id}"><span class="map-chip-art">${this.planSvg(m, 4)}</span><b>${m.name}</b><small>${m.tag}</small></button>`).join('');
        this.el('menu-map-name').textContent = random ? 'RANDOM ROTATION' : def.name;
        this.el('menu-map-theme').textContent = random ? '每局从十张地图中随机抽取' : `${def.tag} · ${def.theme}`;
        this.el('menu-map-chip').textContent = random ? 'RANDOM ROTATION' : def.name;
        this.el('menu-map-stage').innerHTML = `<div class="map-stage-art">${this.planSvg(def, 13)}</div><div class="map-stage-info"><span class="eyebrow">${random ? 'ARENA ROTATION' : def.tag} <b>${random ? '×10' : 'FFA'}</b></span><b class="map-stage-name">${random ? '每局随机地图' : def.name}</b><p>${random ? '不动脑子选图：每局从十张完全不同的地形里随机抽一张。' : def.blurb}</p><div class="map-stage-tags"><span>${def.size * 2} × ${def.size * 2} M</span><span>${def.spawns.length} 出生点</span><span>${def.theme}</span></div></div>`;
    }
    /** Primary, sidearm and knife levels shown in the lobby so progression is always visible. */
    menuLevels() {
        const s = this.game.settings.data, p = this.game.progress;
        const rows: [WeaponId, string][] = [[s.primary as WeaponId, 'PRIMARY'], ['pistol', 'SIDEARM'], ['knife', 'MELEE']];
        this.el('menu-levels').innerHTML = rows.map(([id, slot]) => {
            const w = p.get(id), cost = p.cost(id);
            return `<button class="lvl-chip" data-action="loadout" aria-label="${weaponTitle(id, s).split(' / ')[0]} 等级 ${w.level}"><small>${slot}</small><b>${weaponTitle(id, s).split(' / ')[0]}</b><span class="lvl-badge">LV ${w.level}</span><i class="lvl-bar"><em style="width:${Math.round(p.progress(id) * 100)}%"></em></i><small class="lvl-xp">${cost ? `${w.xp} / ${cost} XP` : `MAX LV ${MAX_LEVEL}`}</small></button>`;
        }).join('');
    }
    renderPreview(dt: number) { if(this.dialog==='loadout') this.preview?.render(dt); }
    loadout(previewId: WeaponId = this.game.settings.data.primary as WeaponId) {
        const panel=this.el('dialog-content').parentElement!;
        const scroll=this.dialog==='loadout'?panel.scrollTop:0;
        this.dialog='loadout';this.el('dialog').classList.remove('hidden');
        const s=this.game.settings.data,k=knifeInfo(s.knifeStyle),image=weaponImage(previewId,s);
        const p=this.game.progress;
        const levelBar=(id:WeaponId)=>{const w=p.get(id),cost=p.cost(id);return `<i class="lvl-bar"><em style="width:${Math.round(p.progress(id)*100)}%"></em></i><small>${cost?`${w.xp} / ${cost} XP`:`MAX LV ${MAX_LEVEL}`}</small>`;};
        const levelRow=(id:WeaponId)=>{const w=p.get(id),cost=p.cost(id);return `<div class="lvl-row${cost?'':' maxed'}"><b>${weaponTitle(id,s).split(' / ')[0]}</b><span class="lvl-badge">LV ${w.level}</span>${levelBar(id)}<small class="lvl-next">${cost?`距 LV ${w.level+1} 还需 ${Math.max(0,cost-w.xp)} XP`:'已满级'}</small></div>`;};
        const skinChip=(skin:typeof RIFLE_SKINS[number])=>{const need=RIFLE_UNLOCKS[skin.id],unlocked=p.unlockedRifleSkin(skin.id),selected=s.rifleSkin===skin.id;return `<button data-rifle-skin="${skin.id}" class="skin-chip ${selected?'selected':''}${unlocked?'':' locked'}" aria-pressed="${selected}" ${unlocked?'':'disabled title="步枪等级 '+need+' 解锁"'}><i class="swatch ${skin.id}"></i>${skin.name}${unlocked?(selected?' ✓':''):` · LV ${need} 解锁`}</button>`;};
        const knifeCard=(knife:typeof KNIVES[number])=>{const need=KNIFE_UNLOCKS[knife.id],unlocked=p.unlockedKnife(knife.id),selected=s.knifeStyle===knife.id;return `<button class="knife-card ${selected?'selected':''}${unlocked?'':' locked'}" data-knife="${knife.id}" aria-pressed="${selected}" ${unlocked?'':'disabled title="匕首等级 '+need+' 解锁"'} style="--finish:${knife.color}"><span class="knife-equipped">${!unlocked?`LV ${need} 解锁`:selected?'✓ 已装备':'选择'}</span><img src="${knife.image}" alt="${knife.label}"><strong>${knife.name}</strong><small>${knife.finish}</small></button>`;};
        this.el('dialog-content').innerHTML=`<div class="armory-header"><div><span class="eyebrow">MAKE IT YOURS / 配装</span><h2>THE ARMORY<span class="lime">.</span></h2></div><span class="armory-saved">✓ 自动保存</span></div>
        <div class="armory-feature"><div class="armory-stage"><span class="stage-label">IN-GAME MODEL <b>3D</b></span><div id="armory-canvas"></div><span class="stage-help">拖动旋转 · 双击复位</span></div><div class="armory-detail"><span class="eyebrow">${previewId==='knife'?'03 / MELEE':previewId==='pistol'?'02 / SECONDARY':'01 / PRIMARY'}</span><h3>${weaponTitle(previewId,s).split(' / ')[0]}</h3><span class="finish-label">${previewId==='knife'?k.finish:previewId==='rifle'?(s.rifleSkin==='asimov'?'ASIMOV / 白橙涂装':'FIELD / 原版涂装'):'FIELD / 战术配色'}</span>${image?`<img src="${image}" alt="${weaponTitle(previewId,s)} 参考图"><small class="reference-label">参考外观</small>`:gunIcon(previewId)}<p>${previewId==='knife'?k.label+' · 轻击 45 / 重击 90':'金属枪身 · 分色护板 · 立体机械细节'} · <b class="lime">LV ${p.get(previewId).level}</b></p></div></div>
        <div class="armory-section-label"><b>01 / 主武器</b><span>点击装备并预览</span></div>
        <div class="loadout-grid">${PRIMARY.map(id=>{const c=WEAPONS[id],image=weaponImage(id,s),selected=s.primary===id;return `<button data-weapon="${id}" aria-pressed="${selected}" class="weapon-card ${selected?'selected':''}"><span class="weapon-card-top">${weaponTitle(id,s).split(' / ')[0]}<b>${selected?'✓ 已装备':'选择'}</b></span><span class="weapon-level"><span class="lvl-badge">LV ${p.get(id).level}</span>${levelBar(id)}</span>${image?`<img src="${image}" alt="${weaponTitle(id,s)}">`:gunIcon(id)}<div class="weapon-stats"><span>DMG <b>${c.damage}${id==='shotgun'?' ×9':''}</b></span><span>MAG <b>${c.magazineSize}</b></span><span>RPM <b>${c.fireRate}</b></span></div></button>`;}).join('')}</div>
        <div class="armory-skins"><span>M4A4 涂装</span>${RIFLE_SKINS.map(skinChip).join('')}<button class="secondary-preview" data-preview="pistol">02 / GLOCK 预览 ↗</button></div>
        <div class="armory-section-label"><b>02 / 武器等级</b><span>每局结算发放经验 · LV 0 → 1 需要 100 XP</span></div>
        <div class="armory-levels">${WEAPON_ORDER.map(levelRow).join('')}</div>
        <div class="armory-section-label"><b>03 / 匕首</b><span>五种外观 · 相同属性 · 等级解锁</span></div><div class="knife-grid">${KNIVES.map(knifeCard).join('')}</div>
        <div class="armory-footer"><p>下局生效 · <b>3</b> 切换匕首 · <b>F</b> 检视武器 · 升级解锁涂装</p><button class="primary" data-action="close">完成配装 <span>↗</span></button></div>`;
        this.preview??=new ArmoryPreview();this.preview.show(this.el('armory-canvas'),previewId,s);
        panel.scrollTop=scroll;
    }
    settings() {
        this.dialog = 'settings';
        this.el('dialog').classList.remove('hidden');
        const s = this.game.settings.data;
        const slider = (key: string, label: string, min: number, max: number, step: number, value: number) => `<label class="setting-row"><span>${label}</span><input aria-label="${label}" data-setting="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><output id="value-${key}">${key === 'volume' || key === 'sfx' ? Math.round(value * 100) + '%' : value}</output></label>`;
        this.el('dialog-content').innerHTML = `<span class="eyebrow">DIAL IT IN</span><h2>SETTINGS<span class="lime">.</span></h2><div class="settings-section">CONTROLS & CAMERA</div>${slider('sensitivity', 'Mouse sensitivity', .2, 3, .05, s.sensitivity)}${slider('fov', 'Field of view', 70, 120, 1, s.fov)}<div class="settings-section">AUDIO</div>${slider('volume', 'Master volume', 0, 1, .05, s.volume)}${slider('sfx', 'Sound effects', 0, 1, .05, s.sfx)}<div class="settings-section">DISPLAY & MATCH</div><label class="setting-row"><span>Graphics quality</span><select aria-label="Graphics quality" data-setting="quality">${['low', 'medium', 'high'].map(v => `<option ${s.quality === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="setting-row"><span>Bot difficulty</span><select aria-label="Bot difficulty" data-setting="difficulty">${['easy', 'normal', 'hard'].map(v => `<option ${s.difficulty === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label><div class="panel-buttons"><button data-action="fullscreen">TOGGLE FULLSCREEN ⛶</button><button class="primary" data-action="close">DONE ✓</button></div><p class="muted">Saved automatically on this device.</p>`;
    }
    table() { return `<table><thead><tr><th>RANK</th><th>PLAYER</th><th>KILLS</th><th>DEATHS</th><th>SCORE</th></tr></thead><tbody>${this.game.match.rank(this.game.actors).map((a, i) => `<tr class="${a.id === 0 ? 'local' : ''}"><td>${String(i + 1).padStart(2, '0')}</td><td><i style="background:#${a.color.toString(16)}"></i>${a.name}${a.id === 0 ? '<small>YOU</small>' : '<small>BOT</small>'}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${a.score}</td></tr>`).join('')}</tbody></table>`; }
    results() {
        const ranks = this.game.match.rank(this.game.actors);
        const tied = ranks.filter(a => a.score === ranks[0].score);
        this.el('winner').innerHTML = `<small>${tied.length > 1 ? 'JOINT TOP SCORE' : 'WINNER'}</small><strong>${tied.length > 1 ? tied.map(a => a.name).join(' / ') : ranks[0].name}</strong><span>${ranks[0].score} ELIMINATIONS</span>`;
        this.el('podium').innerHTML = ranks.slice(0, 3).map((a, i) => `<div><span>0${i + 1}</span><b>${a.name}</b><small>${a.kills} K / ${a.deaths} D</small></div>`).join('');
        this.el('results-table').innerHTML = this.table();
        this.resultsXp();
    }
    /** Weapon XP earned this match, including the level the weapon finished on. */
    resultsXp() {
        const s = this.game.settings.data, p = this.game.progress, rows = this.game.lastXp;
        if (!rows.length) { this.el('results-xp').innerHTML = ''; return; }
        const levelled = rows.some(r => r.to > r.from);
        this.el('results-xp').innerHTML = `<div class="xp-head"><span class="eyebrow">WEAPON XP EARNED</span>${levelled ? '<b class="xp-levelup">LEVEL UP</b>' : ''}</div>` + rows.map(r => {
            const w = p.get(r.weapon), cost = p.cost(r.weapon);
            return `<div class="xp-row${r.to > r.from ? ' up' : ''}"><b>${weaponTitle(r.weapon, s).split(' / ')[0]}</b><span class="xp-gain">+${r.gained} XP</span><span class="lvl-badge">LV ${r.to > r.from ? `${r.from} → ${r.to}` : r.to}</span><i class="lvl-bar"><em style="width:${Math.round(p.progress(r.weapon) * 100)}%"></em></i><small>${cost ? `${w.xp} / ${cost} XP` : `MAX LV ${MAX_LEVEL}`}</small></div>`;
        }).join('');
    }
    /** `back` marks a stabbed-from-behind kill kind of hit: bigger marker, red numbers, callout. */
    hit(head = false, back = false) { this.hitUntil = this.game.time + (back ? .2 : .14); this.hitHead = head; this.hitBack = back; if (back)
        this.backstabUntil = this.game.time + 1.1; }
    eliminated(name: string, streak: number) { this.eliminationUntil = this.game.time + 2.5; const label: Record<number, string> = { 2: 'DOUBLE KILL', 3: 'TRIPLE KILL', 5: 'RAMPAGE', 10: 'UNSTOPPABLE' }; this.el('elimination').innerHTML = `<small>${label[streak] || 'ELIMINATION'}</small><b>${name} <span>+100</span></b><em>+1 SCORE</em>`; }
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
        const scope = g.input.aiming && w.config.id === 'sniper' && p.alive;
        this.el('scope').classList.toggle('hidden', !scope);
        this.el('crosshair').style.setProperty('--gap', `${5 + p.speed * .6 + w.heat * 2 + (!p.grounded ? 8 : 0)}px`);
        this.el('crosshair').classList.toggle('hidden', scope || !p.alive);
        this.el('crosshair').classList.toggle('melee', w.config.id === 'knife');
        this.el('hitmarker').className = g.time < this.hitUntil ? (this.hitBack ? 'back active' : this.hitHead ? 'head active' : 'active') : '';
        this.el('weapon-hint').className = g.time < this.backstabUntil ? 'backstab' : '';
        this.el('weapon-hint').textContent = g.time < this.backstabUntil ? 'BACKSTAB' : !p.alive || w.config.id !== 'knife' ? '' : g.weapons.switching ? 'DRAWING KNIFE…' : w.attack ? w.config.melee![w.attack].label : 'LMB LIGHT STAB · RMB HEAVY STAB · F INSPECT';
        this.el('damage-vignette').style.opacity = g.time < this.damageUntil ? '.75' : '0';
        this.el('elimination').style.opacity = g.time < this.eliminationUntil ? '1' : '0';
        this.el('scoreboard').classList.toggle('hidden', !g.input.keys.has('Tab') || this.screen !== 'playing');
        this.el('death').classList.toggle('hidden', p.alive);
        this.el('respawn-count').textContent = Math.max(1, Math.ceil(p.respawnAt - g.time)).toString();
        if (g.time - this.lastUpdate < .09 && g.time >= this.lastUpdate)
            return;
        this.lastUpdate = g.time;
        this.el('clock').textContent = g.match.clock;
        this.el('map-label').textContent = g.map.name;
        this.el('scoreboard-map').textContent = `${g.map.name} / FFA`;
        this.el('results-map').textContent = `${g.map.name} / FREE FOR ALL`;
        this.el('clock').classList.toggle('urgent', g.match.remaining < 30);
        this.el('score').textContent = String(p.score);
        this.el('rank').textContent = `#${g.match.rank(g.actors).findIndex(a => a.id === 0) + 1} / 8`;
        this.el('hp').textContent = String(Math.ceil(p.hp));
        this.el('hp-fill').style.width = p.hp + '%';
        this.el('hp-fill').style.background = p.hp < 30 ? '#f0836f' : '#d5f66b';
        // The knife has nothing to reload, so its panel shows the two stab damages instead.
        this.el('ammo').innerHTML = w.config.melee ? `${w.config.melee.light.damage} <span>/ ${w.config.melee.heavy.damage}</span>` : `${w.ammo.toString().padStart(2, '0')} <span>/ ${w.reserve}</span>`;
        this.el('weapon-label').textContent = w.config.melee ? 'LIGHT / HEAVY STAB DAMAGE' : weaponTitle(w.config.id,g.weapons.appearance).toUpperCase();
        this.el('ammo').closest('.ammo')!.querySelector('kbd')!.classList.toggle('hidden',!!w.config.melee);
        this.el('primary-label').textContent = weaponTitle(g.weapons.slots[0].config.id,g.weapons.appearance).split(' / ')[0];
        const knifeLabel = knifeInfo(g.weapons.appearance.knifeStyle).name.toUpperCase();
        if (knifeLabel !== this.knifeLabel) {
            this.knifeLabel = knifeLabel;
            this.el('slot2').innerHTML = `<kbd>3</kbd>${knifeLabel}`;
        }
        for (let i = 0; i < 3; i++)
            this.el('slot' + i).classList.toggle('active', i === g.weapons.slot);
        this.el('reload-label').textContent = w.reloadLeft > 0 ? `RELOADING  ${w.reloadLeft.toFixed(1)}s` : w.ammo === 0 ? (w.reserve ? 'PRESS R TO RELOAD' : 'OUT OF AMMO · SWITCH WEAPON') : '';
        this.el('protection').textContent = p.alive && p.protectedUntil > g.time ? 'SPAWN PROTECTION · FIRING ENDS PROTECTION' : '';
        this.el('killfeed').innerHTML = g.match.feed.filter(e => g.time - e.time < 7).map(e => `<div class="${e.local ? 'local' : ''}"><b>${e.killer}</b><span>${e.headshot ? '⌖ ' : ''}${e.weapon}</span><b>${e.victim}</b></div>`).join('');
        if (g.input.keys.has('Tab'))
            this.el('scoreboard-table').innerHTML = this.table();
    }
}
