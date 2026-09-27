import * as THREE from 'three';
import { PickupManager } from '../world/PickupManager';
import { drawPose } from '../weapons/DrawAnimation';
import { NetworkGame } from '../network/NetworkGame';
import { ArenaMap } from '../world/Map';
import { Environment } from '../world/Environment';
import { MAPS, RANDOM_MAP_ID, mapById } from '../world/Maps';
import { Player } from '../player/Player';
import { InputManager } from './InputManager';
import { Weapon } from '../weapons/Weapon';
import { WEAPONS, PRIMARY, WeaponId, MeleeKind } from '../weapons/WeaponConfig';
import { WeaponManager } from '../weapons/WeaponManager';
import { weaponModel } from '../weapons/WeaponModel';
import { WeaponAssetLoader } from '../weapons/WeaponAssetLoader';
import { KnifeAnimationController } from '../weapons/KnifeAnimationController';
import { RecoilController } from '../weapons/recoil/RecoilController';
import { getWeapon } from '../data/weapons';
import { appearanceKey, weaponTitle } from '../weapons/WeaponAppearance';
import { t } from './I18n';
import { Bot, Actor } from '../bots/Bot';
import { trace } from '../game/Combat';
import { SpawnManager } from '../world/SpawnManager';
import { BotNavigation } from '../bots/BotNavigation';
import { BotAI } from '../bots/BotAI';
import { MatchManager } from '../game/MatchManager';
import { FreeForAllMode } from '../game/modes/FreeForAllMode';
import { DefuseMode } from '../game/modes/DefuseMode';
import type { ModeId, Team } from '../game/modes/GameMode';
import { RoundManager } from '../game/round/RoundManager';
import { ViewmodelRenderer } from '../render/ViewmodelRenderer';
import { BuySystem, BUY_ITEMS, type BuyItemId } from '../game/round/BuySystem';
import { ECONOMY_RULES } from '../game/round/Economy';
import type { BombSite } from '../game/round/BombSystem';
import { Settings } from './Settings';
import { LoadoutStore } from './Loadout';
import { UI } from '../ui/UI';
import { AudioManager } from '../audio/AudioManager';
import { ParticleManager } from '../effects/ParticleManager';
import { MatchXp, Progress, XP_PER_KILL } from './Progress';

