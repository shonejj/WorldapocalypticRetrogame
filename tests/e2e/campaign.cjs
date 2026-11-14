// End-to-end campaign run (Playwright, headless Chromium with software WebGL).
// Drives the real build through every stage — chapter goals, results, storyboards, safehouse talks,
// the final choice — using the app's debug handles to skip the walking and fighting, and fails on any
// console/page error. Usage: npm run dev (or preview) in one shell, then:
//   node tests/e2e/campaign.cjs [url] [choice: first|last] [screenshot dir]
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:5173/', pick = process.argv[3] || 'last', shots = process.argv[4];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.setDefaultTimeout(180000);
  const errs = [], log = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').slice(0, 400)));
  await p.goto(url); await p.waitForTimeout(1500);
  await p.evaluate(() => { localStorage.clear(); });
  await p.reload(); await p.waitForTimeout(1500);
  await p.keyboard.press('Enter');                       // New game
  let last = '', idle = 0, n = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 25 * 60000) {
    const st = await p.evaluate((pick) => {
      const q = (s) => document.querySelector(s);
      const end = q('.screen .endtext'); if (end && !q('.results')) return { s: 'END', text: q('.screen .sub')?.textContent + ' | ' + end.textContent };
      const picks = [...document.querySelectorAll('.picks:not(.hidden) button')];
      if (picks.length) { (pick === 'last' ? picks[picks.length - 1] : picks[0]).click(); return { s: 'pick ' + picks.length }; }
      if (q('.film .skip')) { q('.film .skip').click(); return { s: 'film' }; }
      if (q('.screen.cutscene')) { q('.screen.cutscene .skip').click(); return { s: 'cutscene' }; }
      if (q('.screen.talk')) return { s: 'talk', key: 'e' };
      if (q('.results .menu button')) { const r = q('.results').innerText.replace(/\n+/g, ' '); q('.results .menu button').click(); return { s: 'results', text: r }; }
      if (q('.screen.note button')) { q('.screen.note button').click(); return { s: 'note' }; }
      if (q('.loading')) return { s: 'loading' };
      const g = window.__game; if (!g) return { s: 'nogame' };
      if (g.ended || g.fading) return { s: 'wait ' + g.level.id };
      const L = g.level;
      if (L.kind === 'camp') { const t = g.interactables.find((i) => i.kind === 'talk') ?? g.interactables.find((i) => i.kind === 'rest'); g.leader.x = t.x; g.leader.vx = 0; return { s: `${L.id} ${t.id}`, key: 'e' }; }
      for (const z of g.infected) if (z.alive) { z.hp = 0; z.alive = false; g.kill(z, 1, 1); }
      const G = L.goal; if (G.needs && !g.stash.count(G.needs)) g.stash.add(G.needs, 1);
      if (L.id === 'ch3') for (const nn of ['n_rx', 'n_motel', 'n_hale2']) g.notes.add(nn);
      const goal = g.interactables.find((i) => i.kind === 'goal'); if (!goal) return { s: 'nogoal ' + L.id };
      const z = g.zoneAt(goal.x); if (z !== g.zone) { g.enterRoom(z.id); return { s: 'enter ' + z.id }; }
      g.squad.forEach((sv) => { sv.x = goal.x; sv.vx = 0; }); return { s: `${L.id} goal ${Math.round(g.progress * 100)}`, key: 'e' };
    }, pick);
    if (st.s !== last) { log.push(st.s + (st.text ? ' :: ' + st.text : '')); console.log(st.s, st.text ? ':: ' + st.text : ''); idle = 0; if (shots && !/goal \d|wait|loading/.test(st.s)) await p.screenshot({ path: `${shots}/e2e-${String(n++).padStart(2, '0')}.png` }).catch(() => {}); }
    last = st.s;
    if (st.s === 'END') break;
    if (st.key) await p.keyboard.press(st.key);
    await p.waitForTimeout(st.s === 'talk' ? 90 : 350);
    if (++idle > 400) { console.log('STUCK at', st.s); break; }
  }
  console.log('errors:', errs.length); for (const e of errs.slice(0, 10)) console.log('  ', e);
  await b.close();
  process.exit(errs.length || last !== 'END' ? 1 : 0);
})();
