import { animate, createTimer } from 'animejs';
import { h } from './dom';
import { ITEMS, WEAPONS, type ItemId } from '../game/data';
import type { Game } from '../game/game';
import type { Action, Input } from '../core/input';
import { audio } from '../core/audio';

/**
 * HUD (game-ui-ux): anchored to corners with safe-area insets; driven by game EVENTS
 * (stash/objective/alert/switch) with a light per-frame pass only for values that change
 * continuously (health bars, prompt progress, name tags, stealth meter).
 */
export class Hud {
  readonly root = h('div.hud');
  private members: { el: HTMLElement; hp: HTMLElement; hunger: HTMLElement; thirst: HTMLElement; tag: HTMLElement; bleed: HTMLElement }[] = [];
  private tags: HTMLElement[] = [];
  private ammo = h('div.ammo'); private wname = h('div.wname'); private status = h('div.status'); private inv = h('div.inv'); private weight = h('div.weight');
  private eyeBar = h('i'); private eyeLbl = h('div.lbl', {}, 'UNSEEN'); private alertEl = h('div.alert.hidden', {}, '▲ THEY\'RE HUNTING YOU ▲');
  private objList = h('div.objlist');
  private prompt = h('div.prompt.hidden'); private promptKey = h('kbd'); private promptText = h('span'); private promptBar = h('i');
  private toasts = h('div.toasts'); private sub = h('div.subtitle'); private hurt = h('div.hurtflash');
  private signal = h('div.signal'); private blips: HTMLElement[] = [];
  private beatTitle = h('div.beattitle');
  private subTimer: { revert(): unknown } | null = null;
  tagsOn = true;

  constructor(private g: Game, private input: Input, onPause: () => void, onInventory: () => void) {
    const squad = h('div.squad');
    g.squad.forEach((s, i) => {
      const hp = h('i'), hunger = h('i'), thirst = h('i'), tag = h('span.you'), bleed = h('span.bleed.hidden', {}, '●');
      const el = h('div.member', { title: `${s.name} — ${s.survivor!.roleLabel}` },
        h('div.top', {}, h('b', {}, s.name.toUpperCase()), h('span.key', {}, String(i + 1)), tag, bleed),
        h('div.role', {}, s.survivor!.roleLabel), h('div.bar.hpbar', {}, hp), h('div.needs', {}, h('div.bar.hunger', { title: 'Hunger' }, hunger), h('div.bar.thirst', { title: 'Thirst' }, thirst)));
      el.addEventListener('pointerdown', () => input.tap(`slot${i + 1}` as Action)); squad.append(el); this.members.push({ el, hp, hunger, thirst, tag, bleed });
      const t = h('div.ntag', {}, h('b', {}, s.name.toUpperCase()), h('span', {}, s.survivor!.roleLabel)); this.tags.push(t);
    });
    const obj = h('div.objectives', {}, h('div.loc', {}, g.level.location), h('div.chapter', {}, g.level.name), this.objList);
    for (const o of g.level.objectives) this.objList.append(h('div.obj', { 'data-id': o.id }, o.text));
    const weapon = h('div.weapon', {}, this.wname, this.ammo, this.status, this.inv, this.weight);
    const stealth = h('div.stealth', {}, this.eyeLbl, h('div.eye', {}, this.eyeBar), this.alertEl);
    this.signal.append(h('span.lbl', {}, 'SIGNAL'), h('span.mid'));
    for (let i = 0; i < 20; i++) { const b = h('span.blip.hidden'); this.blips.push(b); this.signal.append(b); }
    this.prompt.append(this.promptKey, this.promptText, h('div.pbar', {}, this.promptBar));
    const buttons = h('div.topbtns', {}, h('button.icon', { onclick: onInventory, 'aria-label': 'Inventory and crafting' }, '▤'), h('button.icon', { onclick: onPause, 'aria-label': 'Pause' }, 'Ⅱ'));
    this.root.append(h('div.tags', {}, ...this.tags), squad, obj, stealth, weapon, this.signal, this.prompt, this.sub, this.toasts, this.beatTitle, buttons);
    document.body.append(this.hurt, this.root);
    // event subscriptions
    g.ev.on('toast', (e) => this.toast(e.text, e.kind));
    g.ev.on('stash', () => this.refreshStash());
    g.ev.on('switched', () => { this.refreshStash(); audio.play('uiSelect'); });
    g.ev.on('objective', (e) => { const el = this.objList.querySelector<HTMLElement>(`[data-id="${e.id}"]`); if (el) { el.classList.toggle('done', e.done); el.classList.add('active'); animate(el, { scale: [1.12, 1], duration: 400, ease: 'outBack' }); } });
    g.ev.on('alert', (e) => { this.alertEl.classList.toggle('hidden', !e.on); if (e.on) animate(this.alertEl, { opacity: [0, 1], scale: [1.3, 1], duration: 300, ease: 'outBack' }); });
    g.ev.on('hurt', (e) => animate(this.hurt, { opacity: [Math.min(1, 0.35 + e.amount / 35), 0], duration: 650, ease: 'outQuad' }));
    g.ev.on('death', (e) => this.toast(e.player ? `${e.name} is down. You take over the next survivor.` : `${e.name} is down.`, 'warn'));
    g.ev.on('checkpoint', () => this.toast('Checkpoint — progress saved', 'info'));
    g.ev.on('beat', (e) => { if (e.beat.title) { this.beatTitle.textContent = e.beat.title.toUpperCase(); animate(this.beatTitle, { opacity: [0, 1, 1, 0], letterSpacing: ['0.6em', '0.35em'], duration: 3200, ease: 'outQuad' }); } });
    for (const id of g.objectives) this.objList.querySelector(`[data-id="${id}"]`)?.classList.add('done');
    this.refreshStash();
  }

