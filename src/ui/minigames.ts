import { audio } from '../core/audio';
import type { MiniGame } from '../house/plans';

/**
 * Three small hands-on puzzles for the houses. Each is a full-screen overlay drawn on a tiny
 * canvas scaled up with nearest-neighbour (same pixel look as the game) and resolves to
 * true (done) or false (failed / backed out). Keyboard, mouse, touch and gamepad A all work.
 *   lock  — a needle sweeps the lock; tap when it is inside the bright arc (three pins, three slips allowed)
 *   fuse  — five breakers; flipping one also flips its neighbours; get every light green
 *   radio — turn the dial until the voice comes through the static, then hold it there
 */
const W = 192, H = 128;

export function playMinigame(kind: MiniGame): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('div'); el.className = 'minigame';
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const help = document.createElement('div'); help.className = 'mg-help';
    help.textContent = kind === 'lock' ? 'E / Space / click when the needle is in the light' : kind === 'fuse' ? 'A / D choose · E flip · or click a breaker' : 'A / D or drag to tune · hold on the voice';
    const back = document.createElement('button'); back.textContent = 'Back away (Esc)';
    el.append(cv, help, back); document.body.append(el);
    const g = cv.getContext('2d')!; g.imageSmoothingEnabled = false;
    const keys = new Set<string>();
    let tap = false, dir = 0, raf = 0, last = performance.now(), over = false, dragX: number | null = null;
    const finish = (ok: boolean) => {
      if (over) return; over = true; cancelAnimationFrame(raf);
      audio.play(ok ? 'uiSelect' : 'uiBack');
      removeEventListener('keydown', kd, true); removeEventListener('keyup', ku, true);
      el.classList.add(ok ? 'ok' : 'fail');
      setTimeout(() => { el.remove(); resolve(ok); }, ok ? 650 : 300);
    };
    const kd = (e: KeyboardEvent) => {
      e.stopImmediatePropagation(); e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Escape') finish(false);
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') tap = true;
      keys.add(e.code);
    };
    const ku = (e: KeyboardEvent) => { e.stopImmediatePropagation(); keys.delete(e.code); };
    addEventListener('keydown', kd, true); addEventListener('keyup', ku, true);
    back.onclick = () => finish(false);
    const local = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
    let click: [number, number] | null = null;
    cv.onpointerdown = (e) => { click = local(e) as [number, number]; dragX = e.clientX; tap = true; };
    cv.onpointermove = (e) => { if (dragX !== null && e.buttons) { dir = Math.max(-1, Math.min(1, (e.clientX - dragX) / 40)); dragX = e.clientX; } };
    cv.onpointerup = () => { dragX = null; dir = 0; };
    let padA = false;
    const padTap = () => { const p = navigator.getGamepads?.()[0]; const a = !!p?.buttons[0]?.pressed; if (a && !padA) tap = true; padA = a; if (p?.buttons[1]?.pressed) finish(false); return p ? (Math.abs(p.axes[0]) > 0.2 ? p.axes[0] : 0) : 0; };

    // ---------------------------------------------------------------- state per game
    const R = Math.random;
    let needle = 0, pins = 0, slips = 0, arc = R() * Math.PI * 2, arcW = 0.75, speed = 2.4;
    const fuses = [true, true, true, true, true]; let sel = 0;
    for (let k = 0; k < 3; k++) flip(Math.floor(R() * 5));
    if (fuses.every(Boolean)) flip(2);
    function flip(i: number) { for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < 5) fuses[j] = !fuses[j]; }
    let dial = 0.15 + R() * 0.2, hold = 0; const target = 0.55 + R() * 0.35;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const stick = padTap();
      const steer = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) || stick || dir;
      g.fillStyle = '#0b0d0e'; g.fillRect(0, 0, W, H);
      if (kind === 'lock') {
        needle = (needle + dt * speed) % (Math.PI * 2);
        const cx = W / 2, cy = H / 2 + 4, r = 40;
        g.fillStyle = '#2a2622'; g.beginPath(); g.arc(cx, cy, r + 8, 0, 7); g.fill();
        g.strokeStyle = '#4a4238'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
        g.strokeStyle = '#ffd890'; g.beginPath(); g.arc(cx, cy, r, arc - arcW / 2, arc + arcW / 2); g.stroke();
        g.strokeStyle = '#e8e0d0'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(needle) * (r + 4), cy + Math.sin(needle) * (r + 4)); g.stroke();
        for (let k = 0; k < 3; k++) { g.fillStyle = k < pins ? '#8fd070' : '#3a3a34'; g.fillRect(cx - 22 + k * 18, 8, 10, 6); }
        for (let k = 0; k < 3; k++) { g.fillStyle = k < slips ? '#c04030' : '#2a2a26'; g.fillRect(cx - 22 + k * 18, H - 12, 10, 4); }
        if (tap) {
          let d = Math.abs(((needle - arc + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (d < arcW / 2) { pins++; audio.play('hitMetal', 0, 0.5); arc = R() * Math.PI * 2; arcW *= 0.82; speed *= 1.25; if (pins >= 3) finish(true); }
          else { slips++; audio.play('dryfire', 0, 0.7); if (slips >= 3) finish(false); }
          d = 0;
        }
      } else if (kind === 'fuse') {
        if (tap && !click) flip(sel), audio.play('hitMetal', 0, 0.4);
        if (click) { const i = Math.floor((click[0] - 26) / 28); if (i >= 0 && i < 5) { sel = i; flip(i); audio.play('hitMetal', 0, 0.4); } }
        if (keys.has('KeyA') || keys.has('ArrowLeft')) { sel = Math.max(0, sel - 1); keys.delete('KeyA'); keys.delete('ArrowLeft'); }
        if (keys.has('KeyD') || keys.has('ArrowRight')) { sel = Math.min(4, sel + 1); keys.delete('KeyD'); keys.delete('ArrowRight'); }
        g.fillStyle = '#2e3236'; g.fillRect(18, 14, W - 36, H - 28);
        for (let i = 0; i < 5; i++) {
          const x = 30 + i * 28, on = fuses[i];
          g.fillStyle = on ? '#6fd06a' : '#5a1810'; g.fillRect(x + 4, 24, 12, 6);
          g.fillStyle = '#16181a'; g.fillRect(x, 40, 20, 52);
          g.fillStyle = '#c8c0b0'; g.fillRect(x + 4, on ? 44 : 70, 12, 18);
          if (i === sel) { g.strokeStyle = '#ffd890'; g.lineWidth = 1; g.strokeRect(x - 2.5, 37.5, 25, 58); }
        }
        if (fuses.every(Boolean)) finish(true);
      } else {
        dial = Math.max(0, Math.min(1, dial + steer * dt * 0.28));
        const off = Math.abs(dial - target), clear = Math.max(0, 1 - off / 0.08);
        g.fillStyle = '#1c1812'; g.fillRect(10, 10, W - 20, 70);
        g.strokeStyle = clear > 0.85 ? '#ffd890' : '#7a6a50'; g.lineWidth = 1; g.beginPath();
        for (let x = 12; x < W - 12; x++) {
          const t = now / 1000, sig = Math.sin(x * 0.18 + t * 9) * 12 * clear, noise = (R() - 0.5) * 50 * (1 - clear * 0.9);
          const y = 45 + sig + noise; if (x === 12) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
        g.fillStyle = '#2a2418'; g.fillRect(16, 94, W - 32, 14);
        for (let k = 0; k <= 20; k++) { g.fillStyle = '#5a5040'; g.fillRect(16 + k * ((W - 32) / 20), k % 5 ? 104 : 98, 1, k % 5 ? 4 : 10); }
        g.fillStyle = '#ff9040'; g.fillRect(16 + dial * (W - 32) - 1, 92, 3, 18);
        g.fillStyle = '#a89878'; g.font = '8px monospace'; g.fillText(`${(6.8 + dial * 1.2).toFixed(3)} MHz`, 16, H - 6);
        hold = clear > 0.85 ? hold + dt : Math.max(0, hold - dt * 2);
        g.fillStyle = '#ffd890'; g.fillRect(W - 60, H - 12, 44 * Math.min(1, hold / 1.6), 4);
        if (Math.random() < dt * 6 * (1 - clear)) audio.play('radioStatic', 0, 0.15 * (1 - clear));
        if (hold >= 1.6) finish(true);
      }
      tap = false; click = null;
      if (!over) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}
