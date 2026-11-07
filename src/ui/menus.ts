import { animate, createTimer } from 'animejs';
import { h } from './dom';
import { menu, panel, type ScreenStack } from './screens';
import { GAME } from '../config/game';
import { ACTIONS, ACTION_LABEL, type Input } from '../core/input';
import { ITEMS, RECIPES, SURVIVORS, WEAPONS, type ItemId, type Role } from '../game/data';
import type { Game } from '../game/game';
import type { Settings } from './settings';
import { audio } from '../core/audio';

export const footText = (offline: boolean) => `v${GAME.version} · ${offline ? 'OFFLINE READY — PLAYABLE WITHOUT INTERNET' : 'CACHING FOR OFFLINE PLAY…'} · MIT`;

/** Title screen with a live radio waveform that "locks on" to the signal. */
export function titleScreen(S: ScreenStack, o: { canContinue: boolean; offline: boolean; onContinue: () => void; onNew: () => void; onSettings: () => void; onControls: () => void; onSquad: () => void }): void {
  const wave = h<'canvas'>('canvas.wave');
  const words = GAME.title.toUpperCase().split(' '), half = Math.ceil(words.length / 2);
  const title = h('h1', {}, words.slice(0, half).join(' '), h('br'), words.slice(half).join(' '));
  const el = h('div.screen.title', {}, wave, title, h('div.sub', {}, GAME.tagline.toUpperCase()),
    menu([['Continue', o.onContinue, !o.canContinue], ['New expedition', o.onNew], ['The squad', o.onSquad], ['Settings', o.onSettings], ['Controls', o.onControls]]),
    h('div#netfoot.foot', {}, footText(o.offline)));
  const g = wave.getContext('2d')!;
  const timer = createTimer({ loop: true, duration: 1000, onUpdate: () => {
    const t = performance.now(), dpr = Math.min(2, devicePixelRatio || 1), w = (wave.width = wave.clientWidth * dpr), hh = (wave.height = wave.clientHeight * dpr);
    g.clearRect(0, 0, w, hh);
    const lock = Math.pow(Math.max(0, Math.sin(t / 2600)), 6);
    for (let layer = 0; layer < 3; layer++) {
      g.beginPath(); g.strokeStyle = layer ? `rgba(90,209,230,${0.14 - layer * 0.04})` : `rgba(90,209,230,${0.45 + lock * 0.55})`; g.lineWidth = layer ? 1 : 2 * dpr;
      for (let x = 0; x <= w; x += 3) {
        const u = x / w, env = Math.sin(u * Math.PI);
        const y = hh / 2 + ((Math.sin(u * 91 + t / 90 + layer) * Math.sin(u * 37 - t / 170)) * (1 - lock) * 0.6 + Math.sin(u * 28 - t / 120) * lock + Math.sin(u * 13 + t / 300 + layer * 2) * 0.15) * env * hh * 0.4;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  } });
  S.push({ el, onBack: () => {}, onClose: () => timer.revert() });
  animate(title, { opacity: [0, 1], letterSpacing: ['0.45em', '0.06em'], duration: 1600, ease: 'outExpo' });
}

export function pauseScreen(S: ScreenStack, o: { onResume: () => void; onSave: () => void; onLoad: () => void; onSettings: () => void; onControls: () => void; onQuit: () => void }): void {
  S.push({ el: h('div.screen.dim', {}, h('h1.small', {}, 'PAUSED'), h('div.sub', {}, GAME.title.toUpperCase()),
    menu([['Resume', o.onResume], ['Save game', o.onSave], ['Load last checkpoint', o.onLoad], ['Settings', o.onSettings], ['Controls', o.onControls], ['Quit to title', o.onQuit]])), onBack: o.onResume });
}

export function settingsScreen(S: ScreenStack, s: Settings, input: Input, apply: (s: Settings) => void): void {
  const range = (label: string, k: keyof Settings) => {
    const out = h('span.val', {}, `${Math.round((s[k] as number) * 100)}%`);
    return h('label.row', {}, h('span', {}, label), h('span', {}, h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: String(s[k]), oninput: (e: Event) => { (s as unknown as Record<string, number>)[k] = Number((e.target as HTMLInputElement).value); out.textContent = `${Math.round((s[k] as number) * 100)}%`; apply(s); } }), out));
  };
  const check = (label: string, k: keyof Settings) => h('label.row', {}, h('span', {}, label), h('input', { type: 'checkbox', checked: !!s[k], onchange: (e: Event) => { (s as unknown as Record<string, boolean>)[k] = (e.target as HTMLInputElement).checked; apply(s); } }));
  const select = <K extends keyof Settings>(label: string, k: K, opts: [Settings[K], string][]) => h('label.row', {}, h('span', {}, label),
    h('select', { onchange: (e: Event) => { const v = (e.target as HTMLSelectElement).value; const hit = opts.find(([o]) => String(o) === v); if (hit) { s[k] = hit[0]; apply(s); } } }, ...opts.map(([v, l]) => h('option', { value: String(v), selected: s[k] === v }, l))));
  const tabs = h('div.tabs'), body = h('div.tabbody');
  const sections: [string, () => HTMLElement[]][] = [
    ['Game', () => [select('Mode', 'mode', [['story', 'Story — unlimited reserve ammo, only attacks hurt'], ['survival', 'Survival — scarce ammo, hunger, thirst, bleeding']])]],
    ['Audio', () => [range('Master', 'master'), range('Music', 'music'), range('Effects', 'sfx'), range('Ambience', 'ambience'), range('Voice / radio', 'voice')]],
    ['Video', () => [select('Quality', 'quality', [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]), select('Pixel-art filter', 'pixel', [[-1, 'Auto (pixel art)'], [0, 'Off (HD)'], [2, '2 px'], [3, '3 px'], [4, '4 px']]),
      check('Auto-adjust quality on slow devices', 'autoQuality'), check('Rain', 'rain'), range('Screen shake', 'shake'), check('Squad name tags', 'nameTags'), check('Show FPS', 'showFps')]],
    ['Controls', () => [select('Touch controls', 'touch', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']]), ...bindingRows(input), h('div.row', {}, h('button', { onclick: () => { input.resetBindings(); show(2); } }, 'Reset to defaults'))]],
  ];
  const show = (i: number) => { body.replaceChildren(...sections[i][1]()); [...tabs.children].forEach((t, j) => t.classList.toggle('on', i === j)); };
  sections.forEach(([n], i) => tabs.append(h('button.tab', { onclick: () => show(i) }, n)));
  show(0);
  S.push({ el: h('div.screen.dim', {}, panel('SETTINGS', tabs, body, menu([['Back', () => S.pop()]]))) });
}

function bindingRows(input: Input): HTMLElement[] {
  return ACTIONS.filter((a) => !a.startsWith('slot')).map((a) => {
    const btn = h('button.bind', {}, input.label(a));
    btn.onclick = () => {
      btn.textContent = 'press a key / button…'; btn.dataset.capturing = '1';
      input.rebind(a, (r) => {
        delete btn.dataset.capturing;
        btn.textContent = r.ok ? input.label(a) : `in use by “${ACTION_LABEL[r.conflict]}”`;
        if (!r.ok) setTimeout(() => (btn.textContent = input.label(a)), 1600);
      });
    };
    return h('div.row', {}, h('span', {}, ACTION_LABEL[a]), btn);
  });
}

export function controlsScreen(S: ScreenStack, input: Input): void {
  const rows: [string, string][] = [
    [`${input.label('left')} / ${input.label('right')}`, 'Move'], [input.label('run'), 'Run (loud)'], [input.label('crouch'), 'Crouch — sneak; harder to see in the dark'],
    [input.label('fire'), 'Aim & fire (very loud — pulls the street)'], [input.label('melee'), 'Melee — quiet; takedown on unaware infected'],
    [input.label('throw'), 'Throw a bottle lure — sends infected to the noise'], [input.label('interact'), 'Search / interact (hold still)'], [input.label('reload'), 'Reload'],
    [input.label('heal'), 'Bandage / medkit'], [`1–4 · ${input.label('nextSurvivor')}`, 'Switch survivor'], [input.label('squad'), 'Squad: hold / follow'],
    [input.label('inventory'), 'Inventory, eat/drink, crafting'], [input.label('pause'), 'Pause'],
  ];
  S.push({ el: h('div.screen.dim', {}, panel('CONTROLS', h('div.keys', {}, ...rows.flatMap(([k, d]) => [h('kbd', {}, k), h('span', {}, d)])),
    h('p.hint', {}, 'Infected see movement and hear noise. Stay in the dark, crouch, and use the pipe when you can. Gamepad and touch are fully supported; rebind anything in Settings → Controls.'),
    menu([['Back', () => S.pop()]]))) });
}

export function squadBio(S: ScreenStack): void {
  const c = panel('THE SQUAD');
  for (const s of SURVIVORS) c.append(h('div.bio', {}, h('b', {}, `${s.name} — ${s.roleLabel}`), h('div', {}, `${WEAPONS[s.weapon].name} · ${s.resistant ? 'resistant to the organism' : 'never exposed'}`), h('p', {}, s.bio), h('div.trait', {}, s.trait)));
  c.append(menu([['Back', () => S.pop()]]));
  S.push({ el: h('div.screen.dim', {}, c) });
}

/** Inventory: per-survivor needs (eat/drink), stash with weights, crafting (also opened at the workbench). */
export function inventoryScreen(S: ScreenStack, g: Game, opts: { atBench: boolean; onClose: () => void }): void {
  const wrap = h('div.inventory');
  const render = () => {
    const roles = g.squad.filter((s) => s.alive).map((s) => s.survivor!.role) as Role[];
    const people = h('div.col', {}, h('h3', {}, 'SQUAD'), ...g.squad.map((s) => h('div.person', {},
      h('b', {}, `${s.name}${!s.alive ? ' (down)' : ''}`),
      h('div.stats', {}, `HP ${Math.round(s.hp)}/${s.maxHp} · Food ${Math.round(s.hunger * 100)}% · Water ${Math.round(s.thirst * 100)}%${s.bleed > 0 ? ' · BLEEDING' : ''}`),
      s.alive ? h('div.btnrow', {}, h('button', { onclick: () => { g.consume(s, 'food'); render(); } , disabled: !g.stash.count('food') }, 'Eat'), h('button', { onclick: () => { g.consume(s, 'water'); render(); }, disabled: !g.stash.count('water') }, 'Drink')) : null)));
    const items = h('div.col', {}, h('h3', {}, `STASH · ${g.stash.weight.toFixed(1)} / ${g.stash.limit} kg`), h('div.items', {},
      ...([...g.stash.items.entries()] as [ItemId, number][]).map(([k, n]) => h('div.item', { title: ITEMS[k].desc }, h('span.icon', {}, ITEMS[k].icon), h('span', {}, ITEMS[k].name), h('b', {}, `×${n}`)))));
    const craft = h('div.col', {}, h('h3', {}, opts.atBench ? 'WORKBENCH' : 'FIELD CRAFTING'), ...RECIPES.filter((r) => opts.atBench || !r.requires).map((r) => {
      const can = g.stash.canCraft(r, roles);
      const need = Object.entries(r.inputs).map(([k, n]) => `${n}× ${ITEMS[k as ItemId].name}`).join(', ');
      return h('div.recipe', {}, h('div', {}, h('b', {}, r.name), h('div.need', {}, need + (r.requires ? ` · ${r.requires}` : ''))),
        h('button', { onclick: () => { if (g.craft(r.id)) render(); else audio.play('dryfire'); }, disabled: !can.ok, title: can.why ?? '' }, can.ok ? 'Craft' : can.why ?? '—'));
    }), !opts.atBench ? h('p.hint', {}, 'Some recipes need the garage workbench.') : null);
    wrap.replaceChildren(people, items, craft);
  };
  render();
  S.push({ el: h('div.screen.dim', {}, panel(opts.atBench ? 'WORKBENCH & SUPPLIES' : 'SQUAD & SUPPLIES', wrap, menu([['Close', () => { S.pop(); }]]))), onClose: opts.onClose });
}

/** Dialogue choices (Ink). Lines play as subtitles; this only appears when a choice is needed. */
export function choiceScreen(S: ScreenStack, choices: string[], pick: (i: number) => void): void {
  S.push({ el: h('div.screen.choices', {}, h('div.choicebox', {}, ...choices.map((c, i) => h('button', { onclick: () => { audio.play('uiSelect'); S.pop(); pick(i); } }, c)))), onBack: () => {}, modal: true });
}

export function endScreen(S: ScreenStack, title: string, sub: string, body: string, items: [string, () => void][]): void {
  S.push({ el: h('div.screen.dim', {}, h('h1.small', {}, title), h('div.sub', {}, sub), body ? h('p.endtext', {}, body) : null, menu(items)), onBack: () => {} });
}
