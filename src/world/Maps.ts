import { MapKit } from './MapKit';

export interface MapDefinition {
    id: string;
    name: string;
    tag: string;
    theme: string;
    blurb: string;
    size: number;
    sky: number;
    fog: number;
    fogNear: number;
    fogFar: number;
    hemi: [number, number];
    hemiIntensity: number;
    sun: number;
    sunIntensity: number;
    ground: number;
    /** Stylised top down art used by the map picker. `planColors` turns it into a tile grid. */
    plan: string[];
    planColors: { open: number; structure: number; deck: number; prop: number; water: number; accent: number };
    spawns: [number, number, number?][];
    tactical?: { sites: { A: [number, number, number]; B: [number, number, number] }; attackers: number[]; defenders: number[] };
    build(k: MapKit): void;
}

const BLOCKYARD: MapDefinition = {
    id: 'blockyard', name: 'BLOCKYARD', tag: 'ARENA 01', theme: '货运堆场 · 温带',
    blurb: '仓库、天桥与集装箱堆是原始赛场：中距离交叉火力，屋顶与高空走廊决定控场。',
    size: 88, sky: 0xa9d6e4, fog: 0xa9d6e4, fogNear: 110, fogFar: 260,
    hemi: [0xe9faff, 0x757565], hemiIntensity: 2.3, sun: 0xfff1d4, sunIntensity: 2.5, ground: 0xc8c6ad,
    plan: [
        '..............',
        '..*...........',
        '....*...##....',
        '........##....',
        '........##....',
        '...##...==##..',
        '...##...==....',
        '...##.........',
        '......**......',
        '..........*...',
        '..*...........',
        '..............',
        '....*...*.....',
        '..............',
    ],
    planColors: { open: 0xc8c6ad, structure: 0xe7e6d2, deck: 0x3e6061, prop: 0x879591, water: 0x8fb6c0, accent: 0xd5f66b },
    spawns: [[-27, 35], [34, 39], [-57, -43], [56, -38], [0, -60], [-62, 30], [62, 18], [8, 61], [41, -62], [-38, 61], [64, 59], [-60, -64]],
    tactical: { sites: { A: [8, 61, 8], B: [0, -60, 8] }, attackers: [2, 5, 9, 11, 0], defenders: [3, 6, 8, 10, 1] },
    build(k) {
        const sand = 0xc8c6ad, cream = 0xe7e6d2, dark = 0x3e6061, road = 0x879591;
        k.box(0, -.5, 0, 176, 1, 176, sand);
        k.box(0, .012, 0, 32, .02, 150, road, false);
        k.box(0, .014, 14, 142, .02, 23, road, false);
        for (let z = -70; z < 72; z += 10) k.box(0, .029, z, .35, .018, 4, 0xdadbb9, false);
        k.box(0, 2, -88, 178, 4, 1.5, dark);
        k.box(0, 2, 88, 178, 4, 1.5, dark);
        k.box(-88, 2, 0, 1.5, 4, 176, dark);
        k.box(88, 2, 0, 1.5, 4, 176, dark);
        // Central yard: compact cover ring with open cross routes.
        k.box(-9, .62, -3, 8, 1.24, 1, cream);
        k.box(10, .62, 1, 8, 1.24, 1, cream);
        k.box(2, .62, -18, 1, 1.24, 9, cream);
        k.box(-12, 1.4, 17, 4, 2.8, 4, 0x739087);
        k.box(13, 1.2, 23, 3.4, 2.4, 3.4, 0xd8ac68);
        k.box(-13, 1.5, -18, 4, 3, 4, 0xdcb06e);
        k.box(-13, 3.5, -18, 3, 1, 3, 0xb49060);
        k.box(1, .03, -3, 8, .025, 6, 0xacb6a0, false);
        k.sign('BLOCKYARD', 0, 1.05, -2.95, 6.6, 1.4, dark, 0xd7edb0);
        // Warehouse with a real interior, two doors and a walkable roof.
        k.box(-38, 4, -27, 28, 8, 1, cream);
        k.box(-51.5, 4, -13, 1, 8, 28, cream);
        k.box(-24.5, 4, -13, 1, 8, 28, cream);
        k.box(-46, 4, .5, 11, 8, 1, cream);
        k.box(-29, 4, .5, 10, 8, 1, cream);
        k.box(-38, 7, .5, 7, 2, 1, cream);
        k.box(-38, 8.2, -13, 29, .4, 29, dark);
        k.box(-38, .025, -13, 27, .03, 26, 0x969f94, false);
        k.box(-44, 1.4, -19, 4, 2.8, 4, 0xbd9e6e);
        k.box(-31, 1.15, -10, 4, 2.3, 5, 0x84a396);
        k.sign('01 / WAREHOUSE', -38, 6.2, 1.03, 10, 1.4, dark, 0xe8e9d6);
        k.stairs(-57, 2, -1, 21, .4, 1.25, 4, 0x9daa9f, 'warehouse stairs');
        k.box(-54.5, 8.2, -25.3, 6, .4, 4, dark);
        k.route('warehouse roof', [[-57, 8.4, -25.3], [-52, 8.4, -25.3], [-47, 8.4, -22], [-38, 8.4, -20]]);
        // Tower and sky bridge: climbable steps up to an 8.4m deck.
        for (const x of [24, 34])
            for (const z of [-25, -15])
                k.box(x, 4, z, 1.2, 8, 1.2, cream);
        k.box(29, 8.2, -20, 13, .4, 13, dark);
        k.box(29, 11.5, -25.8, 13, 6.2, .5, 0xe7c97e);
        k.box(23, 10, -24, .45, 3.2, 4, cream);
        k.box(23, 10, -16, .45, 3.2, 4, cream);
        k.box(35, 10, -22, .45, 3.2, 8, cream);
        k.box(29, 12.5, -20, 13.8, .45, 13.8, dark);
        k.sign('02', 29, 10.2, -13.7, 3, 2.5, dark, 0xe8edcd);
        k.stairs(40, 18, -1, 21, .4, 1.25, 4, 0xa7b6a9, 'tower stairs');
        k.box(37.5, 8.2, -7.5, 7, .4, 4, dark);
        k.box(35, 8.2, -12, 4, .4, 7, dark);
        k.route('tower deck', [[37, 8.4, -7.5], [35, 8.4, -11], [32, 8.4, -15], [29, 8.4, -20]]);
        k.box(-1.5, 8.2, -20, 47, .4, 4, 0x527673);
        k.box(-1.5, 8.9, -22, 47, 1, .2, cream);
        k.box(-1.5, 8.9, -18, 47, 1, .2, cream);
        for (const x of [-15, 7]) k.box(x, 4, -20, .8, 8, .8, cream);
        k.route('sky bridge', Array.from({ length: 16 }, (_, i) => [-34 + i * 4, 8.4, -20] as [number, number, number]));
        // Underpass, open at both ends with a usable roof.
        k.box(8, 2.5, -48, 1, 5, 20, cream);
        k.box(19, 2.5, -48, 1, 5, 20, cream);
        k.box(13.5, 5.2, -48, 12, .4, 20, 0xa7b9ad);
        k.box(13.5, 4.2, -37.6, 10, 1.2, .2, dark);
        k.sign('UNDERPASS', 13.5, 4.2, -37.45, 8, 1, 0x233f41, 0xe8edcd);
        k.stairsUpTo(13.5, -37.4, -1, 13, .4, 1.2, 3.2, 0x9daa9f, 'underpass ramp');
        k.route('underpass roof', [[13.5, 5.4, -38], [13.5, 5.4, -48], [13.5, 5.4, -58]]);
        // Container stacks create layered routes and occluded respawn pockets.
        k.container(32, 0, 19, 0x6c9eaa);
        k.container(51, 0, 31, 0xda8b68, true);
        k.container(51, 0, 4, 0xe1bd6b, true);
        k.container(31, 0, 43, 0xe1bd6b);
        k.container(31, 4.2, 43, 0xa9bbae);
        k.container(-33, 0, 31, 0xce8163, true);
        k.container(-52, 0, 46, 0x629498);
        k.container(-24, 0, 55, 0xe0bf78);
        k.container(-39, 0, -49, 0x789c9e);
        k.container(-16, 0, -58, 0xc58c69, true);
        k.container(39, 0, -52, 0x709599, true);
        for (const [x, z] of [[-64, -18], [58, -18], [-7, 44], [47, 61], [-55, 65], [66, -52]] as const) {
            k.box(x, 1.1, z, 5, 2.2, 3, 0xadb8a2);
            k.box(x + 5, .65, z + 2, 2, 1.3, 2, 0xc4a276);
        }
        for (const [x, z] of [[-70, 8], [69, 43], [-66, -54], [56, -64], [0, 73], [-70, 70], [72, -7]] as const) k.tree(x, 0, z);
        for (let i = 0; i < 16; i++) {
            const x = -110 + i * 15, h = 10 + (i % 4) * 5;
            k.box(x, h / 2, -110, 11, h, 13, i % 2 ? 0x9bb6b2 : 0xb1c3ba, false);
        }
    },
};

