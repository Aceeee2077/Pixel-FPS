import { chromium } from 'playwright';
import fs from 'node:fs';

const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://127.0.0.1:5173');
await page.waitForFunction(() => window.__game);
await page.waitForFunction(() => window.__game.environment && window.__game.environment.ready);
await page.waitForTimeout(1200);
fs.mkdirSync('test-results', { recursive: true });
await page.screenshot({ path: 'test-results/blockyard-glb.png' });
const stats = await page.evaluate(() => {
    const g = window.__game;
    let meshes = 0, tris = 0;
    g.environment.group.traverse(o => { if (o.isMesh) { meshes++; tris += o.geometry.index ? o.geometry.index.count / 3 : 0; } });
    return { envReady: g.environment.ready, proceduralVisible: g.map.group.visible, meshes, tris: Math.round(tris) };
});
console.log(JSON.stringify(stats));
console.log('errors', errors.length, errors.slice(0, 5));
await browser.close();
