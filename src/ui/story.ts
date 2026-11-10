import { animate, createTimer } from 'animejs';
import { h } from './dom';
import type { ScreenStack } from './screens';
import { panel, PW, PH } from '../art/panels';
import { portrait } from '../art/portraits';
import type { Shot } from '../story/storyboards';
import type { DialogueStep, Line } from '../game/dialogue';
import { NOTES, type NoteId } from '../game/data';
import { audio } from '../core/audio';

/**
 * Story presentation (dialogue-systems + game-ui-ux): the three ways the game tells its story.
 *  cutscene()      illustrated panels with captions — prologue, chapter cards, interludes, endings
 *  conversation()  letterboxed dialogue with speaker portraits; the world waits; choices in the box
 *  noteScreen()    a found document, readable at leisure
 * All are modal screens: advance with click / tap / Enter / Space / E / gamepad A; Esc skips.
 */
const SIDE_RIGHT = new Set(['RADIO', 'WREN']);
const NAME_COLOR: Record<string, string> = { REED: '#a9c58a', MAYA: '#e58a7c', MILLER: '#d8b86a', IRIS: '#b49cf0', RADIO: '#5ad1e6', WREN: '#f0d27a' };

/** Typewriter into `el`; returns { done, finish }. */
function type(el: HTMLElement, text: string, speed = 22, voice = 1): { readonly done: boolean; finish(): void } {
  let done = false, last = 0;
  const t = createTimer({ duration: Math.max(1, text.length * speed), onUpdate: (tm) => {
    const n = Math.floor(tm.currentTime / speed); el.textContent = text.slice(0, n);
    if (n - last >= 3 && text[n - 1] !== ' ') { last = n; audio.blip(voice); }
  }, onComplete: () => { el.textContent = text; done = true; } });
  return { get done() { return done; }, finish() { t.revert(); el.textContent = text; done = true; } };
}
/** Advance on E as well as the focused button's Enter/Space. */
function keyAdvance(fn: () => void): () => void {
  const k = (e: KeyboardEvent) => { if (e.code === 'KeyE' && !e.repeat) fn(); };
  addEventListener('keydown', k); return () => removeEventListener('keydown', k);
}

export function cutscene(S: ScreenStack, shots: Shot[], done: () => void): void {
  const cv = h<'canvas'>('canvas.panel'); cv.width = PW; cv.height = PH;
  const g = cv.getContext('2d')!, cap = h('div.caption'), title = h('div.cardtitle.hidden'), dots = h('div.dots');
  const next = h<'button'>('button.next', { 'aria-label': 'Continue' }, '▸'), skip = h<'button'>('button.skip', {}, 'Skip');
  const el = h('div.screen.cutscene', {}, h('div.frame', {}, cv, title), h('div.capbar', {}, cap, next), dots, skip);
  let si = -1, li = 0, tw: ReturnType<typeof type> | null = null, over = false, drift: { revert(): unknown } | null = null;
  shots.forEach(() => dots.append(h('i')));
  const finish = () => { if (over) return; over = true; off(); tw?.finish(); drift?.revert(); S.pop(); done(); };
  const line = () => { const s = shots[si]; cap.classList.toggle('radio', !!s.radio); tw = type(cap, s.text![li], 26, s.radio ? 1.6 : 0.8); };
  const shot = () => {
    si++; li = 0; if (si >= shots.length) { finish(); return; }
    const s = shots[si];
    g.drawImage(panel(s.panel), 0, 0);
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i <= si));
    drift?.revert();
    const dir = si % 2 ? -1 : 1;
    drift = animate(cv, { scale: [1.06, 1.14], x: [`${-1.2 * dir}%`, `${1.2 * dir}%`], duration: 16000, ease: 'linear' });
    animate(cv, { opacity: [0, 1], duration: 700, ease: 'outQuad' });
    title.classList.toggle('hidden', !s.title); cap.textContent = '';
    if (s.title) { title.replaceChildren(h('small', {}, s.title[0]), h('b', {}, s.title[1])); animate(title, { opacity: [0, 1], letterSpacing: ['0.5em', '0.16em'], duration: 1400, ease: 'outExpo' }); audio.play('alert', undefined, 0.5, 'ui'); tw = null; }
    else { if (s.radio) audio.play('radioStatic', undefined, 0.7, 'voice'); line(); }
  };
  const advance = () => {
    if (over) return;
    if (tw && !tw.done) { tw.finish(); return; }
    const s = shots[si];
    if (s.text && li < s.text.length - 1) { li++; line(); } else shot();
  };
  next.onclick = (e) => { e.stopPropagation(); advance(); }; skip.onclick = (e) => { e.stopPropagation(); finish(); };
  el.onclick = advance;
  const off = keyAdvance(advance);
  S.push({ el, onBack: finish, modal: true });
  next.focus({ preventScroll: true });
  shot();
}