const DUNE_RIDGE: MapDefinition = {
    id: 'duneridge', name: 'DUNE RIDGE', tag: 'ARENA 02', theme: '沙漠峡谷 · 干旱',
    blurb: '干河床把沙丘与遗迹切成两半，钻井架与瞭望塔控制制高点。掩体稀疏，长枪占优。',
    size: 88, sky: 0xe6c894, fog: 0xdfc79c, fogNear: 80, fogFar: 240,
    hemi: [0xffeccc, 0x8a6a44], hemiIntensity: 2.4, sun: 0xffd9a0, sunIntensity: 3, ground: 0xd9c48f,
    plan: [
        '..######......',
        '.........#....',
        '...^......#...',
        '..#..*.......~',
        '.....~~....*..',
        '..*..~~..#.^..',
        '..##.~~..##...',
        '.....~~.......',
        '.==..~~..*....',
        '.....~~.......',
        '..*..~~..#....',
        '.....~~....*..',
        '..^..~~..^....',
        '.....~~.......',
    ],
    planColors: { open: 0xd9c48f, structure: 0xb08a5c, deck: 0x8e6b45, prop: 0x6d7b74, water: 0xc0a877, accent: 0xd5f66b },
    spawns: [[-24, 24], [24, 24], [-24, -26], [24, -26], [0, 42], [0, -48], [48, -8], [-48, -10], [62, 22], [-58, 54], [32, 62], [-52, -56]],
    build(k) {
        const sand = 0xd9c48f, sandDark = 0xc0a877, rock = 0xb08a5c, rockDark = 0x8e6b45, stone = 0xcbb894, metal = 0x6d7b74;
        k.box(0, -.5, 0, 176, 1, 176, sand);
        // Dry riverbed crossing the map plus wind ripples.
        k.paint(0, 0, 176, 15, sandDark);
        for (let x = -80; x <= 80; x += 8) k.box(x, .026, -9 + (x % 16 === 0 ? 0 : 3), 5, .02, 2.6, 0xcdb684, false);
        // Canyon walls frame the arena and give the highest ground. Every wall keeps a gap so no
        // pocket of the map ends up sealed off from the rest.
        k.box(-76, 3, -28, 20, 6, 66, rock);
        k.box(-16, 4, -79, 118, 8, 20, rockDark);
        k.box(76, 2.5, 22, 20, 5, 96, rock);
        k.box(-6, 5, 76, 118, 10, 20, rock);
        k.box(-76, 6.4, -28, 22, .8, 68, rockDark);
        k.route('west mesa rim', [[-76, 6.8, -56], [-76, 6.8, -20], [-76, 6.8, 2]]);
        k.stairsUpTo(-76, 5.6, -1, 17, .4, 1.2, 4, rockDark, 'mesa stairs');
        // Dunes.
        k.hill(8, 18, 30, 24, 3.2, 0xe3cd98, 'east dune');
        k.hill(-44, 36, 26, 22, 4.4, 0xd2bb85, 'west dune');
        k.hill(42, 48, 22, 18, 2.6, 0xe8d6a6, 'south dune');
        // Sandstone ruins with broken roof slabs and pillars.
        k.box(-42, 1.6, -22, 20, 3.2, 16, stone);
        k.stairsUpTo(-42, -13.1, -1, 8, .4, 1.3, 5, stone, 'ruin stairs');
        for (const [x, z] of [[-49, -28], [-42, -28], [-35, -28], [-49, -16], [-35, -16]] as const) {
            k.box(x, 5, z, 1.2, 3.6, 1.2, rockDark);
        }
        k.box(-42, 7.1, -28, 20, .6, 4, rockDark);
        k.box(-49, 7.1, -16, 6, .6, 4, rockDark);
        k.crate(-34, 3.2, -30, 1.6, 0xc9a877);
        k.crate(-35.6, 3.2, -30.4, 1.3, 0xbf9d6c);
        k.arch(-42, 0, -1.6, 10, 4.4, 1.4, stone);
        // Drilling derrick: the tallest structure, reached by a long exposed flight.
        for (const [x, z] of [[24, -36], [36, -36], [24, -24], [36, -24]] as const) k.box(x, 4.6, z, 1.4, 9.2, 1.4, metal);
        k.platform(30, 9.4, -30, 14, 14, 0x7c8983, 0x5c6a65);
        k.stairsUpTo(30, -21.9, -1, 24, .4, 1.2, 4, metal, 'derrick stairs');
        k.route('derrick deck', [[30, 9.6, -30], [24, 9.6, -34], [36, 9.6, -34], [30, 9.6, -24]]);
        k.box(30, 11.4, -36, 15, .5, 15, 0x5c6a65, false);
        k.box(26.5, 12.6, -35.4, 1.2, 3, 1.2, metal);
        k.barrel(23.9, 9.6, -24.2, 0x8a5a3c);
        k.barrel(25.3, 9.6, -24.8, 0x6d7b74);
        k.crate(36, 9.6, -24.8, 1.7, 0xb5824f);
        k.sign('DUNE // 02', 30, 10.6, -22.4, 7, 1.3, 0x5c6a65, 0xf0e0b8);
        // Watch tower on the east shelf.
        for (const [x, z] of [[58, 38], [66, 38], [58, 46], [66, 46]] as const) k.box(x, 3.2, z, 1, 6.4, 1, metal);
        k.platform(62, 6.4, 42, 12, 12, 0x7c8983, 0x5c6a65);
        k.stairsUpTo(62, 48.6, -1, 16, .4, 1.2, 4, metal, 'tower stairs');
        k.box(62, 8.6, 42, 13, 3.6, .5, 0x8a5a3c, false);
        k.lamp(62, 6.6, 37, 3);
        // Ground cover, wrecks and vegetation.
        for (const [x, z, w, h] of [[-16, 30, 4, 2.2], [18, -10, 5, 1.6], [-20, -40, 6, 2.6], [34, 10, 4.4, 1.4], [-56, 6, 5, 2.4], [52, -34, 4.6, 2]] as const) {
            k.rock(x, 0, z, w, h, rock);
        }
        for (const [x, z] of [[-10, 62], [16, 66], [-66, -8], [70, -40], [-30, -50], [46, -60]] as const) k.bush(x, 0, z, 2.2, 0x9a9358);
        for (const [x, z] of [[-58, -70], [66, 62], [-78, 66], [10, -64]] as const) k.tree(x, 0, z, .9, 0x8a7a58, 0x6f8a4e, 0x879f5c);
        k.box(-6, 1.1, -56, 9, 2.2, 4, 0xb5824f);
        k.box(-6, 3, -56, 9.6, .3, 4.6, 0x6d7b74);
        k.box(20, .9, 58, 7, 1.8, 3.2, 0xc0703f);
        k.container(-70, 0, 30, 0xc07a4a, true, 'DUNE FREIGHT');
        k.container(-54, 0, 62, 0xb08a5c, false, 'DUNE FREIGHT');
        k.container(64, 0, -8, 0x9a7a58, false, 'DUNE FREIGHT');
        // Distant mesas keep the horizon readable.
        for (let i = 0; i < 12; i++) {
            const x = -120 + i * 22, h = 12 + (i % 3) * 7;
            k.box(x, h / 2, -118, 18, h, 16, i % 2 ? 0xc09a70 : 0xb08a5c, false);
        }
    },
};

const HARBORLINE: MapDefinition = {
    id: 'harborline', name: 'HARBORLINE', tag: 'ARENA 03', theme: '集装箱港口 · 海湾',
    blurb: '两侧码头夹着浅水港池，龙门吊横跨全场。船上、屋顶与吊臂三条高度线同时开火。',
    size: 92, sky: 0x9fc3d6, fog: 0xa8c6d6, fogNear: 90, fogFar: 250,
    hemi: [0xe4f4ff, 0x5f6f70], hemiIntensity: 2.3, sun: 0xfff0dc, sunIntensity: 2.6, ground: 0xcfd3c8,
    plan: [
        '..#####.......',
        '..#===#....##.',
        '..#===#....##.',
        '.~~...~~...~~.',
        '.~~.==.~~..~~.',
        '.~~.==.~~..~~.',
        '.~~.==.~~..~~.',
        '.~~.==.~~..~~.',
        '.~~...~~...~~.',
        '..####....####',
        '..#==#....#==#',
        '..#==#....#==#',
        '..####....####',
        '..............',
    ],
    planColors: { open: 0x9aa39c, structure: 0xcfd3c8, deck: 0x77857f, prop: 0xc2704a, water: 0x3f7c9b, accent: 0xd5f66b },
    spawns: [[-68, 44], [-72, -44], [60, 44], [60, -44], [-64, -10], [68, 10], [22, 64], [28, 78], [-30, -64], [-32, -80], [-74, 64], [74, -62]],
    build(k) {
        const concrete = 0xcfd3c8, quay = 0x9aa39c, steel = 0x77857f, rust = 0xc2704a, deck = 0x5d6f6d, water = 0x3f7c9b;
        // Sea floor and a shallow basin you can wade through.
        k.box(0, -2.6, 0, 184, 2.1, 184, 0x2c5b73);
        k.box(0, -1.05, 0, 184, 1.1, 184, water);
        // Quays and piers form a ring around the basin.
        k.box(-60, -.5, 0, 40, 1, 184, concrete);
        k.box(60, -.5, 0, 40, 1, 184, concrete);
        k.box(0, -.5, 74, 80, 1, 36, concrete);
        k.box(0, -.5, -74, 80, 1, 36, concrete);
        for (let z = -80; z <= 80; z += 16) {
            k.box(-38.6, .25, z, .8, .8, .8, rust);
            k.box(38.6, .25, z, .8, .8, .8, rust);
        }
        k.paint(-60, 0, 36, 176, quay);
        k.paint(60, 0, 36, 176, quay);
        k.paint(-60, 40, 30, 12, 0xdad7c4);
        k.paint(60, -40, 30, 12, 0xdad7c4);
        // Warehouses with walkable roofs on both quays.
        k.box(-62, 2.4, 16, 34, 4.8, 30, concrete);
        k.box(-62, 5, 16, 35, .4, 31, deck);
        k.sign('WAREHOUSE 03', -62, 4.2, 31.2, 12, 1.4, deck, 0xe8edcd);
        k.stairsUpTo(-62, 32.1, -1, 13, .4, 1.25, 4, steel, 'west roof stairs');
        k.route('west roof', [[-62, 5.2, 30], [-70, 5.2, 22], [-55, 5.2, 20]]);
        k.box(62, 2.4, -18, 34, 4.8, 30, concrete);
        k.box(62, 5, -18, 35, .4, 31, deck);
        k.sign('WAREHOUSE 04', 62, 4.2, -2.8, 12, 1.4, deck, 0xe8edcd);
        k.stairsUpTo(62, -1.9, -1, 13, .4, 1.25, 4, steel, 'east roof stairs');
        k.route('east roof', [[62, 5.2, -6], [62, 5.2, -20], [52, 5.2, -26]]);
        // Gantry crane spanning the basin at height.
        for (const x of [-42, 42]) for (const z of [-30, 30]) k.box(x, 6, z, 2, 12, 2, steel);
        k.box(0, 12.2, 0, 88, .6, 5, 0xc07a4a);
        k.box(0, 12.7, 2.4, 88, .5, .3, steel, false);
        k.box(0, 12.7, -2.4, 88, .5, .3, steel, false);
        k.box(-18, 15.8, 0, 10, 2.6, 6, rust);
        k.box(20, 15.6, 0, 8, 2.2, 5, 0xa8b0a4);
        k.catwalk(-48.5, 12.5, 1.25, 10, 2.5, deck, steel);
        k.route('crane walk', [[-50, 12.5, 1.2], [-30, 12.5, 0], [0, 12.5, 0], [30, 12.5, 0]]);
        k.stairsUpTo(-52, 2.5, -1, 19, .4, 1.15, 3.4, steel, 'crane stairs', 5.2);
        k.stairsUpTo(52, -2.5, 1, 19, .4, 1.15, 3.4, steel, 'crane stairs east', 5.2);
        // Cargo ship berthed in the basin.
        k.box(0, 1, 22, 24, 3, 58, 0x7d4a44);
        k.box(0, 2.6, 22, 23, .4, 56, deck);
        k.box(0, 5.6, 42, 14, 5.6, 14, 0xb9bdb0);
        k.box(0, 8.6, 42, 15, .6, 15, deck);
        k.box(0, 10.4, 42, 1, 3.2, 1, steel);
        k.paint(0, 30, 20, 14, 0x6b5a4a);
        k.sign('MV BLOCKSTRIKE', 0, 3.4, -6.4, 12, 1.4, 0x7d4a44, 0xe8edcd);
        k.stairsUpTo(-10, 50.4, -1, 7, .4, 1, 4, steel, 'gangway');
        k.route('ship deck', [[-10, 2.8, 48], [-10, 2.8, 28], [-10, 2.8, 6], [6, 2.8, -4]]);
        // Container yard, mooring gear and street furniture.
        for (const [x, z, c, r] of [[-62, -44, 0xc06a4a, false], [-62, -60, 0xd6a860, true], [62, 30, 0x6f9aa4, true], [62, 58, 0xd6a860, false], [-30, 74, 0x8fa88c, false], [30, -74, 0xb5824f, true], [22, 74, 0x6f9aa4, false], [-22, -74, 0xc06a4a, true]] as const) {
            k.container(x, 0, z, c, r, 'HARBOR FREIGHT');
        }
        k.crate(-48, 0, 58, 1.8, 0xb5824f);
        k.crate(-46.2, 0, 58.6, 1.6, 0x9a7a58);
        k.crate(48, 0, -58, 1.7, 0xb5824f);
        for (const [x, z] of [[-44, 26], [44, -26], [-44, -70], [44, 70]] as const) k.barrel(x, 0, z, 0xc07a4a);
        for (const [x, z] of [[-72, 74], [72, -74], [-72, -74], [72, 74], [0, 78], [0, -78]] as const) k.lamp(x, 0, z, 5.4);
        k.fence(-38, 0, 60, 22, 'z', 0x8d968a);
        k.fence(38, 0, -60, 22, 'z', 0x8d968a);
        k.arch(-60, 0, -20, 12, 5, 1.4, concrete);
        k.arch(60, 0, 22, 12, 5, 1.4, concrete);
        k.bush(-50, 0, -30, 2, 0x6f8a4e);
        k.bush(50, 0, 30, 2, 0x6f8a4e);
        // Breakwater and distant skyline.
        for (let i = 0; i < 10; i++) k.box(-110 + i * 24, 1.6, 108, 20, 3.2, 10, 0x8a9490, false);
        for (let i = 0; i < 8; i++) k.box(-100 + i * 28, 14 + (i % 3) * 8, -112, 20, 28 + (i % 3) * 16, 18, 0x93a3a8, false);
    },
};