  toast(text: string, kind: 'loot' | 'info' | 'warn' = 'info'): void {
    const t = h(`div.toast.${kind}`, {}, text); this.toasts.append(t);
    animate(t, { x: [30, 0], opacity: [0, 1], duration: 240, ease: 'outQuad' });
    animate(t, { opacity: 0, delay: 3400, duration: 500, onComplete: () => t.remove() });
    while (this.toasts.children.length > 5) this.toasts.firstElementChild?.remove();
  }

  /** Subtitle line with a typewriter reveal; returns ms until it should advance. */
  say(speaker: string, text: string): number {
    this.subTimer?.revert();
    const body = h('span');
    this.sub.replaceChildren(speaker ? h('b', {}, speaker) : '', body);
    this.sub.classList.toggle('radio', speaker === 'RADIO');
    this.sub.style.opacity = '1';
    const total = 28 * text.length;
    this.subTimer = createTimer({ duration: total, onUpdate: (t) => { body.textContent = text.slice(0, Math.floor(t.currentTime / 28)); }, onComplete: () => { body.textContent = text; } });
    return total + 1600 + text.length * 20;
  }
  clearSubtitle(): void { this.subTimer?.revert(); animate(this.sub, { opacity: 0, duration: 500 }); }

  refreshStash(): void {
    const g = this.g, L = g.leader, w = WEAPONS[L.weapon];
    this.wname.textContent = `${L.name.toUpperCase()} · ${w.name.toUpperCase()}`;
    this.ammo.replaceChildren(`${L.mag}`, h('small', {}, ` / ${w.ammo && !g.story ? g.stash.count(w.ammo) : '∞'}`));
    const show: ItemId[] = ['medkit', 'bandage', 'food', 'water', 'bottle', 'radio_part'];
    this.inv.replaceChildren(...show.filter((k) => g.stash.count(k) || k !== 'radio_part').map((k) => h('span', { title: ITEMS[k].name }, `${ITEMS[k].icon} `, h('b', {}, String(g.stash.count(k))))));
    this.weight.textContent = `PACK ${g.stash.weight.toFixed(1)} / ${g.stash.limit} kg`;
    this.weight.classList.toggle('heavy', g.stash.weight > g.stash.limit * 0.9);
  }

  /** Per-frame pass for continuously changing values. */
  update(): void {
    const g = this.g, L = g.leader;
    g.squad.forEach((s, i) => {
      const m = this.members[i];
      m.el.classList.toggle('active', i === g.controlled); m.el.classList.toggle('dead', !s.alive);
      m.hp.style.width = `${(s.hp / s.maxHp) * 100}%`; m.hp.className = s.hp / s.maxHp < 0.35 ? 'low' : s.hp / s.maxHp < 0.6 ? 'mid' : '';
      m.hunger.style.width = `${s.hunger * 100}%`; m.thirst.style.width = `${s.thirst * 100}%`;
      m.bleed.classList.toggle('hidden', !(s.bleed > 0 && s.alive));
      m.tag.textContent = !s.alive ? 'DOWN' : i === g.controlled ? 'YOU' : g.hold.on ? 'HOLD' : '';
      const t = this.tags[i], show = this.tagsOn && s.alive && !g.ended;
      t.style.display = show ? '' : 'none';
      if (show) { const p = g.r.toScreen(s.x, 2.15, 0); t.style.transform = `translate(${p.x | 0}px, ${p.y | 0}px) translate(-50%, -100%)`; t.classList.toggle('me', i === g.controlled); }
    });
    this.status.textContent = L.reloadT >= 0 ? 'RELOADING…' : L.healT >= 0 ? 'PATCHING UP…' : L.drawT >= 0 ? 'DRAWING…' : L.mag === 0 && WEAPONS[L.weapon].ammo ? `EMPTY — ${this.input.label('reload')} TO RELOAD` : L.crouching ? 'SNEAKING' : '';
    if (L.mag !== Number(this.ammo.firstChild?.textContent)) this.refreshStash();
    const det = g.detection();
    this.eyeBar.style.width = `${det * 100}%`;
    this.eyeLbl.textContent = det >= 1 ? 'SPOTTED' : det > 0.45 ? 'SUSPICIOUS' : L.crouching && g.lightAt(L.x) < 0.3 ? 'HIDDEN' : 'UNSEEN';
    if (g.focus && !g.ended) {
      this.prompt.classList.remove('hidden');
      this.promptKey.textContent = this.input.label('interact');
      const f = g.focus;
      this.promptText.textContent = f.kind === 'relay' && !g.stash.count(g.level.goal.needs) ? 'Inspect the relay' : f.label;
      this.promptBar.style.width = `${g.progress * 100}%`;
    } else this.prompt.classList.add('hidden');
    // Iris: signal band shows infected positions within ±24 m
    const iris = g.squad.find((s) => s.survivor?.role === 'signalist');
    this.signal.classList.toggle('hidden', !iris?.alive);
    if (iris?.alive) {
      let k = 0;
      for (const z of g.infected) {
        if (!z.alive || k >= this.blips.length) continue;
        const dx = z.x - L.x; if (Math.abs(dx) > 24) continue;
        const b = this.blips[k++]; b.classList.remove('hidden');
        b.style.left = `${50 + (dx / 24) * 48}%`; b.style.opacity = String(z.state === 'dormant' ? 0.35 : 0.55 + 0.45 * z.suspicion);
        b.classList.toggle('big', z.type === 'brute'); b.classList.toggle('hot', z.state === 'chase');
      }
      for (; k < this.blips.length; k++) this.blips[k].classList.add('hidden');
    }
  }
  dispose(): void { this.subTimer?.revert(); this.root.remove(); this.hurt.remove(); }
}