export function conversation(S: ScreenStack, first: DialogueStep, choose: (i: number) => DialogueStep, done: () => void): void {
  const face = h<'img'>('img.face'), faceWrap = h('div.facewrap', {}, face), name = h('div.who'), text = h('div.said');
  const next = h<'button'>('button.next', { 'aria-label': 'Continue' }, '▸'), choices = h('div.picks.hidden');
  const box = h('div.dlgbox', {}, faceWrap, h('div.dlgtext', {}, name, text, choices), next);
  const el = h('div.screen.talk', {}, h('div.bar.top'), h('div.bar.bottom'), box, h<'button'>('button.skip', { onclick: (e: Event) => { e.stopPropagation(); skip(); } }, 'Skip'));
  let lines: Line[] = [...first.lines], pending = first.choices, tw: ReturnType<typeof type> | null = null, over = false, choosing = false, lastSpeaker = '';
  const end = () => { if (over) return; over = true; off(); tw?.finish(); S.pop(); done(); };
  const showChoices = () => {
    choosing = true; next.classList.add('hidden'); choices.classList.remove('hidden');
    name.textContent = 'REED'; name.style.color = NAME_COLOR.REED; text.textContent = ''; setFace('REED');
    choices.replaceChildren(...pending.map((c, i) => h('button', { onclick: (e: Event) => { e.stopPropagation(); audio.play('uiSelect'); const st = choose(i); lines = [...st.lines]; pending = st.choices; choosing = false; choices.classList.add('hidden'); next.classList.remove('hidden'); next.focus({ preventScroll: true }); say(); } }, c)));
    (choices.firstElementChild as HTMLElement | null)?.focus({ preventScroll: true });
  };
  const setFace = (sp: string) => {
    const p = portrait(sp);
    faceWrap.classList.toggle('hidden', !p); box.classList.toggle('right', SIDE_RIGHT.has(sp)); box.classList.toggle('narration', !sp);
    if (p && face.src !== p) face.src = p;
    if (sp !== lastSpeaker && p) animate(faceWrap, { y: [6, 0], opacity: [0.4, 1], duration: 220, ease: 'outQuad' });
    lastSpeaker = sp;
  };
  const say = () => {
    const l = lines.shift();
    if (!l) { if (pending.length) showChoices(); else end(); return; }
    name.textContent = l.speaker; name.style.color = NAME_COLOR[l.speaker] ?? '#dfe8ea'; setFace(l.speaker);
    if (l.speaker === 'RADIO') audio.play('radioStatic', undefined, 0.5, 'voice');
    tw = type(text, l.text, 20, l.speaker === 'MILLER' ? 0.7 : l.speaker === 'REED' ? 0.85 : l.speaker === 'MAYA' ? 1.15 : l.speaker === 'IRIS' || l.speaker === 'WREN' ? 1.35 : 1);
  };
  const advance = () => { if (over || choosing) return; if (tw && !tw.done) { tw.finish(); return; } say(); };
  /** Skip to the next decision (never past a choice). */
  const skip = () => { if (over || choosing) return; tw?.finish(); lines = []; if (pending.length) showChoices(); else end(); };
  next.onclick = (e) => { e.stopPropagation(); advance(); }; el.onclick = advance;
  const off = keyAdvance(advance);
  S.push({ el, onBack: skip, modal: true });
  next.focus({ preventScroll: true });
  say();
}

export function noteScreen(S: ScreenStack, id: NoteId, done: () => void): void {
  const n = NOTES[id];
  const close = () => { off(); S.pop(); done(); };
  const btn = h<'button'>('button', { onclick: (e: Event) => { e.stopPropagation(); close(); } }, 'Put it away');
  const el = h('div.screen.dim.note', {}, h('div.paper', {}, h('h3', {}, n.title), ...n.text.split('\n').map((p) => h('p', {}, p)), n.research ? h('div.stamp', {}, 'RESEARCH NOTE') : null), h('div.menu', {}, btn));
  const off = keyAdvance(close);
  audio.play('search', undefined, 0.5, 'ui');
  S.push({ el, onBack: close, modal: true });
  animate(el.querySelector('.paper')!, { rotate: [-4, -1.2], y: [30, 0], opacity: [0, 1], duration: 380, ease: 'outBack' });
}