/**
 * External switchback stair tower: two flights and a landing per level, 6.4m per level. Used by the
 * vertical maps where roofs are too narrow to hold a straight flight.
 */
function stairTower(k: MapKit, x: number, z: number, levels: number, color: number, name: string) {
    const depth = .5, rise = .4, per = 8;
    const landings: [number, number, number][] = [];
    let base = 0, top = z;
    for (let level = 0; level < levels; level++) {
        k.stairs(x, top, -1, per, rise, depth, 2.6, color, `${name} ${level}a`, base);
        const landingZ = top - per * depth - 1.2;
        k.platform(x + 1.3, base + per * rise, landingZ, 5.4, 3, color);
        k.stairs(x + 2.6, landingZ - 1.2, 1, per, rise, depth, 2.6, color, `${name} ${level}b`, base + per * rise);
        base += per * rise * 2;
        top = landingZ - 1.2 + per * depth;
        landings.push([x + 2.6, top, base]);
    }
    return landings;
}

const SUBWAY: MapDefinition = {
    id: 'subway', name: 'SUBWAY DEPOT', tag: 'ARENA 04', theme: '地下车站 · 混凝土',
    blurb: '下沉站台与检修沟横贯全图，天桥在头顶交错。近距离遭遇多，霰弹与刀在这里最舒服。',
    size: 84, sky: 0x8f9aa4, fog: 0x99a3ac, fogNear: 70, fogFar: 210,
    hemi: [0xd8e6ee, 0x4a4f52], hemiIntensity: 2.1, sun: 0xf2ead8, sunIntensity: 2, ground: 0x8e8f88,
    plan: [
        '....####......',
        '..##==####....',
        '..#......#....',
        '..............',
        '.~~..^..^..~~.',
        '=~~========~~=',
        '=~~========~~=',
        '.~~..^..^..~~.',
        '..............',
        '..#......#....',
        '..####==##....',
        '....####......',
        '..............',
        '..............',
    ],
    planColors: { open: 0x8e8f88, structure: 0xb9bec2, deck: 0x5f6669, prop: 0xc2704a, water: 0x3a3f42, accent: 0xd5f66b },
    spawns: [[-14, -6.5, -1.8], [14, -6.5, -1.8], [-14, 6.5, -1.8], [14, 6.5, -1.8], [-56, 0, 0], [56, 0, 0], [-36, -34, 0], [36, -34, 0], [-36, 34, 0], [36, 34, 0], [-70, 0, -3.4], [70, 0, -3.4]],
    build(k) {
        const concrete = 0xb9bec2, tile = 0x9aa1a4, deck = 0x5f6669, gravel = 0x3a3f42, paintYellow = 0xd8c05a;
        // Street level, split by a sunken rail trench that runs the full width.
        k.box(0, -.4, -47, 168, .8, 74, concrete);
        k.box(0, -.4, 47, 168, .8, 74, concrete);
        k.box(0, -3.6, 0, 168, .4, 20, gravel);
        k.box(-56, -.4, 0, 14, .8, 24, concrete);
        k.box(56, -.4, 0, 14, .8, 24, concrete);
        k.route('north street', [[-70, 0, -46], [-20, 0, -46], [30, 0, -46], [70, 0, -46]]);
        k.route('south street', [[-70, 0, 30], [-20, 0, 30], [30, 0, 30], [70, 0, 30]]);
        k.paint(0, -40, 150, 12, 0x7d8487);
        k.paint(0, 40, 150, 12, 0x7d8487);
        // Platforms and tracks.
        k.box(0, -2, -6.5, 60, .4, 5, tile);
        k.box(0, -2, 6.5, 60, .4, 5, tile);
        k.box(0, -3.38, 0, 168, .05, 6.4, 0x2f3436, false);
        for (const z of [-1.7, 1.7]) {
            k.box(0, -3.24, z, 168, .16, .16, 0x8d9498, false);
            for (let x = -80; x <= 80; x += 3.2) k.box(x, -3.3, z, .3, .12, 2.2, 0x4a4f52, false);
        }
        for (const x of [-28, -16, -4, 8, 20, 28]) {
            k.box(x, -.8, -9.2, 1.4, 2, 1, concrete);
            k.box(x, -.8, 9.2, 1.4, 2, 1, concrete);
        }
        k.sign('PLATFORM 1 · NORTH', -8, 1.4, -4.05, 11, 1.3, 0x2f3436, paintYellow);
        k.sign('PLATFORM 2 · SOUTH', 8, 1.4, 4.05, 11, 1.3, 0x2f3436, paintYellow);
        // Escalators from both platforms up to the streets.
        for (const x of [-22, 22]) {
            k.stairsUpTo(x, -9.4, -1, 5, .4, .95, 4, deck, 'north escalator', -1.8);
            k.stairsUpTo(x, 9.4, 1, 5, .4, .95, 4, deck, 'south escalator', -1.8);
        }
        // Service ramps at both ends of the trench, so falling onto the tracks is never a dead end.
        k.stairsUpTo(-76, 9.4, 1, 9, .4, 1.1, 4, deck, 'west trench ramp', -3.4);
        k.stairsUpTo(76, -9.4, -1, 9, .4, 1.1, 4, deck, 'east trench ramp', -3.4);
        // Parked train whose roof is a player-only perch.
        k.box(-4, -2, 0, 46, 2.8, 4.4, 0xd6dbdd);
        k.paint(-4, -2.05, 44, .5, 0x2f3436, -0.62);
        k.paint(-4, 2.05, 44, .5, 0x2f3436, -0.62);
        for (let x = -24; x <= 16; x += 6) {
            k.box(x, -1.5, -2.25, 4, 1.1, .08, 0x2f3436, false);
            k.box(x, -1.5, 2.25, 4, 1.1, .08, 0x2f3436, false);
        }
        k.box(-4, -.6, 0, 46, .2, 4.6, 0x9fa7aa);
        k.box(14, -1.5, 0, 3, 1.9, 4.5, 0x8d9498);
        k.sign('DEPOT 04', 2, .3, 0, 10, 1.2, 0x2f3436, 0xe8edcd);
        // Mezzanine over the east end, reached from the north street.
        k.box(52, 4.2, 0, 30, .4, 24, deck);
        k.stairsUpTo(52, -12.6, 1, 12, .4, .65, 4, deck, 'mezzanine stairs');
        k.route('mezzanine', [[52, 4.4, -10], [52, 4.4, 0], [64, 4.4, 0]]);
        k.box(52, 5.6, -11.6, 30, .3, .2, paintYellow, false);
        k.box(52, 5.6, 11.6, 30, .3, .2, paintYellow, false);
        k.platform(-52, 4.2, 0, 26, 22, deck);
        k.stairsUpTo(-52, -12.6, 1, 12, .4, .65, 4, deck, 'west gantry stairs');
        k.route('west gantry', [[-52, 4.4, -10], [-52, 4.4, 0], [-40, 4.4, 0]]);
        for (const x of [-62, -52, -42, 42, 52, 62]) k.box(x, 2.2, -10.4, 1.2, 4.4, 1.2, concrete);
        // Ticket hall, kiosks and street furniture.
        k.hut(-30, 0, -30, 16, 4.4, 13, concrete, deck, 1);
        k.stairsUpTo(-30, -22.9, -1, 13, .4, 1.2, 4, deck, 'ticket roof stairs');
        k.sign('TICKETS', -30, 3, -36.6, 9, 1.4, 0x2f3436, paintYellow);
        k.crate(-16, 0, -34, 1.8, 0x8d9498);
        k.crate(-14, 0, -34.6, 1.6, 0x7d8487);
        k.crate(24, 0, -32, 1.8, 0x8d9498);
        k.barrel(22, 0, -26, 0xa8704c);
        k.barrel(23.4, 0, -26.6, 0x8d9498);
        k.lamp(0, 0, -22, 5.6);
        k.lamp(-40, 0, 34, 5.6);
        k.lamp(40, 0, -34, 5.6);
        for (const [x, z] of [[-64, -40], [64, -40], [-64, 40], [64, 40]] as const) k.bush(x, 0, z, 2.4, 0x6f8a4e);
        for (let i = 0; i < 9; i++) k.box(-96 + i * 24, 16 + (i % 3) * 9, -108, 18, 32 + (i % 3) * 18, 16, 0x7f8a92, false);
    },
};