/** Ease-out used by the first person weapon animation curves. */
const easeOut = (t: number) => 1 - Math.pow(1 - THREE.MathUtils.clamp(t, 0, 1), 3);
/** Offsets in [x, y, z, rotX, rotY, rotZ] for the wind-up and the cut-through of each stab. */
type SwingRig = { wind: number[]; cut: number[] };
const SWINGS: Record<MeleeKind, SwingRig> = {
    light: { wind: [.06, .05, .04, .16, .4, .28], cut: [-.2, -.05, -.1, -.3, -1.15, -.46] },
    heavy: { wind: [.05, .19, .11, .8, .3, .32], cut: [-.18, -.24, -.18, -1.05, -.5, -.58] },
};
export class Game {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(90, innerWidth / innerHeight, .05, 400);
    renderer: THREE.WebGLRenderer;
    viewmodel = new ViewmodelRenderer();
    map: ArenaMap;
    environment!: Environment;
    player: Player;
    input: InputManager;
    running = false;
    time = 0;
    bots: Bot[] = [];
    weapons = new WeaponManager();
    view = weaponModel('rifle', true);
    weaponAssets = new WeaponAssetLoader();
    recoilController = new RecoilController();
    knifeAnimation?: KnifeAnimationController;
    private viewLoadSeq = 0;
    kick = 0;
    inspect = 0;
    viewId: WeaponId = 'rifle';
    fov = 90;
    spawns!: SpawnManager;
    nav!: BotNavigation;
    ais: BotAI[] = [];
    match = new MatchManager();
    modeId: ModeId = 'ffa';
    defuseMode = new DefuseMode();
    round = new RoundManager();
    buySystem = new BuySystem();
    buyOpen = false;
    buyCategory = 'pistols';
    buySelection = 0;
    tacticalBots: Bot[] = [];
    tacticalAis: BotAI[] = [];
    settings = new Settings();
    loadout = new LoadoutStore();
    ui!: UI;
    menuTime = 0;
    fps = 60;
    audio = new AudioManager(this.settings);
    progress = new Progress();
    weaponKills: Partial<Record<WeaponId, number>> = {};
    lastXp: MatchXp[] = [];
    matchPlayerXp = 0;
    private hemisphere!: THREE.HemisphereLight;
    private sun!: THREE.DirectionalLight;
    effects!: ParticleManager;
    flash = new THREE.Mesh(new THREE.OctahedronGeometry(.085), new THREE.MeshBasicMaterial({ color: 0xffe18a }));
    flashLeft = 0;
    stepAt = 0;
    lastSlot = 0;
    pickups = new PickupManager(this.scene);
    network!: NetworkGame;
    private captureSequence = 0;
    constructor() {
        const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.autoClear = false;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.scene.background = new THREE.Color(0xa9d6e4);
        this.scene.fog = new THREE.Fog(0xa9d6e4, 110, 260);
        this.hemisphere = new THREE.HemisphereLight(0xe9faff, 0x757565, 2.3);
        this.scene.add(this.hemisphere);
        this.sun = new THREE.DirectionalLight(0xfff1d4, 2.5);
        this.sun.position.set(40, 70, 25);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.camera.left = -85;
        this.sun.shadow.camera.right = 85;
        this.sun.shadow.camera.top = 85;
        this.sun.shadow.camera.bottom = -85;
        this.sun.shadow.camera.far = 200;
        this.sun.shadow.normalBias = .08;
        this.scene.add(this.sun);
        this.map = new ArenaMap(this.scene, mapById(this.settings.data.map));
        this.environment = new Environment(this.scene);
        this.environment.load(this.map.definition.id).then(() => { this.map.group.visible = !this.environment.ready; });
        this.applyPalette();
        this.player = new Player(this.camera);
        this.input = new InputManager(canvas);
        this.player.update(.001, this.input, this.map);
        this.spawns = new SpawnManager(this.map);
        for (let i = 0; i < 7; i++) {
            const bot = new Bot(i + 1, ['EMBER', 'CIRCUIT', 'MOSS', 'NOVA', 'ECHO', 'TANGO', 'PIXEL'][i], [0xe58057, 0x78bada, 0x87ad59, 0xa88ed4, 0xf0cd63, 0xe493b4, 0x5ebea4][i], this.scene);
            bot.position.copy(this.map.spawns[i + 1]);
            bot.sync(0);
            this.bots.push(bot);
        }
        this.nav = new BotNavigation(this.map);
        this.ais = this.bots.map(b => new BotAI(b, this.nav, this.map));
        this.bots.forEach((b, i) => b.equip(WEAPONS[PRIMARY[i % 4]]));
        this.viewmodel.camera.add(this.view);
        this.scene.add(this.camera);
        this.view.position.set(.34, -.3, -.45);
        this.effects = new ParticleManager(this.scene);
        this.view.add(this.flash);
        this.flash.position.set(0, .03, -.86);
        this.flash.visible = false;
        this.network = new NetworkGame(this);
        this.ui = new UI(this);
        this.applySettings();
        this.mainMenu();
        const invited = new URLSearchParams(location.search).get('room');
        if (invited) this.ui.multiplayer(invited);
        this.input.onCaptureLost = () => {
            if (this.running || this.input.mode === 'requesting') this.pause();
        };
        window.addEventListener('keydown', e => { if (e.code === 'Escape') {
            if (this.ui.dialog)
                this.ui.action('close');
            else if (this.running || this.input.mode === 'requesting')
                this.pause();
        } });
        window.addEventListener('blur', () => { if (this.running || this.input.mode === 'requesting')
            this.pause(); });
        window.addEventListener('resize', () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.viewmodel.resize(innerWidth / innerHeight); this.renderer.setSize(innerWidth, innerHeight); });
        let last = performance.now();
        this.renderer.setAnimationLoop(() => { const now = performance.now(), dt = Math.min((now - last) / 1000, .05); this.fps = THREE.MathUtils.lerp(this.fps, 1000 / Math.max(1, now - last), .04); last = now; this.tick(dt); if (this.ui.screen === 'menu' || this.ui.screen === 'quit') {
            this.menuTime += dt;
            this.camera.position.set(43 + Math.sin(this.menuTime * .055) * 7, 24, 57);
            this.camera.lookAt(-5, 2, -12);
            this.camera.fov = 62;
            this.camera.updateProjectionMatrix();
            this.view.visible = false;
        } this.viewmodel.render(this.renderer, this.scene, this.camera); this.ui.renderPreview(dt); this.input.endFrame(); });
    }
    get localBots() { return this.modeId === 'defuse' ? [...this.bots, ...this.tacticalBots] : this.bots; }
    get actors(): Actor[] { return this.network?.active ? this.network.actors : [this.player, ...this.localBots]; }
    get weapon() { return this.weapons.current; }
    /** Sky, fog and light colours belong to the map, so each arena reads differently. */
    private applyPalette() {
        const d = this.map.definition;
        (this.scene.background as THREE.Color).setHex(d.sky);
        const fog = this.scene.fog as THREE.Fog;
        fog.color.setHex(d.fog);
        fog.near = d.fogNear;
        fog.far = d.fogFar;
        this.hemisphere.color.setHex(d.hemi[0]);
        this.hemisphere.groundColor.setHex(d.hemi[1]);
        this.hemisphere.intensity = d.hemiIntensity;
        this.sun.color.setHex(d.sun);
        this.sun.intensity = d.sunIntensity;
    }
    /** Rebuilds the arena, its nav graph and the spawn points when another map is picked. */
    loadMap(id: string) {
        const definition = mapById(id);
        if (this.map.definition.id === definition.id)
            return;
        this.pickups.clear();
        this.map.dispose();
        this.map = new ArenaMap(this.scene, definition);
        this.environment.load(definition.id).then(() => { this.map.group.visible = !this.environment.ready; });
        this.applyPalette();
        this.spawns = new SpawnManager(this.map);
        this.nav = new BotNavigation(this.map);
        this.ais = this.bots.map(b => new BotAI(b, this.nav, this.map));
        this.tacticalAis = this.tacticalBots.map(b => new BotAI(b, this.nav, this.map));
        this.localBots.forEach((bot, i) => {
            bot.position.copy(this.map.spawns[(i + 1) % this.map.spawns.length]);
            bot.velocity.set(0, 0, 0);
            bot.protectedUntil = 0;
            bot.sync(0);
        });
        this.player.position.copy(this.map.spawns[0]);
        this.player.velocity.set(0, 0, 0);
        this.player.update(.001, this.input, this.map);
    }
    private ensureTacticalBots() {
        if (this.tacticalBots.length) return;
        for (const [id, name, color] of [[8, 'WARDEN', 0x5b88a7], [9, 'SHADE', 0xb48d58]] as const) {
            const bot = new Bot(id, name, color, this.scene);
            bot.equip(WEAPONS[PRIMARY[id % 4]]);
            bot.group.visible = false;
            this.tacticalBots.push(bot);
            this.tacticalAis.push(new BotAI(bot, this.nav, this.map));
        }
    }
    private resetDefuseActors() {
        const setup = this.map.definition.tactical;
        if (!setup) return;
        const offsets: Record<Team, number> = { attackers: 0, defenders: 0 };
        for (const actor of this.actors) {
            const team = this.defuseMode.team(actor)!;
            const indices = setup[team];
            const spawn = this.map.spawns[indices[offsets[team]++ % indices.length]];
            actor.position.copy(spawn);
            actor.velocity.set(0, 0, 0);
            actor.hp = 100; actor.alive = true; actor.crouched = false;
            actor.armor = 0; actor.helmet = false; actor.hasDefuseKit = false;
            actor.grounded = true; actor.protectedUntil = 0; actor.respawnAt = Infinity;
            if (actor instanceof Bot) { actor.weapon = new Weapon(actor.weapon.config); actor.sync(this.time); }
        }
        this.weapons.reset();
        // Defuse begins with a sidearm; a primary must be purchased each round.
        this.weapons.slots[0] = new Weapon(WEAPONS.knife);
        const side = this.defuseMode.team(this.player)!;
        const preference = this.loadout.get(side);
        this.weapons.slots[1] = new Weapon(WEAPONS[preference.startingPistol]);
        this.weapons.appearance = {
            knifeStyle: this.progress.unlockedKnife(preference.knifeStyle) ? preference.knifeStyle : 'classic',
            rifleSkin: this.progress.unlockedRifleSkin(preference.rifleSkin) ? preference.rifleSkin : 'standard',
            pistolSkin: this.progress.unlockedPistolSkin(preference.pistolSkin, preference.startingPistol) ? preference.pistolSkin : 'default',
            finish: this.settings.data.weaponSkins[this.weapons.slots[0].config.id],
        };
        this.weapons.slot = 1;
        this.weapons.primary = 'knife';
        this.recoilController.reset();
        this.buyOpen = false;
        [...this.ais, ...this.tacticalAis].forEach(ai => ai.reset());
        this.faceCenter();
    }
    siteAt(position: THREE.Vector3): BombSite | null {
        const sites = this.map.definition.tactical?.sites;
        if (!sites) return null;
        for (const site of ['A', 'B'] as const) {
            const [x, z, radius] = sites[site];
            if (Math.hypot(position.x - x, position.z - z) <= radius) return site;
        }
        return null;
    }
    sitePosition(site: BombSite) {
        const point = this.map.definition.tactical?.sites[site];
        return point ? new THREE.Vector3(point[0], 0, point[1]) : new THREE.Vector3();
    }
    inBuyZone() {
        const team = this.defuseMode.team(this.player);
        const indices = team && this.map.definition.tactical?.[team];
        return !!indices?.some(index => this.player.position.distanceTo(this.map.spawns[index]) <= 9);
    }
    buyContext() {
        const owned = new Set<string>();
        for (const weapon of this.weapons.slots) if (weapon.config.id !== 'knife') owned.add(weapon.config.id);
        if (this.player.armor >= 100) owned.add('vest');
        if (this.player.helmet) owned.add('helmet');
        if (this.player.hasDefuseKit) owned.add('kit');
        return { inZone: this.inBuyZone(), owned };
    }
    buyStatus(itemId: BuyItemId) {
        const team = this.defuseMode.team(this.player);
        return team ? this.buySystem.status(this.round, this.player.id, team, itemId, this.buyContext()) : 'WRONG SIDE';
    }
    buy(itemId: BuyItemId) {
        if (this.modeId !== 'defuse' || !this.player.alive) return false;
        const team = this.defuseMode.team(this.player);
        if (!team) return false;
        const item = this.buySystem.purchase(this.round, this.player.id, team, itemId, this.buyContext());
        if (!item) return false;
        if (item.weapon) {
            const definition = getWeapon(item.weapon);
            if (!definition) return false;
            const slot = definition.slot === 'secondary' ? 1 : 0;
            this.weapons.slots[slot] = new Weapon(WEAPONS[item.weapon]);
            if (slot === 0) this.weapons.primary = item.weapon;
            this.weapons.slot = slot;
            this.view.userData.appearance = '';
        }
        if (itemId === 'vest' || itemId === 'helmet') this.player.armor = 100;
        if (itemId === 'helmet') this.player.helmet = true;
        if (itemId === 'kit') this.player.hasDefuseKit = true;
        this.ui.notice((item.category === 'gear' ? t('buy.' + item.id) : item.label) + ' · $' + this.round.economy.balance(this.player.id));
        return true;
    }
    private updateBomb(dt: number) {
        if (this.modeId !== 'defuse' || !this.round.combatLive) return;
        const bomb = this.round.bomb;
        const playerTeam = this.defuseMode.team(this.player)!;
        const playerSite = this.siteAt(this.player.position);
        const held = this.player.alive && this.input.keys.has('KeyE');
        let interacting = false;
        if (held && playerSite && playerTeam === 'attackers') {
            interacting = bomb.carrierId === this.player.id;
            if (interacting) this.round.interactPlant(this.player.id, playerTeam, playerSite, dt);
        }
        if (held && playerSite && playerTeam === 'defenders' && playerSite === bomb.site) {
            interacting = true;
            this.round.interactDefuse(this.player.id, playerTeam, this.player.hasDefuseKit, dt, this.defuseMode.teams);
        }
        if (!interacting && (bomb.planterId === this.player.id || bomb.defuserId === this.player.id)) bomb.cancel();
        for (const bot of this.localBots) {
            if (!bot.alive) continue;
            const team = this.defuseMode.team(bot)!;
            const site = this.siteAt(bot.position);
            if (team === 'attackers' && bomb.carrierId === bot.id && site)
                this.round.interactPlant(bot.id, team, site, dt);
            if (team === 'defenders' && site && site === bomb.site && (bomb.state === 'planted' || bomb.state === 'defusing'))
                this.round.interactDefuse(bot.id, team, bot.hasDefuseKit, dt, this.defuseMode.teams);
        }
        if (bomb.planterId !== null && bomb.planterId !== this.player.id) {
            const planter = this.actors.find(a => a.id === bomb.planterId);
            if (!planter?.alive || this.siteAt(planter.position) !== bomb.site) bomb.cancel();
        }
        if (bomb.defuserId !== null && bomb.defuserId !== this.player.id) {
            const defuser = this.actors.find(a => a.id === bomb.defuserId);
            if (!defuser?.alive || this.siteAt(defuser.position) !== bomb.site) bomb.cancel();
        }
    }
    applySettings() { this.fov = this.settings.data.fov; this.audio.volume(); const q = this.settings.data.quality; this.renderer.setPixelRatio(q === 'low' ? 1 : Math.min(devicePixelRatio, q === 'high' ? 2 : 1.5)); this.renderer.shadowMap.enabled = q !== 'low'; this.scene.traverse(o => { if (o instanceof THREE.Mesh) {
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach(m => m.needsUpdate = true);
    } }); }
    faceCenter() { this.player.yaw = Math.atan2(this.player.position.x, this.player.position.z); this.player.pitch = 0; this.player.recoil = 0; this.player.update(.001, this.input, this.map); }
    start(online = false, mapId?: string, modeId: ModeId = 'ffa') {
        this.modeId = online ? 'ffa' : modeId;
        this.match.mode = this.modeId === 'defuse' ? this.defuseMode : new FreeForAllMode();
        if (this.modeId === 'defuse') this.ensureTacticalBots();
        if (!online) this.network.leave();
        if (this.network.host) this.network.newRound();
        this.running = false;
        this.input.suspend();
        this.audio.stopAll();
        this.audio.unlock();
        this.effects.clear();
        this.time = 0;
        this.stepAt = 0;
        this.loadMap(mapId ?? (this.settings.data.map === RANDOM_MAP_ID ? MAPS[Math.floor(Math.random() * MAPS.length)].id : this.settings.data.map));
        this.match.reset(this.actors);
        this.match.localId = this.player.id;
        this.buyOpen = false;
        if (this.modeId === 'ffa') {
            this.player.armor = 0; this.player.helmet = false; this.player.hasDefuseKit = false;
        }
        if (this.modeId === 'defuse') {
            this.defuseMode.assign(this.actors);
            this.round.start(this.actors.map(a => a.id), this.player.id);
        }
        for (const actor of this.actors) actor.alive = false;
        for (const actor of this.actors) this.spawns.respawn(actor, this.actors, this.time);
        // Locked cosmetics fall back to the default before the loadout is applied.
        if (!this.progress.unlockedKnife(this.settings.data.knifeStyle))
            this.settings.data.knifeStyle = 'classic';
        if (!this.progress.unlockedRifleSkin(this.settings.data.rifleSkin))
            this.settings.data.rifleSkin = 'standard';
        this.settings.save();
        this.weaponKills = {};
        this.lastXp = [];
        this.matchPlayerXp = 0;
        if (!this.network.guest && this.modeId === 'ffa') this.pickups.reset(this.map, this.nav);
        else this.pickups.clear();
        this.localBots.forEach(b => b.group.visible = !online);
        this.weapons.primary = this.settings.data.primary as WeaponId;
        this.weapons.appearance = { knifeStyle: this.settings.data.knifeStyle, rifleSkin: this.settings.data.rifleSkin,
            finish: this.settings.data.weaponSkins[this.weapons.primary] };
        this.inspect = 0;
        this.weapons.reset();
        this.recoilController.reset();
        this.view.userData.appearance = '';
        this.lastSlot = 0;
        [...this.ais, ...this.tacticalAis].forEach(ai => { ai.reset(); ai.bot.weapon = new Weapon(ai.bot.weapon.config); ai.bot.sync(0); ai.bot.group.visible = !online; });
        if (this.modeId === 'defuse') this.resetDefuseActors();
        this.faceCenter();
        this.ui.hitUntil = 0;
        this.ui.eliminationUntil = 0;
        this.ui.damageUntil = 0;
        this.ui.lastUpdate = -1;
        void this.captureAndPlay();
    }
    private async captureAndPlay() {
        const sequence = ++this.captureSequence;
        this.running = false;
        this.ui.show('playing');
        this.ui.setCaptureMode('requesting');
        // Do not let bots attack or the timer advance until controls are available.
        const result = await this.input.lock();
        if (result === 'cancelled' || sequence !== this.captureSequence) return;
        this.running = true;
        this.ui.setCaptureMode(this.input.mode);
        this.ui.update();
    }
    pause() {
        this.audio.cancelWeapon();
        ++this.captureSequence;
        this.running = false;
        this.input.suspend();
        this.ui.show('pause');
    }
    resume() { void this.captureAndPlay(); }
    mainMenu() {
        this.modeId = 'ffa';
        this.buyOpen = false;
        this.tacticalBots.forEach(b => b.group.visible = false);
        this.audio.stopAll();
        this.network?.leave();
        ++this.captureSequence;
        this.running = false;
        this.input.suspend();
        this.ui.show('menu');
        this.ui.menuLoadout();
        this.view.visible = false;
    }
    damage(victim: Actor, amount: number, source: Actor, head = false) { if (this.network.guest || !victim.alive || victim.protectedUntil > this.time || (this.modeId === 'defuse' && (!this.round.combatLive || !this.defuseMode.enemies(source, victim))))
        return;
        const armor = victim.armor ?? 0;
        const absorbed = armor > 0 && (!head || victim.helmet) ? Math.min(armor, amount * .5) : 0;
        victim.armor = armor - absorbed;
        victim.hp = Math.max(0, victim.hp - (amount - absorbed)); if (victim.id === this.player.id)
        this.ui.damageUntil = this.time + .25; if (victim.hp === 0) {
        victim.alive = false;
        this.effects.death(victim.position, victim.color);
        // Knife kills credit the actual blade in the feed, every other kill uses the weapon class.
        const weapon = source instanceof Bot ? (this.network.loadout(source)?.current.config.name ?? source.weapon.config.name) : this.weapon.config.melee ? weaponTitle('knife', this.weapons.appearance).split(' / ')[0] : this.weapon.config.name;
        this.match.kill(source, victim, weapon, this.time, head);
        if (this.network.host && source.id !== this.player.id) this.network.awardRemoteKill(source, victim);
        if (this.modeId === 'defuse') {
            this.round.economy.award(source.id, ECONOMY_RULES.killReward);
            if (this.round.bomb.carrierId === victim.id) {
                this.round.bomb.carrierId = this.actors.find(a => a.alive && this.defuseMode.team(a) === 'attackers')?.id ?? null;
            }
        }
        if (source.id === this.player.id && source.id !== victim.id) {
            const weaponId = this.weapon.config.id;
            this.weaponKills[weaponId] = (this.weaponKills[weaponId] ?? 0) + 1;
            const result = this.progress.awardKillXP(weaponId);
            const row = this.lastXp.find(entry => entry.weapon === result.weapon);
            if (row) { row.gained += result.gained; row.to = result.to; }
            else this.lastXp.push(result);
            this.matchPlayerXp += XP_PER_KILL;
            this.ui.xpEarned(result.weapon, XP_PER_KILL);
        }
        victim.respawnAt = this.modeId === 'defuse' ? Infinity : this.time + 3;
        if (source.id === this.player.id) {
            this.ui.eliminated(victim.name, source.streak);
            this.audio.kill();
        }
        if (victim.id === this.player.id) {
            this.audio.cancelWeapon();
            this.input.firing = false;
            this.input.aiming = false;
            this.ui.el('killer-label').textContent = t('hud.deathKiller', { name: source.name });
        }
    } }
    shootBot(bot: Bot, origin: THREE.Vector3, dir: THREE.Vector3) { if (!bot.weapon.shoot())
        return; const cfg = bot.weapon.config; this.audio.gunAt(cfg.id, origin, this.player.position, this.player.yaw); this.effects.emit(origin.clone().addScaledVector(dir, .8), 0xffd878, 2, 1, .07); for (let i = 0; i < cfg.pelletCount; i++) {
        const direction = dir.clone();
        if (cfg.pelletCount > 1)
            direction.add(new THREE.Vector3((Math.random() - .5) * cfg.spread, (Math.random() - .5) * cfg.spread, (Math.random() - .5) * cfg.spread)).normalize();
        const hit = trace(origin, direction, cfg.range, bot, this.actors, this.map);
        if (i === 0)
            this.effects.tracer(origin.clone().addScaledVector(dir, .7), hit.point);
        if (hit.actor)
            this.damage(hit.actor, cfg.damage * hit.multiplier * ((getWeapon(cfg.id)?.modelFamily ?? cfg.id) === 'shotgun' ? Math.max(.12, 1 - hit.distance / 42) : 1), bot, hit.part === 'head');
    } }
    shootPlayer() {
        // The knife is melee only: no hitscan, no projectile, nothing to throw.
        if (this.weapon.config.id === 'knife')
            return;
        if (!this.player.alive || this.weapons.switchLeft > 0 || !this.weapon.shoot())
            return;
        const cfg = this.weapon.config;
        const recoil = this.recoilController.next(cfg, this.time);
        this.kick = .1;
        this.inspect = 0;
        this.player.protectedUntil = 0;
        const base = this.camera.getWorldDirection(new THREE.Vector3());
        if (this.network.guest) {
            this.network.command('fire'); this.audio.gun(cfg.id); this.flashLeft = .05;
            this.player.recoil += recoil.pitch; this.player.yaw += recoil.yaw; return;
        }
        const spread = (this.input.aiming ? ((getWeapon(cfg.id)?.modelFamily ?? cfg.id) === 'sniper' ? .0003 : cfg.spread * .3) : cfg.spread) + (this.player.speed > 1 ? cfg.movementSpread : 0) + (!this.player.grounded ? cfg.jumpSpread : 0) + this.weapon.heat * .0007;
        this.audio.gun(cfg.id);
        this.flashLeft = .05;
        for (let i = 0; i < cfg.pelletCount; i++) {
            const dir = base.clone().add(new THREE.Vector3((Math.random() - .5) * spread, (Math.random() - .5) * spread, (Math.random() - .5) * spread)).normalize();
            const hit = trace(this.camera.position, dir, cfg.range, this.player, this.actors, this.map);
            if (this.network.host && i === 0) this.network.room.send({ type: 'shot', shooter: this.player.id, weapon: cfg.id, from: this.camera.position.toArray(), to: hit.point.toArray() });
            if (hit.actor && hit.actor.protectedUntil <= this.time) {
                const falloff = (getWeapon(cfg.id)?.modelFamily ?? cfg.id) === 'shotgun' ? Math.max(.12, 1 - hit.distance / 42) : 1;
                const damage = cfg.damage * hit.multiplier * falloff;
                this.damage(hit.actor, damage, this.player, hit.part === 'head');
                this.ui.hit(hit.part === 'head');
                this.audio.hit(hit.part === 'head');
                this.ui.damageNumber(damage, hit.point, hit.part === 'head');
                this.effects.emit(hit.point, hit.actor.color, 5);
            }
            else if (hit.distance < cfg.range)
                this.effects.impact(hit.point, dir);
        }
        this.player.recoil += recoil.pitch;
        this.player.yaw += recoil.yaw;
    }
    private handleWeaponInput() {
        if (this.weapon.config.id !== 'knife') {
            if (this.weapon.config.automatic ? this.input.firing || this.input.firePressed : this.input.firePressed)
                this.shootPlayer();
            return;
        }
        // Knife controls are a light and a heavy stab. Nothing here can leave the hand.
        if (this.input.firePressed || this.input.firing)
            this.meleeAttack('light');
        if (this.input.altFirePressed)
            this.meleeAttack('heavy');
    }
    /** Starts a stab. Blocked while the blade is still being drawn, so the switch has a real cost. */
    meleeAttack(kind: MeleeKind) {
        if (!this.player.alive || this.weapons.switching || !this.weapon.meleeAttack(kind))
            return false;
        this.inspect = 0;
        this.kick = kind === 'heavy' ? .05 : .024;
        this.player.protectedUntil = 0;
        this.audio.melee(kind);
        this.network.command(kind);
        return true;
    }
    /** Melee damage lands on the strike frame of the swing, so a stab can be out-run or traded. */
    resolveMelee() {
        if (this.network.guest) return;
        const weapon = this.weapon, profile = weapon.config.melee, kind = weapon.attack;
        if (!profile || !kind || weapon.landed || !this.player.alive)
            return;
        const attack = profile[kind];
        if (weapon.attackTime < attack.windup)
            return;
        weapon.landed = true;
        const direction = this.camera.getWorldDirection(new THREE.Vector3());
        const hit = trace(this.camera.position, direction, attack.range, this.player, this.actors, this.map);
        if (!hit.actor || hit.actor.protectedUntil > this.time)
            return;
        const backstab = this.isBackstab(hit.actor, direction);
        const damage = backstab ? attack.backstab : attack.damage;
        this.damage(hit.actor, damage, this.player, false);
        this.ui.hit(false, backstab);
        this.ui.damageNumber(damage, hit.point, false, backstab);
        this.audio.meleeHit(backstab);
        this.effects.emit(hit.point, backstab ? 0xf2575f : hit.actor.color, backstab ? 9 : 5, 2.6, backstab ? .09 : .07);
        this.player.recoil += kind === 'heavy' ? .022 : .01;
    }
    /** Same rule as CS2: a stab counts as a backstab when it lands while the victim faces away. */
    isBackstab(victim: Actor, direction: THREE.Vector3) {
        const flat = direction.clone().setY(0);
        if (flat.lengthSq() < 1e-6)
            return false;
        const forward = new THREE.Vector3(-Math.sin(victim.yaw), 0, -Math.cos(victim.yaw));
        return forward.dot(flat.normalize()) > .35;
    }
    updateView(dt: number) {
        const displayed = this.weapons.displayed;
        const cfg = displayed.config;
        if (this.view.userData.appearance !== appearanceKey(cfg.id, this.weapons.appearance)) {
            this.viewmodel.camera.remove(this.view);
            const requestedAppearance = appearanceKey(cfg.id, this.weapons.appearance);
            const loadSequence = ++this.viewLoadSeq;
            this.view = weaponModel(cfg.id, true, this.weapons.appearance);
            this.knifeAnimation = undefined;
            this.viewmodel.camera.add(this.view);
            void this.weaponAssets.loadView(cfg.id, this.weapons.appearance).then(asset => {
                if (!asset || loadSequence !== this.viewLoadSeq || this.view.userData.appearance !== requestedAppearance) return;
                asset.position.copy(this.view.position);
                asset.rotation.copy(this.view.rotation);
                this.viewmodel.camera.remove(this.view);
                this.view = asset;
                this.viewmodel.camera.add(this.view);
                this.view.add(this.flash);
                this.flash.position.fromArray(this.view.userData.muzzle);
                this.knifeAnimation = cfg.id === 'knife' ? new KnifeAnimationController(this.view) : undefined;
            });
            this.view.add(this.flash);
            this.viewId = cfg.id;
            this.flash.position.fromArray(this.view.userData.muzzle);
            this.inspect = 0;
        }
        this.flashLeft = Math.max(0, this.flashLeft - dt);
        this.flash.visible = this.flashLeft > 0;
        this.flash.rotation.z = Math.random() * Math.PI;
        const knife = cfg.id === 'knife';
        const reload = displayed.reloadLeft > 0 ? Math.sin(displayed.reloadLeft / cfg.reloadTime * Math.PI) : 0;
        this.kick *= Math.exp(-18 * dt);
        const aim = this.input.aiming && !knife;
        if (aim || reload > 0 || this.weapons.switchLeft > 0) this.inspect = 0;
        this.inspect = Math.max(0, this.inspect - dt);
        const inspect = this.inspect > 0 ? Math.sin(Math.min(1, this.inspect / .35) * Math.PI / 2) * Math.sin(Math.min(1, (2.5 - this.inspect) / .35) * Math.PI / 2) : 0;
        const pos = new THREE.Vector3((aim ? .015 : knife ? .18 : .29) - inspect * .15, (knife ? -.23 : -.27) + Math.sin(this.player.bob) * .012 + inspect * .02, (knife ? -.4 : -.46) - inspect * .22);
        const rot = new THREE.Vector3(this.kick * (knife ? .6 : 2) + inspect * .23, (knife ? -.48 : -.055) - this.input.dx * .0004 + inspect * .95, Math.sin(this.player.bob * .5) * .015 + (knife ? -.2 : 0) - inspect * .2);
        pos.z += this.kick - reload * .22;
        rot.x -= reload * .5;
        rot.z -= reload * .45;
        // Lower the old weapon before revealing the new grip; never spin the entire arm.
        if (this.weapons.holstering) {
            const t = (this.weapons.switchTotal - this.weapons.switchLeft) / this.weapons.holsterTime;
            const s = t * t * (3 - 2 * t);
            pos.y -= s * .55; pos.z += s * .12; rot.x -= s * .35;
        } else {
            const pose = drawPose(this.drawProgress(), knife);
            pos.add(new THREE.Vector3(pose[0], pose[1], pose[2]));
            rot.add(new THREE.Vector3(pose[3], pose[4], pose[5]));
        }
        // Swing: wind up, cut through the strike frame, then settle back into the idle pose.
        const swing = this.swingPose();
        if (swing) {
            pos.x += swing[0]; pos.y += swing[1]; pos.z += swing[2];
            rot.x += swing[3]; rot.y += swing[4]; rot.z += swing[5];
        }
        // The authored knife runs along local Z. Present its blade broadside
        // and keep the grip in the lower-right first-person view.
        if (knife && this.view.userData.assetPath) {
            pos.x += .05; pos.y += .15; pos.z -= .18; rot.y -= .7;
        }
        this.view.visible = this.player.alive && !(aim && (getWeapon(cfg.id)?.modelFamily ?? cfg.id) === 'sniper');
        this.view.position.copy(pos);
        this.view.rotation.set(rot.x, rot.y, rot.z);
        // Authored GLBs declare a ViewmodelAnchor; it shifts the whole model so
        // the grip sits in the hand without editing the procedural pose rig.
        const anchor = this.view.userData.viewmodelAnchor as [number, number, number] | undefined;
        if (anchor && this.view.userData.assetPath) this.view.position.add(new THREE.Vector3(anchor[0], anchor[1], anchor[2]));
        this.knifeAnimation?.update({ draw: this.drawProgress(), inspect, attack: this.weapon.attack, attackProgress: this.weapon.attackProgress });
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, aim ? cfg.scopeFov : this.fov, 1 - Math.exp(-14 * dt));
        this.camera.updateProjectionMatrix();
    }
    /** 0..1 progress of the running weapon switch; 1 when nothing is being drawn. */
    private drawProgress() { return this.weapons.switchTotal > 0 ? THREE.MathUtils.clamp(1 - this.weapons.switchLeft / (this.weapons.switchTotal - this.weapons.holsterTime), 0, 1) : 1; }
    /** Folding blades use their own opening sound; wrist motion stays within a natural range. */
    private foldingKnife() { return this.weapons.appearance.knifeStyle.startsWith('butterfly'); }
    /** Per-frame offsets for the running stab, or null when the blade is idle. */
    private swingPose() {
        const kind = this.weapon.attack, profile = this.weapon.config.melee;
        if (!kind || !profile)
            return null;
        const attack = profile[kind];
        const t = this.weapon.attackProgress;
        const strikeAt = THREE.MathUtils.clamp(attack.windup / attack.duration, .05, .95);
        const wind = easeOut(Math.min(1, t / strikeAt));
        const after = t <= strikeAt ? 0 : (t - strikeAt) / (1 - strikeAt);
        const cut = easeOut(after / .55);
        const home = easeOut((after - .55) / .45);
        const lean = wind - home, blow = cut - home;
        const rig = SWINGS[kind];
        return [0, 1, 2, 3, 4, 5].map(i => rig.wind[i] * lean + rig.cut[i] * blow);
    }
    tick(dt: number) {
        if (!this.running && !this.network.active)
            return;
        if (this.match.ended && this.ui.screen === 'results') return;
        const controls = this.running;
        if (!controls) this.input.clear();
        this.time += dt;
        if (this.modeId === 'defuse') {
            this.round.update(dt, new Map(this.actors.map(a => [a.id, a.alive])), this.defuseMode.teams);
            if (this.round.phase === 'end' && this.round.phaseLeft <= 0) {
                if (this.round.round === 6) this.defuseMode.assign(this.actors, 'defenders');
                const carrier = this.actors.find(a => this.defuseMode.team(a) === 'attackers')!.id;
                this.round.next(carrier);
                this.resetDefuseActors();
            }
        } else if (!this.network.guest) this.match.update(dt);
        if (this.match.ended) {
            this.running = false;
            ++this.captureSequence;
            this.input.suspend();
            this.audio.cancelWeapon();
            // Kill XP was already paid at the elimination; results only summarize this.lastXp.
            this.ui.show('results');
            return;
        }
        this.input.update(dt);
        if (this.modeId === 'defuse') {
            if (this.round.canBuy && this.input.pressed.has('KeyB')) this.buyOpen = !this.buyOpen;
            if (!this.round.canBuy) this.buyOpen = false;
            if (this.buyOpen) {
                const categories = ['pistols', 'smgs', 'rifles', 'snipers', 'shotguns', 'machine-guns', 'gear', 'grenades'];
                for (let i = 0; i < categories.length; i++)
                    if (this.input.pressed.has(`Digit${i + 1}`)) { this.buyCategory = categories[i]; this.buySelection = 0; }
                const items = BUY_ITEMS.filter(item => item.category === this.buyCategory);
                if (items.length && this.input.pressed.has('ArrowDown')) this.buySelection = (this.buySelection + 1) % items.length;
                if (items.length && this.input.pressed.has('ArrowUp')) this.buySelection = (this.buySelection - 1 + items.length) % items.length;
                if (this.input.pressed.has('Enter') && items[this.buySelection]) this.buy(items[this.buySelection].id);
            }
        }
        this.player.look(this.input, this.settings.data.sensitivity * (this.input.aiming && (getWeapon(this.weapon.config.id)?.modelFamily ?? this.weapon.config.id) === 'sniper' ? .35 : 1));
        if (this.modeId === 'defuse' && !this.round.combatLive) {
            this.updateView(dt);
            this.ui.update();
            this.effects.update(dt);
            return;
        }
        const n = Math.ceil(dt / (1 / 120));
        if (this.player.alive)
            for (let i = 0; i < n; i++)
                this.player.update(dt / n, this.input, this.map, this.weapon.config.movementSpeedMultiplier);
        this.weapons.update(dt);
        if (this.input.pressed.has('KeyF') && this.player.alive) this.inspect = this.inspect > 0 ? 0 : 2.5;
        for (let i = 0; i < 3; i++)
            if (!this.buyOpen && this.input.pressed.has(`Digit${i + 1}`))
                if (this.weapons.select(i)) this.network.command('switch', i);
        if (this.input.wheel)
            if (this.weapons.select((this.weapons.slot + Math.sign(this.input.wheel) + 3) % 3)) this.network.command('switch', this.weapons.slot);
        if (this.weapons.slot !== this.lastSlot) {
            this.lastSlot = this.weapons.slot;
            if (this.weapon.config.id === 'knife')
                this.audio.drawBlade(this.foldingKnife());
            else this.audio.drawWeapon(this.weapon.config.id);
        }
        this.handleWeaponInput();
        this.resolveMelee();
        if (this.player.alive && !this.weapons.switching && this.input.pressed.has('KeyR') && this.weapon.reload()) {
            this.audio.reload(this.weapon); this.network.command('reload');
        }
        this.audio.updateWeapon(this.weapon, this.player.alive);
        this.updateView(dt);
        for (const a of this.network.guest || this.modeId === 'defuse' ? [] : this.actors) {
            if (!a.alive && this.time >= a.respawnAt) {
                this.spawns.respawn(a, this.actors, this.time);
                if (a instanceof Bot) {
                    a.weapon = new Weapon(a.weapon.config);
                    if (this.network.host) this.network.loadout(a)?.reset();
                    else this.ais[a.id - 1].reset();
                }
                else {
                    this.weapons.reset();
                    this.faceCenter();
                }
            }
        }
        for (const ai of this.network.active ? [] : this.modeId === 'defuse' ? [...this.ais, ...this.tacticalAis] : this.ais) {
            const team = this.defuseMode.team(ai.bot);
            const objective = this.modeId !== 'defuse' ? undefined : team === 'attackers' ? this.sitePosition('A') : this.sitePosition(this.round.bomb.site ?? 'B');
            ai.update(dt, this.time, this.actors, (b, o, d) => this.shootBot(b, o, d), this.settings.data.difficulty,
                this.modeId === 'defuse' ? other => this.defuseMode.enemies(ai.bot, other) : undefined, objective);
        }
        if (!this.network.active) this.localBots.forEach(b => b.sync(this.time));
        this.updateBomb(dt);
        this.network.update(dt);
        if (this.network.guest) this.pickups.animate(this.time);
        else if (this.modeId === 'ffa') this.pickups.update(this.time, this.actors, a => this.network.loadout(a)?.slots ?? (a instanceof Bot ? [a.weapon] : this.weapons.slots), (a, kind, amount) => {
            if (a === this.player) { this.ui.notice(t('pickup.' + kind, { n: amount })); this.audio.ui(); }
            else this.network.pickup(a, kind, amount);
        });
        this.ui.update();
        this.effects.update(dt);
        if (this.player.alive && this.player.grounded && this.player.speed > 2 && this.time > this.stepAt) {
            this.stepAt = this.time + (this.player.crouched ? .5 : .32);
            this.audio.footstep();
        }
        if (this.player.alive && this.input.pressed.has('Space'))
            this.audio.jump();
    }
}
