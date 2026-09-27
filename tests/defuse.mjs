import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173/');
  const result = await page.evaluate(async () => {
    const { RoundManager } = await import('/src/game/round/RoundManager.ts');
    const teams = new Map([[0, 'attackers'], [1, 'attackers'], [2, 'defenders'], [3, 'defenders']]);
    const alive = new Map([...teams.keys()].map(id => [id, true]));
    const round = new RoundManager();
    round.start([...teams.keys()], 0);
    const started = round.phase === 'freeze' && round.bomb.carrierId === 0 && round.economy.balance(0) === 800;
    const cannotPlantDuringFreeze = !round.interactPlant(0, 'attackers', 'A', 4);
    round.update(6, alive, teams);
    const buyPhase = round.phase === 'buy' && round.canBuy;
    round.update(12, alive, teams);
    const live = round.phase === 'live' && !round.canBuy;
    const wrongTeam = !round.interactPlant(2, 'defenders', 'A', 4);
    const outsideSite = !round.interactPlant(0, 'attackers', null, 4);
    const incompletePlant = !round.interactPlant(0, 'attackers', 'A', 3.1) && round.bomb.state === 'planting';
    round.bomb.cancel();
    const interrupted = round.bomb.progress === 0 && round.bomb.state === 'carried';
    round.interactPlant(0, 'attackers', 'A', 3.2);
    const planted = round.phase === 'planted' && round.bomb.remaining === 40 && round.economy.balance(0) === 1100;
    alive.set(0, false); alive.set(1, false);
    round.update(1, alive, teams);
    const postPlantContinues = round.phase === 'planted';
    round.interactDefuse(2, 'defenders', false, 5, teams);
    const noKitNeedsTen = round.phase === 'planted';
    round.bomb.cancel();
    round.interactDefuse(2, 'defenders', true, 5, teams);
    const kitDefuses = round.phase === 'end' && round.winner === 'defenders' && round.reason === 'defuse';
    const settled = round.scores.defenders === 1 && round.economy.balance(0) === 3000 && round.economy.balance(2) === 4350;
    round.next(1);
    round.update(6, alive, teams); round.update(12, alive, teams);
    round.interactPlant(1, 'attackers', 'B', 3.2);
    round.update(40, alive, teams);
    const exploded = round.phase === 'end' && round.winner === 'attackers' && round.reason === 'explosion';
    const timeout = new RoundManager();
    timeout.start([...teams.keys()], 0);
    alive.set(0, true); alive.set(1, true);
    timeout.update(6, alive, teams); timeout.update(12, alive, teams);
    timeout.update(115, alive, teams);
    const defenderTimeWin = timeout.phase === 'end' && timeout.winner === 'defenders' && timeout.reason === 'time';
    return { started, cannotPlantDuringFreeze, buyPhase, live, wrongTeam, outsideSite,
      incompletePlant, interrupted, planted, postPlantContinues, noKitNeedsTen,
      kitDefuses, settled, exploded, defenderTimeWin };
  });
  for (const [name, passed] of Object.entries(result)) {
    assert.equal(passed, true, name);
    console.log('PASS', name);
  }
} finally {
  await browser.close();
}