const VERTICAL_CITY: MapDefinition = {
    id: 'vertical', name: 'VERTICAL CITY', tag: 'ARENA 05', theme: '屋顶都市 · 黄昏',
    blurb: '三层高度的街区：地面街道、五米天台、十三米高空连廊。占住屋顶的人能俯射整张图。',
    size: 88, sky: 0xd8a78c, fog: 0xcfa793, fogNear: 80, fogFar: 230,
    hemi: [0xffe4c8, 0x4c5560], hemiIntensity: 2.2, sun: 0xffc9a0, sunIntensity: 2.8, ground: 0x6b6f72,
    plan: [
        '..####......##',
        '..#==#......##',
        '..#==#....####',
        '..####....#==#',
        '...........#=#',
        '..===.....####',
        '..==....*.....',
        '.....*===.....',
        '.....=........',
        '..####....####',
        '..#==#....#==#',
        '..#==#......##',
        '..####......##',
        '..............',
    ],
    planColors: { open: 0x6b6f72, structure: 0x8d9498, deck: 0x4a5560, prop: 0xb5765c, water: 0x59636b, accent: 0xd5f66b },
    spawns: [[0, -80], [0, 80], [-76, 0], [76, 0], [-24, 10], [24, -10], [-24, 46], [24, -46], [0, 20], [0, -20], [-80, 70], [80, -70]],
    build(k) {
        const asphalt = 0x6b6f72, building = 0x8d9498, buildingDark = 0x767e84, deck = 0x4a5560, accent = 0xb5765c, steel = 0x5f6669;
        k.box(0, -.5, 0, 176, 1, 176, asphalt);
        // Cross streets, sidewalks and crossings.
        k.paint(0, 0, 28, 176, 0x5c6063);
        k.paint(0, 0, 176, 26, 0x5c6063);
        for (let i = -80; i <= 80; i += 8) k.box(i, .03, 0, 3, .02, 3, 0xb9bdb0, false);
        k.paint(-40, -40, 24, 24, 0x7a7f83);
        k.paint(40, 40, 24, 24, 0x7a7f83);
        // Mid rise blocks with walkable roofs at 5.1.
        const blocks: [number, number, number][] = [[-30, 30, 1], [30, -30, -1], [0, 62, 1]];
        for (const [x, z, dir] of blocks) {
            k.box(x, 2.4, z, 26, 4.8, 24, building);
            k.box(x, 4.95, z, 27, .3, 25, deck);
            k.stairsUpTo(x, dir < 0 ? z + 12.55 : z - 12.55, dir, 13, .4, 1.1, 4, steel, 'low roof stairs');
            const landing = z - dir * 12.55;
            k.route(`low roof ${x}/${z}`, [[x, 5.1, landing + dir * 1.6], [x, 5.1, z], [x + 9, 5.1, z - dir * 8]]);
            k.crate(x - 9, 5.1, z + 8, 1.7, accent);
            k.barrel(x + 9, 5.1, z - 8, 0x8d9498);
        }
        // Four towers, two tiers each, climbed by external switchback stairs.
        const towers: [number, number, number][] = [[-58, -58, 0x8d9498], [58, -58, 0x7f878d], [58, 58, 0x8a9298], [-58, 58, 0x7a8288]];
        for (const [x, z, c] of towers) {
            k.box(x, 3.2, z, 34, 6.4, 34, c);
            // Roof caps sit flush with the tier tops, so landings, bridges and rings share a level.
            k.box(x, 6.2, z, 35, .4, 35, deck);
            k.box(x, 9.6, z, 20, 6.4, 20, c);
            k.box(x, 12.6, z, 21, .4, 21, deck);
            k.box(x, 15.2, z, 8, 5, 8, buildingDark, false);
            for (let i = 0; i < 4; i++) {
                k.paint(x - 12 + i * 8, z - 17.8, 5, .8, 0xb9bdb0, 6.62);
                k.paint(x - 12 + i * 8, z + 17.8, 5, .8, 0xb9bdb0, 6.62);
            }
            for (const [sx, sz, sy] of stairTower(k, x + 24, z + 16, 2, steel, 'city stair')) {
                const targetX = sy > 8 ? x + 10 : x + 17.6;
                k.catwalk((sx + targetX) / 2, sy, sz, Math.abs(targetX - sx) + .4, 3, deck, steel);
                k.route(`city bridge ${x}/${sy}`, [[sx, sy + .2, sz], [(sx + targetX) / 2, sy + .2, sz], [targetX, sy + .2, sz]]);
                if (sy > 8) {
                    // Step off the upper bridge onto the tier, then split: across to the cross ring
                    // and along the tier to the lengthways ring. Two straight chains, no cliff edges.
                    k.route(`roof ${x}/${z}`, [[targetX, 12.8, sz], [targetX, 12.8, z - Math.sign(z) * 8], [x, 12.8, z - Math.sign(z) * 10], [x - Math.sign(x) * 10, 12.8, z]]);
                    k.route(`roof ring ${x}/${z}`, [[x, 12.8, z - Math.sign(z) * 10], [x, 12.8, z - Math.sign(z) * 28]]);
                }
            }
            k.crate(x - 12, 6.4, z + 12, 1.8, accent);
            k.crate(x - 10.2, 6.4, z + 12.6, 1.5, 0x9a7a58);
            k.barrel(x + 13, 6.4, z - 13, 0x8d9498);
            k.lamp(x + 12, 6.4, z + 13, 3.2);
        }
        // High bridges join the towers into a ring.
        k.catwalk(0, 12.8, -58, 100, 4, deck, steel);
        k.catwalk(0, 12.8, 58, 100, 4, deck, steel);
        k.catwalk(-58, 12.8, 0, 4, 100, deck, steel);
        k.catwalk(58, 12.8, 0, 4, 100, deck, steel);
        k.route('north sky ring', [[-44, 12.8, -58], [-14, 12.8, -58], [14, 12.8, -58], [44, 12.8, -58]]);
        k.route('south sky ring', [[-44, 12.8, 58], [-14, 12.8, 58], [14, 12.8, 58], [44, 12.8, 58]]);
        k.route('west sky ring', [[-58, 12.8, -44], [-58, 12.8, -14], [-58, 12.8, 14], [-58, 12.8, 44]]);
        k.route('east sky ring', [[58, 12.8, -44], [58, 12.8, -14], [58, 12.8, 14], [58, 12.8, 44]]);
        // Street level: barriers, planters, parked cars and lamps.
        for (let i = 0; i < 12; i++) {
            const x = -70 + i * 13;
            k.box(x, .6, -16, 4.6, 1.2, 2.2, i % 2 ? 0xa8b0a4 : accent);
            k.box(x, .6, 16, 4.6, 1.2, 2.2, i % 2 ? accent : 0xa8b0a4);
        }
        for (const [x, z, c] of [[-18, -44, 0xc2704a], [18, 44, 0x4f7f96], [-44, 18, 0xd8c05a], [44, -18, 0x7d8f6a], [0, -32, 0xb9bdb0], [0, 32, accent]] as const) {
            k.box(x, .75, z, 5.2, 1.5, 2.6, c);
            k.box(x - .6, 1.9, z, 3, 1, 2.4, 0x3f464a, false);
        }
        for (const [x, z] of [[-26, -14], [26, 14], [-14, 26], [14, -26]] as const) {
            k.box(x, .5, z, 4, 1, 4, 0x6f7a66);
            k.bush(x, 1, z, 3, 0x5f7a52);
        }
        for (const x of [-52, -26, 26, 52]) for (const z of [-76, 76]) k.lamp(x, 0, z, 6.4);
        for (const z of [-52, -26, 26, 52]) for (const x of [-76, 76]) k.lamp(x, 0, z, 6.4);
        for (let i = 0; i < 12; i++) k.box(-120 + i * 22, 22 + (i % 4) * 11, -122, 18, 44 + (i % 4) * 22, 16, i % 2 ? 0x7f878d : 0x8d9498, false);
    },
};

