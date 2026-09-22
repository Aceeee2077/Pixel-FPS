import * as THREE from 'three';
import { ArenaMap } from '../world/Map';
import { MAPS, RANDOM_MAP_ID, mapById } from '../world/Maps';
import { Player } from '../player/Player';
import { InputManager } from './InputManager';
import { Weapon } from '../weapons/Weapon';
import { WEAPONS, PRIMARY, WeaponId, MeleeKind } from '../weapons/WeaponConfig';
import { WeaponManager } from '../weapons/WeaponManager';
import { weaponModel } from '../weapons/WeaponModel';
import { appearanceKey, weaponTitle } from '../weapons/WeaponAppearance';
import { Bot, Actor } from '../bots/Bot';
import { trace } from '../game/Combat';
import { SpawnManager } from '../world/SpawnManager';
import { BotNavigation } from '../bots/BotNavigation';
import { BotAI } from '../bots/BotAI';
import { MatchManager } from '../game/MatchManager';
import { Settings } from './Settings';
import { UI } from '../ui/UI';
import { AudioManager } from '../audio/AudioManager';
import { ParticleManager } from '../effects/ParticleManager';
import { MatchXp, Progress, matchXp } from './Progress';

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
    map: ArenaMap;
    player: Player;
    input: InputManager;
    running = false;
    time = 0;
    bots: Bot[] = [];
    weapons = new WeaponManager();
    view = weaponModel('rifle', true);
    kick = 0;
    inspect = 0;
    viewId: WeaponId = 'rifle';
    fov = 90;
    spawns!: SpawnManager;
    nav!: BotNavigation;
    ais: BotAI[] = [];
    match = new MatchManager();
    settings = new Settings();
    ui!: UI;
    menuTime = 0;
    fps = 60;
    audio = new AudioManager(this.settings);
    progress = new Progress();
    weaponKills: Partial<Record<WeaponId, number>> = {};
    lastXp: MatchXp[] = [];
    private hemisphere!: THREE.HemisphereLight;
    private sun!: THREE.DirectionalLight;
    effects!: ParticleManager;
    flash = new THREE.Mesh(new THREE.OctahedronGeometry(.085), new THREE.MeshBasicMaterial({ color: 0xffe18a }));
    flashLeft = 0;
    stepAt = 0;
    lastSlot = 0;
    private captureSequence = 0;
    constructor() {
        const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        this.renderer.setSize(innerWidth, innerHeight);
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
        this.camera.add(this.view);
        this.scene.add(this.camera);
        this.view.position.set(.34, -.3, -.45);
        this.effects = new ParticleManager(this.scene);
        this.view.add(this.flash);
        this.flash.position.set(0, .03, -.86);
        this.flash.visible = false;
        this.ui = new UI(this);
        this.applySettings();
        this.mainMenu();
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
        window.addEventListener('resize', () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); });
        let last = performance.now();
        this.renderer.setAnimationLoop(() => { const now = performance.now(), dt = Math.min((now - last) / 1000, .05); this.fps = THREE.MathUtils.lerp(this.fps, 1000 / Math.max(1, now - last), .04); last = now; this.tick(dt); if (this.ui.screen === 'menu' || this.ui.screen === 'quit') {
            this.menuTime += dt;
            this.camera.position.set(43 + Math.sin(this.menuTime * .055) * 7, 24, 57);
            this.camera.lookAt(-5, 2, -12);
            this.camera.fov = 62;
            this.camera.updateProjectionMatrix();
            this.view.visible = false;
        } this.renderer.render(this.scene, this.camera); this.ui.renderPreview(dt); this.input.endFrame(); });
    }
    get actors(): Actor[] { return [this.player, ...this.bots]; }
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
        this.map.dispose();
        this.map = new ArenaMap(this.scene, definition);
        this.applyPalette();
        this.spawns = new SpawnManager(this.map);
        this.nav = new BotNavigation(this.map);
        this.ais = this.bots.map(b => new BotAI(b, this.nav, this.map));
        this.bots.forEach((bot, i) => {
            bot.position.copy(this.map.spawns[(i + 1) % this.map.spawns.length]);
            bot.velocity.set(0, 0, 0);
            bot.protectedUntil = 0;
            bot.sync(0);
        });
        this.player.position.copy(this.map.spawns[0]);
        this.player.velocity.set(0, 0, 0);
        this.player.update(.001, this.input, this.map);
    }
    applySettings() { this.fov = this.settings.data.fov; this.audio.volume(); const q = this.settings.data.quality; this.renderer.setPixelRatio(q === 'low' ? 1 : Math.min(devicePixelRatio, q === 'high' ? 2 : 1.5)); this.renderer.shadowMap.enabled = q !== 'low'; this.scene.traverse(o => { if (o instanceof THREE.Mesh) {
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach(m => m.needsUpdate = true);
    } }); }
    faceCenter() { this.player.yaw = Math.atan2(this.player.position.x, this.player.position.z); this.player.pitch = 0; this.player.recoil = 0; this.player.update(.001, this.input, this.map); }
    start() {
        this.running = false;
        this.input.suspend();
        this.audio.unlock();
        this.effects.clear();
        this.time = 0;
        this.stepAt = 0;
        this.match.reset(this.actors);
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
        this.loadMap(this.settings.data.map === RANDOM_MAP_ID ? MAPS[Math.floor(Math.random() * MAPS.length)].id : this.settings.data.map);
        this.weapons.primary = this.settings.data.primary as WeaponId;
        this.weapons.appearance = { knifeStyle: this.settings.data.knifeStyle, rifleSkin: this.settings.data.rifleSkin };
        this.inspect = 0;
        this.weapons.reset();
        this.lastSlot = 0;
        this.ais.forEach(ai => { ai.reset(); ai.bot.weapon = new Weapon(ai.bot.weapon.config); ai.bot.sync(0); });
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
        ++this.captureSequence;
        this.running = false;
        this.input.suspend();
        this.ui.show('pause');
    }
    resume() { void this.captureAndPlay(); }
    mainMenu() {
        ++this.captureSequence;
        this.running = false;
        this.input.suspend();
        this.ui.show('menu');
        this.ui.menuLoadout();
        this.view.visible = false;
    }
    damage(victim: Actor, amount: number, source: Actor, head = false) { if (!victim.alive || victim.protectedUntil > this.time)
        return; victim.hp = Math.max(0, victim.hp - amount); if (victim.id === 0)
        this.ui.damageUntil = this.time + .25; if (victim.hp === 0) {
        victim.alive = false;
        this.effects.death(victim.position, victim.color);
        // Knife kills credit the actual blade in the feed, every other kill uses the weapon class.
        const weapon = source instanceof Bot ? source.weapon.config.name : this.weapon.config.melee ? weaponTitle('knife', this.weapons.appearance).split(' / ')[0] : this.weapon.config.name;
        this.match.kill(source, victim, weapon, this.time, head);
        if (source.id === 0)
            this.weaponKills[this.weapon.config.id] = (this.weaponKills[this.weapon.config.id] ?? 0) + 1;
        victim.respawnAt = this.time + 3;
        if (source.id === 0) {
            this.ui.eliminated(victim.name, source.streak);
            this.audio.kill();
        }
        if (victim.id === 0) {
            this.input.firing = false;
            this.input.aiming = false;
            this.ui.el('killer-label').textContent = `${source.name} got the last shot.`;
        }
    } }
    /** Turns the finished match into weapon XP; the results screen renders what came back. */
    private awardMatchXp() {
        const won = this.match.rank(this.actors)[0]?.id === 0;
        return matchXp(this.weapons.primary, this.weaponKills, won).map(row => this.progress.award(row.weapon, row.xp));
    }
    shootBot(bot: Bot, origin: THREE.Vector3, dir: THREE.Vector3) { if (!bot.weapon.shoot())
        return; const cfg = bot.weapon.config; this.audio.gun(cfg.id, origin.distanceTo(this.player.position), Math.sin(Math.atan2(origin.x - this.player.position.x, origin.z - this.player.position.z) - this.player.yaw)); this.effects.emit(origin.clone().addScaledVector(dir, .8), 0xffd878, 2, 1, .07); for (let i = 0; i < cfg.pelletCount; i++) {
        const direction = dir.clone();
        if (cfg.pelletCount > 1)
            direction.add(new THREE.Vector3((Math.random() - .5) * cfg.spread, (Math.random() - .5) * cfg.spread, (Math.random() - .5) * cfg.spread)).normalize();
        const hit = trace(origin, direction, cfg.range, bot, this.actors, this.map);
        if (i === 0)
            this.effects.tracer(origin.clone().addScaledVector(dir, .7), hit.point);
        if (hit.actor)
            this.damage(hit.actor, cfg.damage * hit.multiplier * (cfg.id === 'shotgun' ? Math.max(.12, 1 - hit.distance / 42) : 1), bot, hit.part === 'head');
    } }
    shootPlayer() {
        // The knife is melee only: no hitscan, no projectile, nothing to throw.
        if (this.weapon.config.id === 'knife')
            return;
        if (!this.player.alive || this.weapons.switchLeft > 0 || !this.weapon.shoot())
            return;
        const cfg = this.weapon.config;
        this.kick = .1;
        this.inspect = 0;
        this.player.protectedUntil = 0;
        const base = this.camera.getWorldDirection(new THREE.Vector3());
        const spread = (this.input.aiming ? (cfg.id === 'sniper' ? .0003 : cfg.spread * .3) : cfg.spread) + (this.player.speed > 1 ? cfg.movementSpread : 0) + (!this.player.grounded ? cfg.jumpSpread : 0) + this.weapon.heat * .0007;
        this.audio.gun(cfg.id);
        this.flashLeft = .05;
        for (let i = 0; i < cfg.pelletCount; i++) {
            const dir = base.clone().add(new THREE.Vector3((Math.random() - .5) * spread, (Math.random() - .5) * spread, (Math.random() - .5) * spread)).normalize();
            const hit = trace(this.camera.position, dir, cfg.range, this.player, this.actors, this.map);
            if (hit.actor && hit.actor.protectedUntil <= this.time) {
                const falloff = cfg.id === 'shotgun' ? Math.max(.12, 1 - hit.distance / 42) : 1;
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
        this.player.recoil += cfg.recoil * (1 + this.weapon.heat * .12);
        this.player.yaw += Math.sin(this.weapon.ammo * 1.9) * cfg.horizontalRecoil;
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
        return true;
    }
    /** Melee damage lands on the strike frame of the swing, so a stab can be out-run or traded. */
    resolveMelee() {
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
    private isBackstab(victim: Actor, direction: THREE.Vector3) {
        const flat = direction.clone().setY(0);
        if (flat.lengthSq() < 1e-6)
            return false;
        const forward = new THREE.Vector3(-Math.sin(victim.yaw), 0, -Math.cos(victim.yaw));
        return forward.dot(flat.normalize()) > .35;
    }
    updateView(dt: number) {
        const cfg = this.weapon.config;
        if (this.view.userData.appearance !== appearanceKey(cfg.id, this.weapons.appearance)) {
            this.camera.remove(this.view);
            this.view = weaponModel(cfg.id, true, this.weapons.appearance);
            this.camera.add(this.view);
            this.view.add(this.flash);
            this.viewId = cfg.id;
            this.flash.position.fromArray(this.view.userData.muzzle);
            this.inspect = 0;
        }
        this.flashLeft = Math.max(0, this.flashLeft - dt);
        this.flash.visible = this.flashLeft > 0;
        this.flash.rotation.z = Math.random() * Math.PI;
        const knife = cfg.id === 'knife';
        const reload = this.weapon.reloadLeft > 0 ? Math.sin(this.weapon.reloadLeft / cfg.reloadTime * Math.PI) : 0;
        this.kick *= Math.exp(-18 * dt);
        const aim = this.input.aiming && !knife;
        if (aim || reload > 0 || this.weapons.switchLeft > 0) this.inspect = 0;
        this.inspect = Math.max(0, this.inspect - dt);
        const inspect = this.inspect > 0 ? Math.sin(Math.min(1, this.inspect / .35) * Math.PI / 2) * Math.sin(Math.min(1, (2.5 - this.inspect) / .35) * Math.PI / 2) : 0;
        const pos = new THREE.Vector3((aim ? .015 : knife ? .32 : .29) - inspect * .15, (knife ? -.23 : -.27) + Math.sin(this.player.bob) * .012 + inspect * .02, (knife ? -.4 : -.46) - inspect * .22);
        const rot = new THREE.Vector3(this.kick * (knife ? .6 : 2) + inspect * .23, (knife ? -.48 : -.055) - this.input.dx * .0004 + inspect * .95, Math.sin(this.player.bob * .5) * .015 + (knife ? -.2 : 0) - inspect * .2);
        pos.z += this.kick - reload * .22;
        rot.x -= reload * .5;
        rot.z -= reload * .45;
        // Deployment: the weapon rises from below the frame; knives flip open on the way up.
        const raised = easeOut(this.drawProgress());
        pos.y -= (1 - raised) * (knife ? .5 : .42);
        pos.x += (1 - raised) * (knife ? .1 : .03);
        rot.x -= (1 - raised) * (knife ? .5 : .38);
        rot.y += (1 - raised) * (knife ? .5 : .12);
        if (knife) {
            rot.z -= (1 - raised) * 1.3;
            rot.z += (1 - raised) * this.knifeFlourish();
        }
        // Swing: wind up, cut through the strike frame, then settle back into the idle pose.
        const swing = this.swingPose();
        if (swing) {
            pos.x += swing[0]; pos.y += swing[1]; pos.z += swing[2];
            rot.x += swing[3]; rot.y += swing[4]; rot.z += swing[5];
        }
        this.view.visible = this.player.alive && !(aim && cfg.id === 'sniper');
        this.view.position.copy(pos);
        this.view.rotation.set(rot.x, rot.y, rot.z);
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, aim ? cfg.scopeFov : this.fov, 1 - Math.exp(-14 * dt));
        this.camera.updateProjectionMatrix();
    }
    /** 0..1 progress of the running weapon switch; 1 when nothing is being drawn. */
    private drawProgress() { return this.weapons.switchTotal > 0 ? THREE.MathUtils.clamp(1 - this.weapons.switchLeft / this.weapons.switchTotal, 0, 1) : 1; }
    /** Flick knives spin all the way open, fixed blades just snap up. */
    private knifeFlourish() { const style = this.weapons.appearance.knifeStyle; return style === 'classic' || style === 'm9-ruby' ? .95 : Math.PI * 2; }
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
        if (!this.running)
            return;
        this.time += dt;
        this.match.update(dt);
        if (this.match.ended) {
            this.running = false;
            ++this.captureSequence;
            this.input.suspend();
            this.lastXp = this.awardMatchXp();
            this.ui.show('results');
            return;
        }
        this.input.update(dt);
        this.player.look(this.input, this.settings.data.sensitivity * (this.input.aiming && this.weapon.config.id === 'sniper' ? .35 : 1));
        const n = Math.ceil(dt / (1 / 120));
        if (this.player.alive)
            for (let i = 0; i < n; i++)
                this.player.update(dt / n, this.input, this.map, this.weapon.config.movementSpeedMultiplier);
        this.weapons.update(dt);
        if (this.input.pressed.has('KeyF') && this.player.alive) this.inspect = this.inspect > 0 ? 0 : 2.5;
        for (let i = 0; i < 3; i++)
            if (this.input.pressed.has(`Digit${i + 1}`))
                this.weapons.select(i);
        if (this.input.wheel)
            this.weapons.select((this.weapons.slot + Math.sign(this.input.wheel) + 3) % 3);
        if (this.weapons.slot !== this.lastSlot) {
            this.lastSlot = this.weapons.slot;
            if (this.weapon.config.id === 'knife')
                this.audio.drawBlade(this.knifeFlourish() > 1);
        }
        this.handleWeaponInput();
        this.resolveMelee();
        if (this.player.alive && this.input.pressed.has('KeyR') && this.weapon.reload())
            this.audio.reload();
        this.updateView(dt);
        for (const a of this.actors) {
            if (!a.alive && this.time >= a.respawnAt) {
                this.spawns.respawn(a, this.actors, this.time);
                if (a instanceof Bot) {
                    a.weapon = new Weapon(a.weapon.config);
                    this.ais[a.id - 1].reset();
                }
                else {
                    this.weapons.reset();
                    this.faceCenter();
                }
            }
        }
        for (const ai of this.ais)
            ai.update(dt, this.time, this.actors, (b, o, d) => this.shootBot(b, o, d), this.settings.data.difficulty);
        this.bots.forEach(b => b.sync(this.time));
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
