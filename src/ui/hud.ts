import { animate, createTimer } from 'animejs';
import { h } from './dom';
import { WEAPONS } from '../game/data';
import type { Game, GameEvent } from '../game/game';

/** In-game HUD (DOM overlay). Reads game state each frame; reacts to game events. */
export class Hud {
  readonly root = h('div.overlay.hud');
  private members: { el: HTMLElement; bar: HTMLElement; tag: HTMLElement }[] = [];
  private objEls = new Map<string, HTMLElement>();
  private ammo = h('div.ammo'); private wname = h('div.wn'); private reload = h('div.reload'); private inv = h('div.inv');
  private eye = h('i'); private eyeLbl = h('div.lbl', {}, 'UNSEEN'); private alertEl = h('div.alert.hidden', {}, '▲ INFECTED HUNTING ▲');
  private signal = h('div.signal.hidden'); private blips: HTMLElement[] = [];
  private prompt = h('div.prompt.hidden'); private promptText = h('span'); private promptBar = h('i');
  private radio = h('div.radio'); private toasts = h('div.toasts'); private hurtEl = h('div.hurt');
  private fps = h('div.fps.hidden');
  private radioTimer: { revert(): unknown } | null = null;
  private lastKey = '';

  constructor(private game: Game, onPause: () => void, onInventory: () => void) {
    const squad = h('div.squad');
    game.survivors.forEach((s, i) => {
      const bar = h('i'), tag = h('div.tag');
      const el = h('div.member', {}, h('img', { src: game.portraits[i], alt: s.name }), tag,
        h('div.nm', {}, h('span', {}, s.name.toUpperCase()), h('span.key', {}, String(i + 1))), h('div.bar', {}, bar));
      el.title = `${s.name} — ${s.survivor!.roleLabel}`;
      squad.append(el); this.members.push({ el, bar, tag });
    });
    const obj = h('div.objectives', {}, h('div.loc', {}, game.level.location), h('div.chapter', {}, game.level.name));
    for (const o of game.level.objectives) { const e = h('div.obj', {}, o.text); this.objEls.set(o.id, e); obj.append(e); }
    const weapon = h('div.weapon', {}, this.wname, this.ammo, this.reload, this.inv);
    const stealth = h('div.stealth', {}, this.eyeLbl, h('div.eye', {}, this.eye), this.alertEl);
    this.signal.append(h('span.lbl', {}, 'SIGNAL'), h('span.mid'));
    for (let i = 0; i < 24; i++) { const b = h('span.blip.hidden'); this.blips.push(b); this.signal.append(b); }
    this.prompt.append(h('kbd', {}, 'E'), this.promptText, h('div.pb', {}, this.promptBar));
    const top = h('div.toprow', {},
      h('button.iconbtn', { onclick: onInventory, title: 'Inventory (I)', ariaLabel: 'Inventory' }, '▤'),
      h('button.iconbtn', { onclick: onPause, title: 'Pause (Esc)', ariaLabel: 'Pause' }, 'II'));
    this.root.append(squad, obj, stealth, weapon, this.signal, this.prompt, this.radio, this.toasts, this.fps, top);
    document.body.append(this.hurtEl, this.root);
    game.listeners.push((e) => this.onEvent(e));
  }

  setFpsVisible(v: boolean): void { this.fps.classList.toggle('hidden', !v); }
  setFps(f: number): void { this.fps.textContent = `${f.toFixed(0)} FPS`; }

  private onEvent(e: GameEvent): void {
    switch (e.type) {
      case 'toast': this.toast(e.text, e.kind); break;
      case 'radio': this.say(e.speaker, e.text); break;
      case 'alert': this.alertEl.classList.toggle('hidden', !e.on); if (e.on) animate(this.alertEl, { opacity: [0, 1], scale: [1.3, 1], duration: 300, ease: 'outBack' }); break;
      case 'damage': animate(this.hurtEl, { opacity: [Math.min(1, 0.4 + e.amount / 30), 0], duration: 600, ease: 'outQuad' }); break;
      case 'death': this.toast(e.player ? `${e.name} is down. Control passes on.` : `${e.name} is down.`, 'warn'); break;
      case 'checkpoint': this.toast('Checkpoint reached — progress saved', 'info'); break;
      default: break;
    }
  }

  toast(text: string, kind: 'loot' | 'info' | 'warn' = 'info'): void {
    const t = h(`div.toast.${kind}`, {}, text);
    this.toasts.append(t);
    animate(t, { x: [40, 0], opacity: [0, 1], duration: 250, ease: 'outQuad' });
    animate(t, { opacity: 0, delay: 3200, duration: 500, onComplete: () => t.remove() });
    while (this.toasts.children.length > 5) this.toasts.firstElementChild?.remove();
  }