const GLACIER: MapDefinition = {
    id: 'glacier', name: 'GLACIER OUTPOST', tag: 'ARENA 06', theme: '冰原前哨 · 极地',
    blurb: '冰墙迷宫中间横着一条冰裂缝，三座冰桥是唯一的高线。雷达站土丘是全图最高的火力点。',
    size: 86, sky: 0xcadff0, fog: 0xd5e6f2, fogNear: 70, fogFar: 200,
    hemi: [0xf2fbff, 0x7d8f9c], hemiIntensity: 2.6, sun: 0xf4f8ff, sunIntensity: 2.2, ground: 0xe8eef2,
    plan: [
        '......==......',
        '..##......##..',
        '..#=#....#=#..',
        '..##......##..',
        '.....~~~~.....',
        '==...~~~~...==',
        '==...~~~~...==',
        '.....~~~~.....',
        '..##......##..',
        '..#=#....#=#..',
        '..##......##..',
        '......==......',
        '..............',
        '..............',
    ],
    planColors: { open: 0xe8eef2, structure: 0x8fa3b0, deck: 0x6f8798, prop: 0xb9ccd8, water: 0xa8cfe0, accent: 0xd5f66b },
    spawns: [[-30, -70], [30, -70], [-70, -40], [70, -40], [-70, 40], [70, 40], [-30, 70], [30, 70], [0, -30], [0, 30], [-34, 16], [34, -16]],
    build(k) {
        const snow = 0xe8eef2, ice = 0xb9ccd8, iceDeep = 0x8fa3b0, rock = 0x7d8b96, steel = 0x6b7a86, dark = 0x4c5a63;
        // Snow field split by a crevasse; the floor under it is walkable.
        k.box(0, -.4, -46, 172, .8, 80, snow);
        k.box(0, -.4, 46, 172, .8, 80, snow);
        k.box(0, -2.8, 0, 172, .4, 14, dark);
        k.paint(0, 0, 172, 12, 0x3f4b54, -2.56);
        for (const x of [-46, -22, 0, 22, 46]) {
            k.box(x, -.1, 0, 7, .6, 15, ice);
            k.box(x, .45, -6.4, 7, 1.4, .3, ice, false);
            k.box(x, .45, 6.4, 7, 1.4, .3, ice, false);
        }
        k.route('crevasse floor', [[-50, -2.6, 0], [-20, -2.6, 0], [12, -2.6, 0], [50, -2.6, 0]]);
        k.stairsUpTo(-56, -5.4, -1, 7, .4, 1.1, 4, ice, 'west crevasse ramp', -2.6);
        k.stairsUpTo(56, 5.4, 1, 7, .4, 1.1, 4, ice, 'east crevasse ramp', -2.6);
        // Bunkers with walkable roofs and firing slits.
        for (const [x, z] of [[-42, -24], [42, 24]] as const) {
            k.box(x, 1.8, z, 24, 3.6, 17, iceDeep);
            k.box(x, 3.75, z, 25, .3, 18, rock);
            k.paint(x, z - 8.6, 15, .7, dark, 1.4);
            k.paint(x, z + 8.6, 15, .7, dark, 1.4);
            k.stairsUpTo(x, z + 9.15, -1, 10, .4, 1.15, 4, steel, 'bunker stairs');
            k.route(`bunker roof ${x}`, [[x, 3.9, z + 8], [x, 3.9, z], [x + 8, 3.9, z - 5]]);
            k.crate(x + 8, 3.9, z + 5, 1.7, steel);
            k.barrel(x - 8, 3.9, z - 5, 0x8fa3b0);
        }
        // Ice wall maze and cover blocks.
        for (const [x, z, w, d, h] of [[-24, -34, 18, 2, 3.6], [24, 38, 18, 2, 3.6], [-70, 14, 2, 28, 4.4], [70, -14, 2, 28, 4.4], [-12, 38, 2, 18, 3], [12, -38, 2, 18, 3], [-40, 64, 22, 2, 3.2], [40, -64, 22, 2, 3.2]] as const) {
            k.box(x, h / 2, z, w, h, d, ice);
            k.box(x, h + .2, z, w + .6, .4, d + .6, snow);
        }
        // Snow drifts and the radar hill.
        k.hill(-58, -58, 28, 22, 3.2, 0xf2f7fa, 'north drift');
        k.hill(58, 58, 26, 20, 2.8, 0xeef4f8, 'south drift');
        k.hill(0, 62, 30, 20, 4.4, 0xf6fbff, 'radar hill');
        // Radar station beside the drift: a deck at 5.6 reached by an external flight, so the hill
        // itself stays open to climb.
        k.box(22, 2.6, 62, 8, 5.2, 8, steel);
        k.box(22, 5.4, 62, 9, .4, 9, rock);
        k.route('radar deck', [[22, 5.6, 58], [22, 5.6, 62], [22, 5.6, 66]]);
        k.stairsUpTo(22, 57.95, 1, 14, .4, 1.1, 4, steel, 'radar stairs');
        k.box(25.6, 7.6, 65.4, 1.2, 3.6, 1.2, steel);
        k.box(25.6, 9.8, 65.4, 6, 1.4, 3.4, ice, false);
        k.sign('RADAR 06', 22, 7.4, 57.4, 8, 1.3, dark, 0xe8f3f8);
        k.crate(19, 5.6, 65, 1.8, steel);
        k.crate(20.8, 5.6, 65.6, 1.5, 0x8fa3b0);
        k.barrel(19, 5.6, 59, 0x6b7a86);
        // Scattered cover, pipes and lamps.
        for (const [x, z, w, h] of [[-60, -70, 5, 2.4], [60, 70, 5, 2.4], [-16, -60, 4.4, 1.8], [14, 44, 4.4, 1.8], [-66, 58, 5, 2.2], [66, -58, 5, 2.2]] as const) k.rock(x, 0, z, w, h, rock);
        for (const [x, z] of [[-30, -44], [30, 44], [-52, 26], [52, -26], [0, -44], [0, 44]] as const) k.crate(x, 0, z, 1.8, steel);
        for (const [x, z, len, axis] of [[-30, -56, 24, 'x'], [30, 40, 24, 'x'], [-58, 0, 30, 'z'], [58, 0, 30, 'z']] as const) k.pipe(x, 2.6, z, len, axis, steel);
        for (const [x, z] of [[-24, 0], [24, 0], [-74, -62], [74, 62]] as const) k.lamp(x, 0, z, 6);
        for (const [x, z] of [[-80, 30], [80, -30], [-80, -30], [80, 30]] as const) k.bush(x, 0, z, 2.6, 0x8fa3b0);
        for (let i = 0; i < 14; i++) k.box(-120 + i * 18, 18 + (i % 3) * 10, 118, 14, 36 + (i % 3) * 20, 14, i % 2 ? 0xcfdde8 : 0xbccbd8, false);
    },
};

const ARENA: MapDefinition = {
    id: 'arena', name: 'ARENA PIT', tag: 'ARENA 07', theme: '下沉竞技场 · 石造',
    blurb: '一座三层看台的下沉斗兽场：坑底近战、看台中距离、四角塔楼远射。没有一条长直线。',
    size: 84, sky: 0xbfc9b4, fog: 0xc7d0bb, fogNear: 90, fogFar: 250,
    hemi: [0xf3f7e2, 0x6d6b58], hemiIntensity: 2.3, sun: 0xfff3d2, sunIntensity: 2.6, ground: 0xb9b39a,
    plan: [
        '..............',
        '....######....',
        '..##======##..',
        '..#========#..',
        '.#==######==#.',
        '.#=##....##=#.',
        '#==#..**..#==#',
        '#==#..**..#==#',
        '.#=##....##=#.',
        '.#==######==#.',
        '..#========#..',
        '..##======##..',
        '....######....',
        '..............',
    ],
    planColors: { open: 0xb9b39a, structure: 0x9a9179, deck: 0xd9d2b6, prop: 0x8a7f68, water: 0x6f7f6a, accent: 0xd5f66b },
    spawns: [[-70, -70], [70, -70], [70, 70], [-70, 70], [0, -60], [0, 60], [-60, 0], [60, 0], [0, -30], [0, 30], [-30, 0], [30, 0]],
    build(k) {
        const stone = 0x9a9179, stoneDark = 0x8a7f68, sand = 0xd9d2b6, dirt = 0x7d6f58, gold = 0xc2a25e;
        // Ground ring around the bowl.
        k.box(0, -.5, -67, 168, 1, 34, stone);
        k.box(0, -.5, 67, 168, 1, 34, stone);
        k.box(-67, -.5, 0, 34, 1, 100, stone);
        k.box(67, -.5, 0, 34, 1, 100, stone);
        // Bowl: pit floor plus two tiers, all reachable from outside in.
        k.box(0, -2.2, 0, 78, .4, 78, dirt);
        for (const [half, y] of [[26, -1], [38, 0]] as const) {
            const height = y + 2, centre = (y - 2) / 2;
            k.box(0, centre, -(half + 6), (half + 6) * 2, height, 12, sand);
            k.box(0, centre, half + 6, (half + 6) * 2, height, 12, sand);
            k.box(-(half + 6), centre, 0, 12, height, (half + 6) * 2, sand);
            k.box(half + 6, centre, 0, 12, height, (half + 6) * 2, sand);
            // Corner blocks close the ring: without them the four corners fall through to the pit.
            for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const)
                k.box(cx * (half + 3), centre, cz * (half + 3), 11, height, 11, sand);
        }
        k.paint(0, 0, 38, 38, 0xc0b28f, -1.95);
        k.sign('ARENA 07', 0, 1.2, -20.4, 9, 1.3, stoneDark, gold);
        // Steps from the pit up to the first tier and from the first to the second.
        k.stairsUpTo(0, -26.5, -1, 3, .4, 1, 5, stone, 'pit steps north', -2);
        k.stairsUpTo(0, 26.5, 1, 3, .4, 1, 5, stone, 'pit steps south', -2);
        k.stairsUpTo(0, -38.5, -1, 3, .34, 1, 5, stone, 'tier steps north', -1);
        k.stairsUpTo(0, 38.5, 1, 3, .34, 1, 5, stone, 'tier steps south', -1);
        k.route('pit floor', [[-16, -2, -16], [-16, -2, 16], [16, -2, 16]]);
        k.route('lower tier', [[-30, -1, -30], [-30, -1, 30], [30, -1, 30]]);
        k.route('upper tier', [[-44, 0, -44], [-44, 0, 44], [44, 0, 44]]);
        // Pillars ring the tiers and give the bowl its silhouette.
        for (const r of [12.4, 24.4, 36.4]) for (const [x, z] of [[-r, -r], [r, -r], [r, r], [-r, r]] as const) k.box(x, 3.4, z, 1.6, 6.8, 1.6, stoneDark);
        for (const r of [20, 32]) for (const [x, z] of [[-r, 0], [r, 0], [0, -r], [0, r]] as const) k.box(x, 3.4, z, 1.6, 6.8, 1.6, stoneDark);
        // Central podium with crates.
        k.box(0, -.8, 0, 12, 2.4, 12, stoneDark);
        k.box(0, .5, 0, 13, .3, 13, sand);
        k.crate(-3, .65, -3, 1.8, 0xb5824f);
        k.crate(-1.2, .65, -3.6, 1.5, 0x9a7a58);
        k.crate(3, .65, 3, 1.7, 0xb5824f);
        k.barrel(-3.4, .65, 3.2, 0x8a7f68);
        k.stairsUpTo(0, -6.55, 1, 6, .4, 1.1, 4, stone, 'podium steps', -2);
        // Corner towers on the rim give long sight lines.
        for (const [x, z] of [[-58, -58], [58, -58], [58, 58], [-58, 58]] as const) {
            k.box(x, 2.4, z, 14, 4.8, 14, stone);
            k.box(x, 4.95, z, 15, .3, 15, sand);
            k.stairsUpTo(x, z + (z > 0 ? -7.6 : 7.6), z > 0 ? 1 : -1, 13, .4, 1.2, 4, stoneDark, 'tower stairs');
            k.route(`side tower ${x}/${z}`, [[x, 5.1, z + (z > 0 ? -7 : 7)], [x, 5.1, z], [x + 5, 5.1, z]]);
            k.barrel(x + 5, 5.1, z + 5, 0x8a7f68);
            k.barrel(x + 6.2, 5.1, z + 5.4, 0x9a9179);
        }
        // Outer cover and entrances.
        for (const [x, z] of [[-70, 0], [70, 0], [0, -70], [0, 70]] as const) k.arch(x, 0, z, 12, 5, 2, stoneDark);
        for (const [x, z] of [[-44, -70], [44, 70], [-70, 44], [70, -44]] as const) {
            k.box(x, 1.2, z, 10, 2.4, 3, stone);
            k.crate(x + 6, 0, z + 2, 1.8, 0xb5824f);
        }
        for (const [x, z] of [[-70, -30], [70, 30], [-30, 70], [30, -70]] as const) k.tree(x, 0, z, 1, 0x8a7a58, 0x6f8a4e, 0x879f5c);
        for (const [x, z] of [[-50, 20], [50, -20], [20, 50], [-20, -50]] as const) k.lamp(x, 0, z, 6);
        for (let i = 0; i < 12; i++) k.box(-110 + i * 20, 10 + (i % 3) * 6, -108, 16, 20 + (i % 3) * 12, 14, 0xa8a08a, false);
    },
};

