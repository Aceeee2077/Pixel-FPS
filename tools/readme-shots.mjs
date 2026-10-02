/**
 * Regenerates the screenshots used by README.md / README-EN.md.
 *
 * Usage:
 *   node tools/readme-shots.mjs [--url=...] [--lang=zh|en] [--out=docs] [--only=menu,armory,gameplay,maps]
 *
 * The default source is the deployed build, so the images always show exactly
 * what a visitor to the online demo sees (the published weapon models, not the
 * locally converted Counter-Strike ones). Point --url at a local preview server
 * (http://127.0.0.1:4173) to shoot a local build instead.
 *
 * --lang=en writes menu-en.png / armory-en.png / gameplay-en.png so the English
 * README can show an English UI. The arena thumbnails under docs/maps/ are
 * shared by both READMEs and are shot once, from the Chinese (default) UI.
 *
 * Everything is driven through the real interface: the debug handle the tests
 * use (`window.__game`) only exists in dev builds, so it is unavailable here.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/** Arena order matches the map chips in the lobby: random, then ARENA 01..10. */
const ARENAS = [
    { id: 'blockyard', name: 'BLOCKYARD' },
    { id: 'duneridge', name: 'DUNE RIDGE' },
    { id: 'harborline', name: 'HARBORLINE' },
    { id: 'subway', name: 'SUBWAY DEPOT' },
    { id: 'vertical', name: 'VERTICAL CITY' },
    { id: 'glacier', name: 'GLACIER OUTPOST' },
    { id: 'arena', name: 'ARENA PIT' },
    { id: 'factory', name: 'FACTORY FLOOR' },
    { id: 'temple', name: 'JUNGLE TEMPLE' },
    { id: 'oilrig', name: 'OFFSHORE RIG' },
];

const flags = new Map();
for (const arg of process.argv.slice(2)) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (match) flags.set(match[1], match[2] ?? 'true');
}

const url = flags.get('url') ?? 'https://blockstrike-eight.vercel.app/';
const lang = flags.get('lang') === 'en' ? 'en' : 'zh';
const out = path.resolve(flags.get('out') ?? 'docs');
const only = new Set((flags.get('only') ?? 'menu,armory,gameplay,maps').split(',').map(part => part.trim()).filter(Boolean));
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const suffix = lang === 'en' ? '-en' : '';

/**
 * The lobby is a dense two column layout that collapses on short viewports, and
 * the map chips have to stay clickable, so everything is driven at 1440x900 and
 * downscaled afterwards. Sizes below are 2x the width the READMEs render at.
 */
const VIEWPORT = { width: 1440, height: 900 };
const SCALE = 2;
const HERO_SIZE = { width: 1720, height: 1075 };
const ARENA_SIZE = { width: 1120, height: 700 };

/** Headless Chrome cannot take the pointer, so grant the lock and keep the normal in-match HUD. */
const pointerLockStub = () => {
    HTMLElement.prototype.requestPointerLock = function () {
        Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => this });
        document.dispatchEvent(new Event('pointerlockchange'));
        return Promise.resolve();
    };
    document.exitPointerLock = function () {
        Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => null });
        document.dispatchEvent(new Event('pointerlockchange'));
    };
};

/** A visibility check for one of the UI's screens, safe to inline into waitForFunction. */
const shown = id => `(() => { const el = document.getElementById('${id}'); return !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none'; })()`;

const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });

async function openPage() {
    const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: SCALE,
        locale: lang === 'en' ? 'en-US' : 'zh-CN',
    });
    await context.addInitScript(pointerLockStub);
    const page = await context.newPage();
    await loadLobby(page);
    return { context, page };
}

async function loadLobby(page) {
    await page.goto(url, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(shown('menu'), null, { timeout: 60000 });
    await applyLanguage(page);
    // The arena preview behind the lobby is a live WebGL render, so give it a beat.
    await page.waitForTimeout(2500);
}

async function applyLanguage(page) {
    const want = lang === 'en' ? 'EN' : '中文';
    await page.evaluate(label => {
        const active = document.querySelector('[data-action="lang"] .on');
        if (active && active.textContent.trim() !== label) document.querySelector('[data-action="lang"]').click();
    }, want);
    await page.waitForFunction(label => document.querySelector('[data-action="lang"] .on')?.textContent.trim() === label, want, { timeout: 15000 });
    // Switching language raises a toast in the corner; keep it out of the shots.
    await page.waitForFunction(() => !document.getElementById('notice')?.classList.contains('shown'), null, { timeout: 15000 });
    await page.waitForTimeout(400);
}

async function shoot(page, file, size) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file });
    const temp = `${file}.tmp`;
    await sharp(file).resize(size.width, size.height, { fit: 'fill' }).png({ compressionLevel: 9 }).toFile(temp);
    fs.renameSync(temp, file);
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`wrote ${path.relative(process.cwd(), file)} (${size.width}x${size.height}, ${kb}KB)`);
}

/**
 * Picks an arena chip and drops into a match, exactly like a player would.
 * `walkMs` walks toward the map centre first: spawn points are scored randomly,
 * so a short walk gives the hero shot a consistent, open view.
 */
async function playArena(page, chipIndex, walkMs = 0) {
    if (chipIndex > 0) {
        await page.locator('.map-chip').nth(chipIndex).click();
        await page.waitForTimeout(250);
    }
    await page.locator('#play').click();
    await page.waitForFunction(`${shown('hud')} && !${shown('menu')}`, null, { timeout: 45000 });
    await page.waitForTimeout(1800);
    if (walkMs > 0) {
        await page.keyboard.down('KeyW');
        await page.waitForTimeout(walkMs);
        await page.keyboard.up('KeyW');
        await page.waitForTimeout(500);
    }
    await page.waitForTimeout(800);
    return page.evaluate(() => document.getElementById('hud').innerText.replace(/\s+/g, ' ').trim());
}

try {
    if (only.has('menu') || only.has('armory') || only.has('gameplay')) {
        const { context, page } = await openPage();
        if (only.has('menu')) await shoot(page, path.join(out, `menu${suffix}.png`), HERO_SIZE);
        if (only.has('armory')) {
            await page.locator('[data-action="armory"]').click();
            await page.waitForFunction(shown('dialog'), null, { timeout: 15000 });
            // Weapon previews are rendered into the armory after the panel opens.
            await page.waitForTimeout(2600);
            await shoot(page, path.join(out, `armory${suffix}.png`), HERO_SIZE);
        }
        if (only.has('gameplay')) {
            await loadLobby(page);
            const hud = await playArena(page, 1, 1500);
            if (!hud.includes('BLOCKYARD')) console.warn(`warning: expected the BLOCKYARD match, HUD says "${hud}"`);
            await shoot(page, path.join(out, `gameplay${suffix}.png`), HERO_SIZE);
        }
        await context.close();
    }

    if (only.has('maps')) {
        const { context, page } = await openPage();
        for (const [index, arena] of ARENAS.entries()) {
            if (index > 0) await loadLobby(page);
            const hud = await playArena(page, index + 1);
            if (!hud.includes(arena.name)) console.warn(`warning: expected ${arena.name}, HUD says "${hud}"`);
            await shoot(page, path.join(out, 'maps', `${arena.id}.png`), ARENA_SIZE);
        }
        await context.close();
    }
} finally {
    await browser.close();
}