  /** Radio subtitle with typewriter reveal. */
  say(speaker: string, text: string): void {
    this.radioTimer?.revert();
    const sp = h('span.sp', {}, `${speaker}:`), body = h('span');
    this.radio.replaceChildren(sp, body);
    this.radio.style.opacity = '1';
    let n = 0;
    this.radioTimer = createTimer({
      duration: 24 * text.length, frameRate: 60,
      onUpdate: (t) => { const k = Math.floor(t.currentTime / 24); if (k !== n) { n = k; body.textContent = text.slice(0, n); } },
      onComplete: () => { body.textContent = text; animate(this.radio, { opacity: 0, delay: 3500, duration: 800 }); },
    });
  }

  update(): void {
    const g = this.game, L = g.leader;
    g.survivors.forEach((s, i) => {
      const m = this.members[i];
      m.el.classList.toggle('active', i === g.controlled);
      m.el.classList.toggle('dead', !s.alive);
      m.bar.style.width = `${(s.hp / s.maxHp) * 100}%`;
      m.bar.style.background = s.hp / s.maxHp < 0.35 ? 'var(--danger)' : s.hp / s.maxHp < 0.6 ? 'var(--warn)' : 'var(--ok)';
      m.tag.textContent = !s.alive ? 'DOWN' : i === g.controlled ? 'YOU' : g.holdPosition ? 'HOLD' : '';
    });
    for (const [id, el] of this.objEls) el.classList.toggle('done', g.objectivesDone.has(id));
    const w = WEAPONS[L.weapon];
    const key = `${L.id}:${L.weapon}:${L.mag[L.weapon]}:${w.ammo ? g.stash[w.ammo] : ''}:${g.stash.medkit}:${g.stash.bandage}:${g.stash.food}:${g.stash.water}:${g.stash.scrap}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.wname.textContent = `${L.name.toUpperCase()} · ${w.name.toUpperCase()}`;
      this.ammo.replaceChildren(`${L.mag[L.weapon] ?? 0} `, h('small', {}, `| ${w.ammo ? g.stash[w.ammo] ?? 0 : '∞'}`));
      this.inv.replaceChildren(
        h('span', {}, '✚ ', h('b', {}, String(g.stash.medkit ?? 0))), h('span', {}, '≡ ', h('b', {}, String(g.stash.bandage ?? 0))),
        h('span', {}, '◍ ', h('b', {}, String(g.stash.food ?? 0))), h('span', {}, '◌ ', h('b', {}, String(g.stash.water ?? 0))),
        h('span', {}, '⚙ ', h('b', {}, String(g.stash.scrap ?? 0))));
    }
    this.reload.textContent = L.reloadT > 0 ? 'RELOADING…' : L.healT >= 0 ? 'PATCHING UP…' : (L.mag[L.weapon] ?? 0) === 0 && w.ammo ? 'EMPTY — R TO RELOAD' : L.crouching ? 'SNEAKING' : '';
    const det = g.detection();
    this.eye.style.width = `${det * 100}%`;
    this.eyeLbl.textContent = det >= 1 ? 'SPOTTED' : det > 0.45 ? 'SUSPICIOUS' : L.crouching ? 'HIDDEN' : 'UNSEEN';
    // interaction prompt
    if (g.focus && !g.ended) {
      this.prompt.classList.remove('hidden');
      this.promptText.textContent = g.focus.label;
      this.promptBar.style.width = `${g.searchProgress * 100}%`;
    } else this.prompt.classList.add('hidden');
    // Iris: signal band shows infected positions within ±24 m
    const iris = g.survivors.find((s) => s.survivor?.role === 'signalist');
    const sense = !!iris?.alive;
    this.signal.classList.toggle('hidden', !sense);
    if (sense) {
      let k = 0;
      for (const z of g.infected) {
        if (!z.alive || k >= this.blips.length) continue;
        const dx = z.x - L.x;
        if (Math.abs(dx) > 24) continue;
        const b = this.blips[k++];
        b.classList.remove('hidden');
        b.style.left = `${50 + (dx / 24) * 48}%`;
        b.style.opacity = String(z.state === 'dormant' ? 0.35 : 0.6 + 0.4 * z.suspicion);
        b.style.height = z.infectedType === 'brute' ? '14px' : '10px';
        b.style.top = z.infectedType === 'brute' ? '4px' : '6px';
      }
      for (; k < this.blips.length; k++) this.blips[k].classList.add('hidden');
    }
  }

  dispose(): void { this.radioTimer?.revert(); this.root.remove(); this.hurtEl.remove(); }
}