const FACTORY: MapDefinition = {
    id: 'factory', name: 'FACTORY FLOOR', tag: 'ARENA 08', theme: '重工车间 · 钢铁',
    blurb: '厂房里三排机器把地面切成走廊，两层检修栈桥从头顶穿过。储罐区与装卸区是外场的硬掩体。',
    size: 88, sky: 0xb8b6ab, fog: 0xbcbcb2, fogNear: 70, fogFar: 200,
    hemi: [0xe8e6da, 0x555049], hemiIntensity: 2.2, sun: 0xf6ecd6, sunIntensity: 2.3, ground: 0x9d9a90,
    plan: [
        '..####....####',
        '.#====#..#==#.',
        '.#=##=#..#==#.',
        '#==##==#.####.',
        '#=#..#=#......',
        '#=#..#=#..##..',
        '#=#..#=#..##..',
        '#==##==#......',
        '.#=##=#..####.',
        '.#====#..#==#.',
        '..####....####',
        '..............',
        '....####......',
        '..............',
    ],
    planColors: { open: 0x9d9a90, structure: 0x7f8489, deck: 0xc2704a, prop: 0x5f6669, water: 0x4a5560, accent: 0xd5f66b },
    spawns: [[-64, -64], [64, -64], [-64, 64], [64, 64], [0, -70], [0, 70], [-70, 0], [70, 0], [-40, 34], [40, -34], [24, 62], [-24, -62]],
    build(k) {
        const slab = 0x9d9a90, steel = 0x7f8489, dark = 0x5f6669, rust = 0xc2704a, hazard = 0xd8c05a, machine = 0x6f7a80;
        k.box(0, -.5, 0, 176, 1, 176, slab);
        k.paint(0, 0, 176, 20, 0x8b8880);
        // Main hall: walls with two wide doors and pillars inside.
        for (const z of [-28, 28]) {
            for (const [cx, w] of [[-36, 24], [-6, 16], [24, 24]] as const) k.box(cx, 4, z, w, 8, 1.2, steel);
        }
        k.box(-48, 4, 0, 1.2, 8, 56, steel);
        k.box(36, 4, 0, 1.2, 8, 56, steel);
        for (const x of [-30, -6, 18]) for (const z of [-12, 12]) k.box(x, 4, z, 1.4, 8, 1.4, dark);
        k.sign('FACTORY 08', -6, 5.6, -28.7, 13, 1.5, dark, hazard);
        // Three rows of machines.
        for (const z of [-18, 0, 18]) {
            for (let i = 0; i < 4; i++) {
                const x = -36 + i * 18;
                k.box(x, 1.2, z, 12, 2.4, 5, machine);
                k.box(x, 2.6, z - 1.4, 13, .5, 1, rust);
                k.box(x - 5, 2.8, z + 2, 2, 1.6, 1.6, dark);
            }
        }
        // Mezzanine catwalk ring at 5.45, reached from the shop floor.
        for (const z of [-24, 24]) k.box(-6, 5.2, z, 78, .5, 5, rust);
        // Side catwalks sit inboard of the hall walls, which leaves the flights room to clear them.
        for (const x of [-40, 30]) k.box(x, 5.2, 0, 5, .5, 48, rust);
        k.box(-6, 5.55, -26.4, 78, .3, .3, hazard, false);
        k.box(-6, 5.55, 26.4, 78, .3, .3, hazard, false);
        k.route('catwalk north', [[-40, 5.45, -24], [-14, 5.45, -24], [16, 5.45, -24], [30, 5.45, -24]]);
        k.route('catwalk south', [[-40, 5.45, 24], [-14, 5.45, 24], [16, 5.45, 24], [30, 5.45, 24]]);
        k.route('catwalk west', [[-43, 5.45, -22], [-40, 5.45, -6], [-40, 5.45, 10], [-40, 5.45, 22]]);
        k.route('catwalk east', [[27, 5.45, 22], [30, 5.45, 8], [30, 5.45, -8], [30, 5.45, -20]]);
        // Flights stop just short of the catwalk edge: standing under a catwalk leaves no head room.
        k.stairsUpTo(-46, -21, -1, 14, .4, 1.1, 4, steel, 'catwalk stairs west');
        k.stairsUpTo(26, 21, 1, 14, .4, 1.1, 4, steel, 'catwalk stairs east');
        k.catwalk(-42, 5.45, 18.8, 5, 3, steel);
        k.route('catwalk link', [[-44, 5.45, 18.8], [-40.5, 5.45, 20.5]]);
        // Service deck at 10.8 over the shop, climbed as a switchback from the west catwalk.
        k.platform(6, 10.8, 0, 26, 22, dark);
        k.box(6, 11.05, -11.4, 26, .3, .3, hazard, false);
        k.box(6, 11.05, 11.4, 26, .3, .3, hazard, false);
        k.stairsUpTo(-44, 12, -1, 7, .4, 1.05, 4, steel, 'service stairs a', 5.45);
        k.platform(-44, 8.25, 9.2, 4.4, 7, steel);
        k.route('service landing', [[-44, 8.25, 11], [-44, 8.25, 8], [-44, 8.25, 6]]);
        k.stairsUpTo(-44, 0, -1, 7, .4, 1.05, 4, steel, 'service stairs b', 8.25);
        k.catwalk(-25.5, 11.05, 0, 37, 3, dark, steel);
        k.route('service deck', [[-6, 11, 0], [6, 11, 0], [16, 11, 0]]);
        k.route('service bridge', [[-43, 11.1, 0], [-25, 11.1, 0], [-8, 11.1, 0]]);
        // Tanks, pipes and the sawtooth roof.
        for (const [x, z] of [[-58, 0], [-58, 20], [-58, -20], [44, 44], [44, -44], [0, 44]] as const) {
            k.box(x, 3.2, z, 10, 6.4, 10, steel);
            k.box(x, 6.6, z, 11, .5, 11, rust);
            k.pipe(x, 7.6, z, 12, 'z', dark, .4, false);
        }
        for (const x of [-30, -10, 10]) k.box(x, 12.4, 0, 16, .5, 58, steel, false);
        for (let i = 0; i < 5; i++) k.box(-38 + i * 16, 13.6, 0, 14, 2, 58, 0x8f9490, false);
        // Loading yard: docks, trailers, containers.
        for (let i = 0; i < 3; i++) {
            const z = -60 + i * 16;
            k.box(60, .9, z, 7, 1.8, 12, slab);
            k.box(58, 1.9, z, 5.6, 2, 10, steel);
        }
        k.container(66, 0, 34, 0xc06a4a, true, 'FACTORY OUT');
        k.container(66, 0, 50, 0x6f9aa4, true, 'FACTORY OUT');
        k.container(-66, 0, -40, 0xd6a860, false, 'FACTORY OUT');
        k.crate(-62, 0, 44, 2, 0xb5824f);
        k.crate(-60, 0, 45, 1.6, 0x9a7a58);
        k.barrel(58, 0, -30, 0xa8704c);
        k.barrel(59.4, 0, -30.6, 0x7f8489);
        for (const [x, z] of [[-72, -72], [72, 72], [-72, 72], [72, -72], [0, 74]] as const) k.lamp(x, 0, z, 7);
        for (let i = 0; i < 10; i++) k.box(-110 + i * 24, 15 + (i % 3) * 8, -112, 20, 30 + (i % 3) * 16, 16, 0x8b8f8a, false);
    },
};

