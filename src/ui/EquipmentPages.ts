import type { Game } from '../core/Game';
import type { UI } from './UI';
import { ArmoryPreview } from './ArmoryPreview';
import { getWeapon, weaponCategories, weaponRegistry, type WeaponCategory } from '../data/weapons';
import { loadoutSlotLabels, type LoadoutSlot, type TeamSide } from '../core/Loadout';
import { KNIVES, RIFLE_SKINS, PISTOL_SKINS, type KnifeStyle, type RifleSkin, type PistolSkin } from '../weapons/WeaponAppearance';
import { KNIFE_UNLOCKS, RIFLE_UNLOCKS, PISTOL_UNLOCKS } from '../core/Progress';
import { applyCrop, skinCrop, subjectCrop, type Crop } from './ReferenceArt';
import { skinById, skinsFor } from '../weapons/WeaponSkins';
import { finishName, knifeName, t } from '../core/I18n';
import { COLLECTION_ITEMS, collectionItem } from '../data/collectionItems';

type Page = 'armory' | 'loadout' | 'collection';
type Filter = 'all' | 'equipped' | 'owned' | 'locked';
const categoryName = (category: WeaponCategory) => t('category.' + category);
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]!);

export class EquipmentPages {
    page: Page = 'armory';
    category: WeaponCategory = 'rifles';
    selectedId = 'm4a4';
    side: TeamSide = 'attackers';
    drawer: LoadoutSlot | null = null;
    filter: Filter = 'all';
    search = '';
    /** null = follow the weapon: the authored GLB when one exists, else the reference. */
    show3D: boolean | null = null;
    collectionId = 'classic';
    collection3D = true;
    private preview?: ArmoryPreview;
    constructor(private game: Game, private ui: UI) {}
    private armoryUses3D() {
        const weapon = getWeapon(this.selectedId);
        return !!weapon?.modelPath && (this.show3D ?? !weapon.referenceImage);
    }
    show(page: Page) {
        this.page = page;
        this.ui.dialog = page;
        this.ui.el('dialog').classList.remove('hidden');
        this.render();
    }
    renderPreview(dt: number) {
        if ((this.ui.dialog === 'armory' && this.armoryUses3D()) || (this.ui.dialog === 'collection' && this.collection3D)) this.preview?.render(dt);
    }
    private tabs() {
        return '<div class="equipment-tabs">' + (['armory','loadout','collection'] as const)
            .map(page => '<button data-equip-page="' + page + '" class="' + (this.page === page ? 'selected' : '') + '">' + t('nav.' + page) + '</button>').join('') + '</div>';
    }
    /**
     * Reference art is a 1254x1254 studio render, so it is cropped to the
     * measured subject band before display. Raw ``src`` is kept in ``data-raw``
     * so the crop can be re-applied after any re-render.
     */
    private image(src: string | null, name: string, crop?: Crop, aspect = 2.1) {
        if (!src) return '<span class="missing-art"><strong>' + esc(name) + '</strong><small>' + t('equipment.previewFallback') + '</small></span>';
        // The reference render is a square with a wide margin, so the subject is
        // centred on load with object-fit:cover. ReferenceArt.ts then refines it
        // with a canvas crop plus letterboxing, and the inline style drops away.
        let style = '';
        if (crop) {
            const centreY = (crop[1] + crop[3] / 2) * 100;
            const centreX = (crop[0] + crop[2] / 2) * 100;
            style = ' style="object-fit:cover;object-position:' + centreX.toFixed(1) + '% '
                + centreY.toFixed(1) + '%"';
        }
        const attrs = ' src="' + esc(src) + '" alt="' + esc(name) + '"'
            + ' data-raw="' + esc(src) + '"'
            + (crop ? ' data-crop="' + crop.join(',') + '" data-crop-aspect="' + aspect + '"' : '')
            + style + ' loading="lazy"';
        return '<img' + attrs + '>';
    }
    /** Apply pending crops after the dialog HTML is in the DOM. */
    private cropArt(host: HTMLElement) {
        host.querySelectorAll<HTMLImageElement>('img[data-crop]').forEach(element => {
            const values = (element.dataset.crop ?? '').split(',').map(Number);
            if (values.length !== 4 || values.some(Number.isNaN)) return;
            const aspect = Number(element.dataset.cropAspect ?? 2.1) || 2.1;
            applyCrop(element, values as unknown as Crop, aspect);
        });
    }
    private equipped(id: string) {
        if (this.game.settings.data.primary === id) return true;
        return (['attackers','defenders'] as const).some(side => {
            const row = this.game.loadout.get(side);
            return [row.startingPistol,row.preferredRifle,row.alternativeRifle,row.preferredSmg,row.preferredSniper].includes(id);
        });
    }
    private cosmeticStyles(id: string): KnifeStyle[] {
        if (id === 'knife') return ['classic'];
        if (id === 'butterfly') return ['butterfly-fade', 'butterfly-emerald'];
        if (id === 'karambit') return ['karambit-emerald'];
        if (id === 'm9') return ['m9-ruby'];
        return [];
    }
    private cosmeticMatches(id: string, locked: boolean) {
        const progress = this.game.progress;
        const styles = this.cosmeticStyles(id);
        if (styles.length) return styles.some(style => progress.unlockedKnife(style) !== locked);
        if (id === 'm4a4') return locked ? !progress.unlockedRifleSkin('asimov') : true;
        if (getWeapon(id)?.category === 'pistols') return locked ? !progress.unlockedPistolSkin('copper', id) : true;
        return false;
    }
    private weaponCard(id: string) {
        const weapon = getWeapon(id)!;
        const progress = this.game.progress.get(id);
        const skin = weapon.category === 'melee' ? this.game.settings.data.knifeStyle : weapon.id === 'm4a4' ? this.game.settings.data.rifleSkin : weapon.category === 'pistols' ? this.game.loadout.get(this.side).pistolSkin : 'default';
        const skinLabel = weapon.category === 'melee' ? knifeName(skin, skin)
            : weapon.id === 'm4a4' ? finishName(skin, skin)
            : weapon.category === 'pistols' ? t('pistolFinish.' + skin) : t('equipment.original');
        const authored = weapon.modelStatus === 'final' && !!weapon.modelPath;
        const art = weapon.referenceImage ? '<span class="card-badge">' + t('equipment.reference') + '</span>'
            : authored ? '<span class="card-badge is-3d">' + t('equipment.preview3d') + '</span>' : '';
        return '<button class="catalog-card" data-catalog-weapon="' + weapon.id + '">'
          + '<span class="catalog-image">' + this.image(weapon.previewImage, weapon.displayName, weapon.referenceImage ? subjectCrop(id) : undefined) + art + '</span>'
          + '<strong title="' + esc(weapon.displayName) + '">' + esc(weapon.displayName) + '</strong>'
          + '<small>' + categoryName(weapon.category) + ' · $' + weapon.price + '</small>'
          + '<span class="catalog-stats">' + t('equipment.damage') + ' ' + weapon.config.damage + ' · ' + t('equipment.magazine') + ' ' + weapon.config.magazineSize + ' · RPM ' + weapon.config.fireRate + '</span>'
          + '<span class="catalog-stats">LV ' + progress.level + ' · ' + progress.xp + ' XP · ' + (progress.kills ?? 0) + ' ' + t('equipment.kills') + '</span>'
          + '<span class="catalog-stats dim">' + (this.equipped(id) ? t('equipment.equipped') + ' · ' : '') + t('equipment.skin') + ' ' + esc(skinLabel) + '</span></button>';
    }
    /**
     * Owner-supplied model variants for one weapon. Each is a complete model, so
     * choosing one swaps the mesh rather than tinting an existing material.
     */
    private finishPicker(weaponId: string) {
        const skins = skinsFor(weaponId);
        if (!skins.length) return '';
        const equipped = this.game.settings.data.weaponSkins[weaponId];
        const buttons = skins.map(skin => '<button data-finish="' + esc(skin.key) + '" data-finish-weapon="'
            + esc(weaponId) + '" class="' + (equipped === skin.key ? 'selected' : '')
            + '">' + esc(skin.label) + '</button>').join('');
        const active = skins.find(skin => skin.key === equipped);
        const credit = active
            ? '<small class="finish-credit">模型：' + esc(active.credit) + ' · ' + esc(active.licence) + '</small>'
            : '';
        return '<div class="finish-picker"><span>' + t('equipment.finish') + '</span>'
            + '<div class="finish-buttons"><button data-finish="" data-finish-weapon="' + esc(weaponId)
            + '" class="' + (!equipped ? 'selected' : '') + '">' + t('equipment.original') + '</button>' + buttons + '</div>'
            + credit + '</div>';
    }
    /**
     * Applying a finish has to update the shared appearance too, because the
     * first-person rig reloads on `appearanceKey` and a butterfly variant changes
     * which knife body exists at all.
     */
    private applyFinish(weaponId: string, key: string) {
        const skin = key ? skinById(weaponId, key) : undefined;
        if (skin) this.game.settings.data.weaponSkins[weaponId] = skin.key;
        else delete this.game.settings.data.weaponSkins[weaponId];
        if (skin?.knifeStyle) this.game.settings.data.knifeStyle = skin.knifeStyle;
        this.game.settings.save();
        this.game.weapons.appearance = {
            ...this.game.weapons.appearance,
            knifeStyle: this.game.settings.data.knifeStyle,
            finish: skin?.key,
        };
        // Force the view rig to rebuild the viewmodel with the chosen model.
        this.game.view.userData.appearance = '';
        this.render();
    }
    private armory() {
        const selected = getWeapon(this.selectedId) ?? weaponRegistry[0];
        const progress = this.game.progress.get(selected.id);
        // Manual choice wins; otherwise prefer the reference render, because the
        // 3D button would otherwise silently show the procedural fallback for a
        // weapon whose GLB has not been published yet.
        const show3D = this.armoryUses3D();
        const list = weaponRegistry.filter(weapon => weapon.category === this.category
          && weapon.displayName.toLowerCase().includes(this.search.toLowerCase())
          && (this.filter === 'all' || this.filter === 'equipped' && this.equipped(weapon.id)
              || this.filter === 'owned' && this.cosmeticMatches(weapon.id, false)
              || this.filter === 'locked' && this.cosmeticMatches(weapon.id, true)));
        const reference = !show3D;
        const stage = reference
          ? '<div class="catalog-reference">' + this.image(selected.previewImage, selected.displayName, selected.referenceImage ? subjectCrop(selected.id) : undefined) + '</div>'
          : '<div id="armory-canvas" class="catalog-canvas"></div>';
        // Only armory buttons carry data-viewer: the collection tab uses
        // data-collection-viewer, so test and UI selectors stay unambiguous.
        const viewerButtons = '<div class="viewer-switch">'
          + '<button data-viewer="reference" ' + (reference ? 'class="selected"' : '')
          + '>' + t('equipment.reference') + '</button>'
          + '<button data-viewer="3d" ' + (show3D ? 'class="selected"' : '') + (selected.modelPath ? '' : ' disabled')
          + '>' + t('equipment.preview3d') + '</button>'
          + '<span class="viewer-hint">' + (show3D ? t('equipment.previewDrag') : '') + '</span></div>';
        return '<div class="equipment-head"><h2>' + t('nav.armory') + '</h2><p>' + t('equipment.browseHint') + '</p></div>'
          + '<div class="catalog-layout"><aside class="catalog-categories">' + weaponCategories.map(category =>
              '<button data-catalog-category="' + category + '" class="' + (this.category === category ? 'selected' : '') + '">' + categoryName(category) + '</button>').join('') + '</aside>'
          + '<section class="catalog-main"><div class="catalog-tools"><input id="catalog-search" data-catalog-search placeholder="' + t('equipment.search') + '" value="' + esc(this.search) + '">'
          + '<select data-catalog-filter>' + (['all','equipped','owned','locked'] as const).map(key => '<option value="' + key + '" ' + (this.filter === key ? 'selected' : '') + '>' + t('equipment.' + (key === 'locked' ? 'lockedCosmetics' : key)) + '</option>').join('') + '</select></div>'
          + '<div class="catalog-feature"><div class="catalog-stage">' + stage + viewerButtons + '</div>'
          + '<div class="catalog-detail"><small>' + categoryName(selected.category) + '</small><h3>' + esc(selected.displayName) + '</h3><b>$' + selected.price + '</b>'
          + '<p>' + t('equipment.damage') + ' ' + selected.config.damage + ' · ' + t('equipment.magazine') + ' ' + selected.config.magazineSize + ' · RPM ' + selected.config.fireRate + '</p>'
          + '<p>' + t('equipment.range') + ' ' + selected.config.range + ' · ' + t('equipment.mobility') + ' ' + selected.config.movementSpeedMultiplier.toFixed(2) + ' · ' + t('equipment.armorPen') + ' ' + Math.round(selected.armorPenetration * 100) + '%</p>'
          + '<p>' + t('equipment.weaponLevel') + ' ' + progress.level + ' · ' + progress.xp + ' / ' + this.game.progress.cost(selected.id) + ' XP · ' + (progress.kills ?? 0) + ' ' + t('equipment.kills') + '</p>'
          + this.finishPicker(selected.id)
          + '</div></div>'
          + '<h3>' + categoryName(this.category) + ' · ' + list.length + '</h3><div class="catalog-grid">' + list.map(weapon => this.weaponCard(weapon.id)).join('') + '</div></section></div>';
    }
    private loadout() {
        const row = this.game.loadout.get(this.side);
        const slots = (Object.keys(loadoutSlotLabels) as LoadoutSlot[]).map(slot => {
            const id = row[slot], weapon = getWeapon(id)!;
            return '<div class="loadout-choice"><span>' + t('slot.' + slot) + '</span><b>' + esc(weapon.displayName) + '</b><button data-loadout-change="' + slot + '">' + t('equipment.change') + '</button></div>';
        }).join('');
        const choices = this.drawer ? this.game.loadout.choices(this.side, this.drawer).map(weapon =>
            '<button data-loadout-pick="' + this.drawer + '" data-loadout-id="' + weapon.id + '">' + this.image(weapon.previewImage, weapon.displayName) + '<b>' + esc(weapon.displayName) + '</b><small>$' + weapon.price + '</small></button>').join('') : '';
        const ffa = ['rifle','smg','sniper','shotgun'].map(id => {
            const config = this.game.weapons.slots[0].config.id === id ? this.game.weapons.slots[0].config : getWeapon(id)!.config;
            return '<button class="weapon-card" data-weapon="' + id + '"><span class="weapon-card-top">' + esc(getWeapon(id)?.displayName ?? id) + '</span><span class="lvl-badge">LV ' + this.game.progress.get(id).level + '</span><span class="catalog-image">' + this.image(getWeapon(id)?.previewImage ?? null, id) + '</span><div class="weapon-stats">' + t('equipment.damage') + ' ' + config.damage + ' · ' + t('equipment.magazine') + ' ' + config.magazineSize + '</div></button>';
        }).join('');
        return '<div class="equipment-head"><h2>' + t('nav.loadout') + '</h2><p>' + t('equipment.loadoutHint') + '</p></div>'
          + this.sidePicker()
          + '<div class="loadout-choices">' + slots + '<div class="loadout-choice"><span>' + t('equipment.knifeSkin') + '</span><b>' + knifeName(row.knifeStyle, row.knifeStyle) + '</b><button data-equip-page="collection">' + t('equipment.change') + '</button></div>'
          + '<div class="loadout-choice"><span>' + t('equipment.pistolSkin') + '</span><b>' + t('pistolFinish.' + row.pistolSkin) + '</b><button data-equip-page="collection">' + t('equipment.change') + '</button></div>'
          + '<div class="loadout-choice"><span>' + t('equipment.rifleSkin') + '</span><b>' + finishName(row.rifleSkin, row.rifleSkin) + '</b><button data-equip-page="collection">' + t('equipment.change') + '</button></div></div>'
          + (this.drawer ? '<div class="loadout-drawer"><h3>' + t('slot.' + this.drawer) + '</h3>' + choices + '</div>' : '')
          + '<h3>' + t('equipment.ffaPrimary') + '</h3><div class="loadout-grid">' + ffa + '</div><button class="primary" data-action="close">' + t('equipment.done') + '</button>';
    }
    private sidePicker() {
        return '<div class="equipment-side"><button data-loadout-side="attackers" class="' + (this.side === 'attackers' ? 'selected' : '') + '">' + t('equipment.attacker') + '</button><button data-loadout-side="defenders" class="' + (this.side === 'defenders' ? 'selected' : '') + '">' + t('equipment.defender') + '</button></div>';
    }
    private collectionModel(id: string) {
        const item = collectionItem(id);
        return {
            id: item?.category === 'knife' ? 'knife' : item?.weaponId === 'starting-pistol' ? this.game.loadout.get(this.side).startingPistol : item?.weaponId ?? 'knife',
            appearance: {
                knifeStyle: item?.category === 'knife' ? id as KnifeStyle : 'classic' as const,
                rifleSkin: item?.category === 'rifle' ? id as RifleSkin : 'standard' as const,
                pistolSkin: item?.category === 'pistol' ? id as PistolSkin : 'default' as const,
            },
            image: item?.image,
        };
    }
    private collection() {
        const p = this.game.progress;
        const knives = KNIVES.map(knife => {
            const unlocked = p.unlockedKnife(knife.id);
            const label = knifeName(knife.id, knife.label);
            return '<button class="collection-card ' + (unlocked ? '' : 'locked') + '" data-collection-select="' + knife.id + '">'
              + this.image(knife.image, label, skinCrop(knife.id), 1.6) + '<b>' + esc(label) + '</b><small>' + (unlocked ? t('equipment.unlocked') : t('equipment.requireKnife', { n: KNIFE_UNLOCKS[knife.id] })) + '</small></button>';
        }).join('');
        const skins = RIFLE_SKINS.map(skin => {
            const unlocked = p.unlockedRifleSkin(skin.id);
            const label = finishName(skin.id, skin.name);
            return '<button class="collection-card ' + (unlocked ? '' : 'locked') + '" data-collection-select="' + skin.id + '">'
              + this.image(skin.image, label, skinCrop(skin.id), 1.6) + '<b>' + esc(label) + '</b><small>' + (unlocked ? t('equipment.unlocked') : t('equipment.requireRifle', { n: RIFLE_UNLOCKS[skin.id] })) + '</small></button>';
        }).join('');
        const pistolSkins = PISTOL_SKINS.map(item => {
            const unlocked = p.unlockedPistolSkin(item.id, this.game.loadout.get(this.side).startingPistol);
            const label = t('pistolFinish.' + item.id);
            return '<button class="collection-card ' + (unlocked ? '' : 'locked') + '" data-collection-select="' + item.id + '">'
              + this.image(item.image, label, skinCrop(item.id), 1.6) + '<b>' + label + '</b><small>' + (unlocked ? t('equipment.unlocked') : t('equipment.requirePistol', { n: PISTOL_UNLOCKS[item.id] })) + '</small></button>';
        }).join('');
        const knife = KNIVES.find(item => item.id === this.collectionId);
        const skin = RIFLE_SKINS.find(item => item.id === this.collectionId);
        const pistolSkin = PISTOL_SKINS.find(item => item.id === this.collectionId);
        const art: string | null = knife?.image ?? skin?.image ?? pistolSkin?.image ?? KNIVES[0].image ?? null;
        const unlocked = knife ? p.unlockedKnife(knife.id) : skin ? p.unlockedRifleSkin(skin.id)
            : pistolSkin ? p.unlockedPistolSkin(pistolSkin.id, this.game.loadout.get(this.side).startingPistol) : true;
        const featureCrop = knife ? skinCrop(knife.id)
            : skin ? skinCrop(skin.id) : pistolSkin ? skinCrop(pistolSkin.id) : subjectCrop('knife');
        const label = knife ? knifeName(knife.id, knife.label) : skin ? finishName(skin.id, skin.name) : pistolSkin ? t('pistolFinish.' + pistolSkin.id) : '';
        const requirement = knife ? t('equipment.requireKnife', { n: KNIFE_UNLOCKS[knife.id] })
            : skin ? t('equipment.requireRifle', { n: RIFLE_UNLOCKS[skin.id] })
            : pistolSkin ? t('equipment.requirePistol', { n: PISTOL_UNLOCKS[pistolSkin.id] }) : '';
        return '<div class="equipment-head"><h2>' + t('nav.collection') + '</h2><p>' + t('equipment.collectionHint') + '</p></div>'
          + '<div class="collection-feature">' + (this.collection3D ? '<div id="collection-canvas" class="catalog-canvas" role="img" aria-label="' + esc(label) + '"></div>' : this.image(art, label, featureCrop, 1.9))
          + '<div><div class="viewer-switch"><button data-collection-viewer="reference" ' + (this.collection3D ? '' : 'class="selected"') + '>' + t('equipment.reference') + '</button><button data-collection-viewer="3d" ' + (this.collection3D ? 'class="selected"' : '') + '>' + t('equipment.preview3d') + '</button></div><h3>' + esc(label) + '</h3><p>' + (unlocked ? t('equipment.unlocked') : t('equipment.locked') + ' · ' + t('equipment.previewAvailable')) + '</p>'
          + (unlocked ? '' : '<p>' + requirement + '</p>')
          + '<button data-collection-equip="' + this.collectionId + '" ' + (unlocked ? '' : 'disabled') + '>' + (unlocked ? t('equipment.equipFor', { side: t(this.side === 'attackers' ? 'equipment.attacker' : 'equipment.defender') }) : t('equipment.locked')) + '</button></div></div>'
          + this.sidePicker()
          + '<h3>' + t('equipment.knifeFinishes') + '</h3><div class="collection-grid">' + knives + '</div><h3>' + t('equipment.rifleFinishes') + '</h3><div class="collection-grid">' + skins + '</div><h3>' + t('equipment.pistolFinishes') + '</h3><div class="collection-grid">' + pistolSkins + '</div>';
    }
    render() {
        const host = this.ui.el('dialog-content');
        host.innerHTML = this.tabs() + (this.page === 'armory' ? this.armory() : this.page === 'loadout' ? this.loadout() : this.collection());
        this.cropArt(host);
        if (!(this.page === 'armory' && this.armoryUses3D()) && !(this.page === 'collection' && this.collection3D)) this.closePreview();
        if (this.page === 'armory' && this.armoryUses3D()) {
            const stage = host.querySelector<HTMLElement>('#armory-canvas');
            if (stage) {
                this.preview ??= new ArmoryPreview();
                this.preview.show(stage, this.selectedId, this.game.weapons.appearance, getWeapon(this.selectedId)?.previewImage);
            }
        }
        if (this.page === 'collection' && this.collection3D) {
            const stage = host.querySelector<HTMLElement>('#collection-canvas');
            if (stage) {
                const selected = this.collectionModel(this.collectionId);
                this.preview ??= new ArmoryPreview();
                this.preview.show(stage, selected.id, selected.appearance, selected.image);
                const index = COLLECTION_ITEMS.findIndex(item => item.id === this.collectionId);
                const adjacent = [index - 2, index - 1, index + 1, index + 2]
                    .filter(next => next >= 0 && next < COLLECTION_ITEMS.length)
                    .map(next => this.collectionModel(COLLECTION_ITEMS[next].id));
                this.preview.preload(adjacent);
            }
        }
    }
    closePreview() { this.preview?.destroy(); this.preview = undefined; }
    handleClick(target: HTMLElement) {
        const element = target.closest<HTMLElement>('[data-equip-page],[data-catalog-category],[data-catalog-weapon],[data-viewer],[data-loadout-side],[data-loadout-change],[data-loadout-pick],[data-collection-select],[data-collection-equip],[data-collection-viewer],[data-finish]');
        if (!element) return;
        if (element.dataset.finishWeapon !== undefined && element.dataset.finish !== undefined) {
            this.applyFinish(element.dataset.finishWeapon, element.dataset.finish);
        }
        else if (element.dataset.equipPage) this.show(element.dataset.equipPage as Page);
        else if (element.dataset.catalogCategory) { this.category = element.dataset.catalogCategory as WeaponCategory; this.selectedId = weaponRegistry.find(weapon => weapon.category === this.category)?.id ?? this.selectedId; this.show3D = null; this.render(); }
        else if (element.dataset.catalogWeapon) { this.selectedId = element.dataset.catalogWeapon; this.show3D = null; this.render(); }
        else if (element.dataset.viewer) { this.show3D = element.dataset.viewer === '3d'; this.render(); }
        else if (element.dataset.loadoutSide) { this.side = element.dataset.loadoutSide as TeamSide; this.drawer = null; this.render(); }
        else if (element.dataset.loadoutChange) { this.drawer = element.dataset.loadoutChange as LoadoutSlot; this.render(); }
        else if (element.dataset.loadoutPick && element.dataset.loadoutId) {
            this.game.loadout.set(this.side, element.dataset.loadoutPick as LoadoutSlot, element.dataset.loadoutId);
            this.drawer = null; this.render();
        }
        else if (element.dataset.collectionSelect) { this.collectionId = element.dataset.collectionSelect; this.render(); }
        else if (element.dataset.collectionViewer) { this.collection3D = element.dataset.collectionViewer === '3d'; this.render(); }
        else if (element.dataset.collectionEquip) {
            const id = element.dataset.collectionEquip;
            const knife = KNIVES.find(item => item.id === id), skin = RIFLE_SKINS.find(item => item.id === id), pistolSkin = PISTOL_SKINS.find(item => item.id === id);
            if (knife) this.game.loadout.setKnife(this.side, id as KnifeStyle, this.game.progress.unlockedKnife(id as KnifeStyle));
            if (skin) this.game.loadout.setRifleSkin(this.side, id as RifleSkin, this.game.progress.unlockedRifleSkin(id as RifleSkin));
            if (pistolSkin) this.game.loadout.setPistolSkin(this.side, id as PistolSkin, this.game.progress.unlockedPistolSkin(id as PistolSkin, this.game.loadout.get(this.side).startingPistol));
            this.render();
        }
    }
    handleInput(input: HTMLInputElement | HTMLSelectElement) {
        if (input.dataset.catalogSearch !== undefined) { this.search = input.value; this.render(); this.ui.el('catalog-search').focus(); }
        if (input.dataset.catalogFilter !== undefined) { this.filter = input.value as Filter; this.render(); }
    }
}