const TEMPLE: MapDefinition = {
    id: 'temple', name: 'JUNGLE TEMPLE', tag: 'ARENA 09', theme: '丛林神庙 · 潮湿',
    blurb: '四层石阶金字塔被树冠走廊连成一体，水池与断柱提供掩护。高低差就是这张图的全部战术。',
    size: 88, sky: 0x9fc4a8, fog: 0xa8cbaf, fogNear: 60, fogFar: 180,
    hemi: [0xdff5e0, 0x4e5a44], hemiIntensity: 2.4, sun: 0xf4ffd8, sunIntensity: 2.2, ground: 0x7f8f63,
    plan: [
        '..............',
        '..~~~.....##..',
        '..~~~.....##..',
        '.....####.....',
        '....#====#....',
        '...#======#...',
        '...#======#...',
        '....#====#....',
        '.....####.....',
        '..##......##..',
        '..##......##..',
        '..............',
        '....**..**....',
        '..............',
    ],
    planColors: { open: 0x7f8f63, structure: 0xb0a181, deck: 0x8a7f68, prop: 0x5f7a4a, water: 0x4f8a92, accent: 0xd5f66b },
    spawns: [[-66, -66], [66, -66], [-66, 66], [66, 66], [0, -66], [0, 66], [-66, 0], [66, 0], [-30, 34], [30, -34], [46, 30], [-46, -30]],
    build(k) {
        const moss = 0x7f8f63, stone = 0xb0a181, stoneDark = 0x8a7f68, green = 0x5f7a4a, green2 = 0x71905a, water = 0x4f8a92;
        k.box(0, -.5, 0, 176, 1, 176, moss);
        k.paint(0, 0, 176, 18, 0x6f7d55);
        // Jungle floor detail: clearings, bushes and trees.
        for (const [x, z, w, d] of [[-62, 30, 22, 18], [58, -34, 20, 16], [-20, 62, 26, 14], [22, -62, 24, 14]] as const) k.paint(x, z, w, d, green, .03);
        for (const [x, z] of [[-78, -30], [78, 30], [-30, 76], [30, -76], [-64, 8], [64, -8], [-8, 64], [8, -64]] as const) k.tree(x, 0, z, 1.1, 0x6f5f44, green, green2);
        for (const [x, z, s] of [[-42, 18, 3], [42, -18, 3], [-18, -42, 2.6], [18, 42, 2.6], [-52, -52, 3.4], [52, 52, 3.4]] as const) k.bush(x, 0, z, s, green2);
        // Water pool with a stone rim.
        k.box(-58, -1.1, -58, 30, 1, 30, water);
        k.box(-58, -.2, -58, 32, .4, 1.4, stone);
        k.box(-58, -.2, -43, 32, .4, 1.4, stone);
        k.box(-73, -.2, -58, 1.4, .4, 30, stone);
        k.box(-43, -.2, -58, 1.4, .4, 30, stone);
        k.paint(-58, -58, 28, 28, 0x3f7a84, -0.56);
        k.route('pool rim', [[-73, 0, -70], [-58, 0, -70], [-43, 0, -58], [-58, 0, -43], [-73, 0, -58]]);
        // Stepped pyramid: four tiers with flights cascading down both faces.
        const tiers: [number, number][] = [[38, 2.4], [28, 4.8], [18, 7.2], [9, 9.6]];
        for (let i = 0; i < tiers.length; i++) {
            const [w, h] = tiers[i], from = i ? tiers[i - 1][1] : 0, edge = w / 2;
            k.box(0, (from + h) / 2, 0, w, h - from, w, stone);
            k.box(0, h + .15, 0, w + 1.2, .3, w + 1.2, stoneDark);
            const steps = Math.round((h - from) / .4);
            k.stairsUpTo(0, -edge - .31, 1, steps, .4, .62, 6, stoneDark, `pyramid flight ${i} north`, from);
            k.stairsUpTo(0, edge + .31, -1, steps, .4, .62, 6, stoneDark, `pyramid flight ${i} south`, from);
        }
        k.route('pyramid summit', [[-3.6, 9.9, -3.6], [3.6, 9.9, -3.6], [3.6, 9.9, 3.6], [-3.6, 9.9, 3.6]]);
        // Shrine kept small: the walkable ring on top is only 4.5m wide.
        k.box(0, 11.4, 0, 4, 3, 4, stoneDark);
        k.box(0, 13.2, 0, 5, .6, 5, stone);
        // Gate stands on the ground at the foot of the south flight; the summit ring stays clear.
        k.arch(0, 0, 22, 8, 5, 1.4, stone);
        k.sign('TEMPLE 09', 0, 12, 4.6, 7, 1.2, 0x5f5340, 0xf0e6c8);
        k.crate(-4, 9.9, 3.6, 1.7, 0x8a7f68);
        k.barrel(4, 9.9, -3.6, 0x6f7a66);
        // Tree platforms and canopy walkways joining the summit.
        for (const [x, z] of [[-34, -34], [34, 34]] as const) {
            k.box(x, 5, z, 4, 10, 4, 0x6f5f44);
            k.platform(x, 9.9, z, 16, 16, 0x8a7f68, stoneDark);
            k.hut(x, 9.9, z, 9, 3.4, 9, stone, 0x6f5f44, 1);
            k.route(`canopy ${x}`, [[x + 6, 9.95, z + 6], [x + 6, 9.95, z], [x + 6, 9.95, z - 6], [x - 6, 9.95, z - 6]]);
            // The ladder climbs from beyond the deck edge: under the deck there is no head room.
            k.stairsUpTo(x + 5.5, z + 8.5, -1, 25, .4, .6, 4, 0x6f5f44, 'tree ladder');
        }
        k.catwalk(-40, 9.9, -21.6, 3.4, 36.8, 0x8a7f68, stoneDark);
        k.catwalk(-22, 9.9, -3.2, 38, 3.4, 0x8a7f68, stoneDark);
        k.catwalk(40, 9.9, 21.6, 3.4, 36.8, 0x8a7f68, stoneDark);
        k.catwalk(22, 9.9, 3.2, 38, 3.4, 0x8a7f68, stoneDark);
        k.route('canopy west', [[-40, 9.95, -40], [-40, 9.95, -3.2], [-22, 9.95, -3.2], [-5, 9.95, -3.2]]);
        k.route('canopy east', [[40, 9.95, 40], [40, 9.95, 3.2], [22, 9.95, 3.2], [5, 9.95, 3.2]]);
        // Broken walls, columns and the side shrine.
        for (const [x, z, w, d, h] of [[-46, 26, 24, 2, 3.6], [46, -26, 24, 2, 3.6], [26, 46, 2, 24, 3.2], [-26, -46, 2, 24, 3.2]] as const) {
            k.box(x, h / 2, z, w, h, d, stone);
            k.box(x, h + .2, z, w + .6, .4, d + .6, stoneDark);
            if (w > d) {
                k.stairsUpTo(x, z + d / 2 + .55, -1, 10, .4, 1.1, 4, stoneDark, 'wall steps');
                k.route(`wall top ${x}/${z}`, [[x - w / 2 + 2, h + .4, z], [x, h + .4, z], [x + w / 2 - 2, h + .4, z]]);
            }
        }
        for (const [x, z] of [[-30, -8], [-22, -8], [30, 8], [22, 8], [-8, 30], [8, 30], [-8, -30], [8, -30]] as const) k.box(x, 2.4, z, 1.6, 4.8, 1.6, stone);
        k.hut(-62, 0, 8, 16, 4.4, 14, stone, 0x6f5f44, 1);
        k.stairsUpTo(-62, 15.4, -1, 13, .4, 1.15, 4, stoneDark, 'shrine stairs');
        k.sign('SHRINE', -62, 3.2, 15.7, 8, 1.3, 0x5f5340, 0xf0e6c8);
        k.arch(56, 0, -56, 12, 5, 1.4, stone);
        for (const [x, z] of [[-40, 66], [40, -66], [66, 40], [-66, -40]] as const) k.crate(x, 0, z, 1.8, 0x8a7f68);
        for (let i = 0; i < 14; i++) k.box(-120 + i * 18, 16 + (i % 3) * 9, 116, 14, 32 + (i % 3) * 18, 14, i % 2 ? 0x6f8a5c : 0x5f7a4a, false);
    },
};

const OIL_RIG: MapDefinition = {
    id: 'oilrig', name: 'OFFSHORE RIG', tag: 'ARENA 10', theme: '海上钻井平台 · 钢构',
    blurb: '悬在深海上的三层钢铁平台：主甲板、钻井台、直升机坪。掉进海里只能爬梯子回来。',
    size: 84, sky: 0x8fb3c9, fog: 0x9db9c9, fogNear: 80, fogFar: 230,
    hemi: [0xdff0fa, 0x3f5866], hemiIntensity: 2.4, sun: 0xfff2d8, sunIntensity: 2.6, ground: 0x8b9196,
    plan: [
        '..............',
        '..##########..',
        '..#===#==###..',
        '..#===#==###..',
        '..##########..',
        '..##=====###..',
        '..#=HHH==##...',
        '..##=====###..',
        '..##########..',
        '...#########..',
        '....~~~~~~~...',
        '....~~~~~~~...',
        '....~~~~~~~...',
        '..............',
    ],
    planColors: { open: 0x8b9196, structure: 0x7c848a, deck: 0xd8c05a, prop: 0xc2704a, water: 0x2f6f8f, accent: 0xd5f66b },
    spawns: [[-30, -24], [18, -6], [-30, 24], [4, 26], [0, -28], [-12, 26], [-34, -6], [16, -26], [-4, 31], [-20, -28], [30, 12], [-16, 6]],
    build(k) {
        const sea = 0x2f6f8f, steel = 0x7c848a, deck = 0x6c757b, hazard = 0xd8c05a, rust = 0xc2704a, dark = 0x4c5459;
        // Open sea, then the rig deck floating on it.
        k.box(0, -3.6, 0, 168, 2, 168, 0x24566f);
        k.box(0, -3, 0, 168, .8, 168, sea);
        k.box(0, -.4, 0, 76, .8, 64, deck);
        k.paint(0, 0, 74, 62, 0x7c848a);
        for (const [x, z] of [[-34, -30], [34, -30], [34, 30], [-34, 30]] as const) {
            k.box(x, -1.4, z, 5, 4, 5, dark);
            k.box(x, .9, z, 5.4, 1, 5.4, rust);
        }
        // Hazard stripes along both deck edges.
        for (let z = -28; z <= 28; z += 6) {
            k.box(-36.6, .06, z, 1.6, .12, 3, hazard, false);
            k.box(36.6, .06, z, 1.6, .12, 3, hazard, false);
        }
        for (let x = -32; x <= 32; x += 6) {
            k.box(x, .06, -30.6, 3, .12, 1.6, hazard, false);
            k.box(x, .06, 30.6, 3, .12, 1.6, hazard, false);
        }
        k.sign('RIG 10', 0, 1.4, -32.4, 10, 1.4, dark, hazard);
        // Rescue ladder from the water back onto the deck.
        k.stairsUpTo(-30, 32.55, -1, 7, .4, 1.1, 4, rust, 'rescue ladder', -2.6);
        k.route('water line', [[-46, -2.6, 40], [-46, -2.6, -40], [46, -2.6, -40]]);
        // Drill floor at 5.2 with the derrick above it.
        k.box(0, 5.2, 4, 34, .6, 30, deck);
        k.box(0, 5.55, -10.6, 34, .3, .3, hazard, false);
        k.box(0, 5.55, 18.6, 34, .3, .3, hazard, false);
        k.route('drill floor', [[-14, 5.5, -9], [-14, 5.5, 8], [-8, 5.5, -8], [0, 5.5, -8]]);
        k.stairsUpTo(-14, -11.55, 1, 13, .4, 1.1, 4, steel, 'drill floor stairs');
        k.stairsUpTo(14, 19.55, -1, 13, .4, 1, 4, steel, 'drill floor stairs 2');
        for (const [x, z] of [[-7, -1], [7, -1], [7, 9], [-7, 9]] as const) k.box(x, 8.2, z, 1.6, 6, 1.6, rust);
        k.platform(0, 8.4, 4, 14, 14, steel, dark);
        k.box(0, 10.2, 4, 15, .5, 15, rust, false);
        k.route('derrick top', [[0, 8.6, -3], [0, 8.6, 4], [5, 8.6, 4]]);
        k.stairsUpTo(0, -3.28, 1, 8, .4, .55, 4, steel, 'derrick stairs', 5.2);
        k.crate(4, 8.6, 8, 1.7, 0x8fa3b0);
        k.barrel(-4, 8.6, 0, rust);
        // Helipad tower at 12.4 with an "H" painted on it.
        k.box(34, 5.6, -24, 20, 11.2, 20, dark);
        k.platform(34, 12.4, -24, 26, 26, steel, hazard);
        k.paint(34, -24, 16, 4, hazard, 12.62);
        k.paint(28.4, -24, 3, 12, hazard, 12.62);
        k.paint(39.6, -24, 3, 12, hazard, 12.62);
        k.route('helipad', [[30, 12.6, -14], [30, 12.6, -24], [42, 12.6, -24]]);
        k.stairsUpTo(30, -11.75, -1, 31, .4, .5, 4, steel, 'helipad stairs');
        k.crate(42, 12.6, -16, 1.8, 0x8fa3b0);
        k.barrel(26, 12.6, -16, rust);
        // Crane, pipe racks, crew quarters and supply containers on the deck.
        k.box(-30, 4.8, -20, 3, 9.6, 3, steel);
        k.box(-30, 4.8, -6, 3, 9.6, 3, steel);
        k.box(-30, 9.6, -13, 3, .8, 18, rust);
        k.box(-30, 10.4, -13, 1.6, 1.6, 1.6, hazard);
        k.hut(26, 0, 22, 20, 4.4, 16, 0x9aa3a8, dark, 1);
        k.stairsUpTo(26, 13.4, 1, 13, .4, 1.15, 4, steel, 'quarters stairs');
        k.sign('CREW', 26, 3.2, 30.7, 8, 1.3, dark, hazard);
        for (const z of [-24, -8, 8, 20]) {
            k.box(-6, 1.3, z, 6, 2.6, 2.6, steel);
            k.pipe(-6, 2.9, z, 8, 'x', rust, .3, false);
        }
        k.container(-52, 0, 20, 0xc06a4a, true, 'RIG SUPPLY');
        k.container(-52, 0, 40, 0x6f9aa4, false, 'RIG SUPPLY');
        k.crate(-46, 0, 2, 2, 0xb5824f);
        k.crate(-44, 0, 3, 1.6, 0x9a7a58);
        k.barrel(14, 0, -28, rust);
        k.barrel(15.4, 0, -28.6, steel);
        for (const [x, z] of [[-36, -34], [36, 34], [-36, 34], [36, -34]] as const) k.lamp(x, 0, z, 6.4);
        for (const [x, z] of [[-74, 0], [74, 0], [0, -74], [0, 74]] as const) k.box(x, 1.4, z, 26, 2.8, 26, 0x6f8f9c, false);
    },
};

const SANDSTORM: MapDefinition = {
    id: 'sandstorm', name: 'SANDSTORM', tag: 'TACTICAL 01', theme: '沿海旧城 · 风蚀市场',
    blurb: '一条高架市场横跨低处通道，北侧仓库和南侧船坞构成两条进攻翼。原创 5v5 爆破场。',
    size: 90, sky: 0xc9d5cf, fog: 0xd7c7a5, fogNear: 80, fogFar: 230,
    hemi: [0xffefd8, 0x796f5d], hemiIntensity: 2.2, sun: 0xffddab, sunIntensity: 2.7, ground: 0xcbb58a,
    plan: [
        '..............',
        '..####..####..',
        '..##.......##.',
        '..##..==...##.',
        '.....==.......',
        '...#.....#....',
        '.....##.......',
        '..............',
        '.....##.......',
        '...#.....#....',
        '.....==.......',
        '..##..==...##.',
        '..####..####..',
        '..............',
    ],
    planColors: { open: 0xcbb58a, structure: 0xa88d69, deck: 0x766a5c, prop: 0x865e44, water: 0x6e9b9f, accent: 0xd6a958 },
    spawns: [[-72, -36], [-72, -18], [-72, 0], [-72, 18], [-72, 36],
        [72, -36], [72, -18], [72, 0], [72, 18], [72, 36],
        [-38, -44], [-38, 44], [37, -46], [37, 46]],
    tactical: { sites: { A: [37, -46, 9], B: [37, 46, 9] },
        attackers: [0, 1, 2, 3, 4], defenders: [5, 6, 7, 8, 9] },
    build(k) {
        const sand = 0xcbb58a, sandstone = 0xb9a07b, plaster = 0xe5d6b6,
            dark = 0x655c50, timber = 0x765b42, rust = 0x96674c, sea = 0x6e9b9f;
        k.box(0, -.5, 0, 180, 1, 180, sand);
        for (const z of [-46, 0, 46]) k.paint(0, z, 168, 11, z === 0 ? 0xb7a787 : 0xc2ad82);
        k.paint(74, 0, 12, 160, 0xa79b83);
        k.paint(37, -46, 16, 16, 0xbca46e);
        k.paint(37, 46, 16, 16, 0xbca46e);
        k.paint(-82, 0, 8, 170, sea);
        // North warehouse and south quay have recessed courtyards facing the lanes.
        for (const z of [-69, 69]) {
            for (const x of [-47, -19, 20, 55]) {
                k.box(x, 4.5, z, 18, 9, 17, sandstone);
                k.box(x, 9.2, z, 19, .45, 18, dark, false);
                k.box(x, 5, z > 0 ? z - 8.6 : z + 8.6, 4, 5, .3, timber, false);
            }
        }
        // The raised market roof leaves a true walkable passage underneath.
        k.platform(0, 3.2, 0, 25, 17, sandstone, dark);
        for (const x of [-11, 11]) {
            for (const z of [-7, 7]) k.box(x, 1.6, z, 1, 3.2, 1, sandstone);
        }
        for (const z of [-8.5, 8.5]) k.box(0, 4.3, z, 27, 2.2, .6, plaster, false);
        k.sign('MARKET', -2, 4.5, -9, 8, 1.2, dark, 0xf5e9cb);
        // Short site walls and props break sightlines without closing the routes.
        for (const [x, z, w, d] of [[-35, -24, 10, 2], [-35, 24, 10, 2],
            [10, -25, 2, 10], [10, 25, 2, 10], [52, -22, 8, 2], [52, 22, 8, 2]] as const)
            k.box(x, 1.5, z, w, 3, d, plaster);
        for (const [x, z] of [[-28, -58], [-3, -55], [4, 55], [-26, 58], [54, -55], [55, 55]] as const)
            k.crate(x, 0, z, 2, timber);
        for (const [x, z] of [[-5, -39], [5, 39], [56, -39], [56, 39]] as const)
            k.barrel(x, 0, z, rust);
        for (const [x, z] of [[-78, -78], [78, -78], [-78, 78], [78, 78], [0, -81], [0, 81]] as const)
            k.lamp(x, 0, z, 7);
        // Decorative awnings and upper windows do not affect collision.
        for (const z of [-35, 35]) {
            k.box(-18, 4.5, z, 18, .16, 8, z < 0 ? 0x7e9b95 : 0xa56a57, false);
            k.box(-27, 2.4, z, .2, 4.8, .2, timber, false);
            k.box(-9, 2.4, z, .2, 4.8, .2, timber, false);
        }
        for (const x of [-60, -20, 20, 60]) {
            k.box(x, 7, -82, 10, 8, 7, plaster, false);
            k.box(x, 7, 82, 10, 8, 7, plaster, false);
        }
        k.route('A LONG', [[-72, 0, -36], [-54, 0, -46], [-28, 0, -46], [0, 0, -46], [37, 0, -46]]);
        k.route('MID', [[-72, 0, 0], [-48, 0, 0], [-18, 0, 0], [0, 0, 0], [20, 0, 0], [62, 0, 0]]);
        k.route('B ROUTE', [[-72, 0, 36], [-52, 0, 46], [-25, 0, 46], [0, 0, 46], [37, 0, 46]]);
        k.route('SHORT', [[15, 0, 0], [20, 0, -20], [25, 0, -35], [37, 0, -46]]);
        k.route('CONNECTOR', [[15, 0, 0], [20, 0, 20], [25, 0, 35], [37, 0, 46]]);
        k.route('UNDERPASS', [[-18, 0, 0], [0, 0, 0], [18, 0, 0]]);
        k.route('TUNNEL', [[-54, 0, 46], [-40, 0, 25], [-25, 0, 10], [-18, 0, 0]]);
        k.route('ROTATION', [[37, 0, -46], [61, 0, -28], [70, 0, 0], [61, 0, 28], [37, 0, 46]]);
    },
};

export const MAPS: MapDefinition[] = [BLOCKYARD, DUNE_RIDGE, HARBORLINE, SUBWAY, VERTICAL_CITY, GLACIER, ARENA, FACTORY, TEMPLE, OIL_RIG, SANDSTORM];
export const DEFAULT_MAP_ID = BLOCKYARD.id;
export const RANDOM_MAP_ID = 'random';
export function mapById(id: string) { return MAPS.find(m => m.id === id) ?? MAPS[0]; }
