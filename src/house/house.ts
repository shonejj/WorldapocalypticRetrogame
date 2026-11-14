import * as THREE from 'three';
import { Batch, box, cyl, M, type LightSpot } from '../art/kit';
import { SkinnedView, characterAssetReady } from '../art/skinned';
import { CharacterView, infectedLook } from '../art/characters';
import type { AnimIn } from '../game/rig';
import { INFECTED, ITEMS, WEAPONS, type InfectedType, type ItemId } from '../game/data';
import type { Game } from '../game/game';
import type { InputFrame } from '../core/input';
import { audio } from '../core/audio';
import { hashString } from '../core/math';
import { dress, wallpaper, type Dressing } from './dress';
import { HOUSE_INFECTED, type HouseDef, type HouseSpot, type MiniGame } from './plans';

/**
 * A fully 3D house, played third-person over the shoulder (the indoor half of the game).
 * It lives far from the street in the same scene; the street is hidden while you are inside.
 * The simulation is a small grid world: circle-vs-cell collision, BFS paths for the infected,
 * hitscan with a forgiving aim cone. Everything runs in the game's fixed 60 Hz step.
 */
const C = 2.0, H = 2.9, HX = 6000, R = 0.3;
const SOLID = new Set(['#', 'w', ' ', 'L', 'T', 'S', 'B', 'K', 'H']);
type View = SkinnedView | CharacterView;
interface Z { type: InfectedType; x: number; z: number; yaw: number; hp: number; maxHp: number; state: 'idle' | 'chase' | 'dead'; attackT: number; cd: number; hurt: number; path: [number, number][]; repath: number; deadT: number; view: View; t: number; speed: number; feeding: boolean; id: string }
interface Spot { key: string; i: number; j: number; def: HouseSpot; done: boolean; mesh: THREE.Object3D | null }

export class House {
  readonly root = new THREE.Group();
  done = false;
  private grid: string[][];
  private hidden: THREE.Object3D[] = [];
  private px: number; private pz: number; private yaw = 0; private pitch = 0.08;
  private vx = 0; private vz = 0; private speed = 0;
  private zs: Z[] = [];
  private spots: Spot[] = [];
  private exit: [number, number];
  private view: View;
  private lights: LightSpot[] = [];
  private torch: LightSpot;
  private fireCd = 0; private reloadT = -1; private meleeT = -1; private recoil = 0; private hurtT = 0; private aim = 0;
  private use: { s: Spot | 'exit' | [number, number]; t: number } | null = null;
  private lookDX = 0; private locked = false;
  private ui = document.createElement('div');
  private prompt = document.createElement('div');
  private bar = document.createElement('i');
  private camPos = new THREE.Vector3(); private camLook = new THREE.Vector3();
  private onMove = (e: MouseEvent) => { if (document.pointerLockElement === this.g.r.canvas) this.lookDX += e.movementX; };
  private onClick = () => { if (!this.g.paused && document.pointerLockElement !== this.g.r.canvas) void this.g.r.canvas.requestPointerLock?.(); };
  private onLock = () => { this.locked = document.pointerLockElement === this.g.r.canvas; this.ui.classList.toggle('locked', this.locked); };
  /** a minigame is open: the house waits */
  busy = false;
  private time = 0;
  private dressing!: Dressing;
  private lastF: InputFrame | null = null; private camT = 1; private faded = false;

  constructor(private g: Game, readonly def: HouseDef, readonly doorX: number, private play: (game: MiniGame) => Promise<boolean>) {
    this.grid = def.plan.map((r) => [...r]);
    const scene = g.r.scene;
    for (const o of scene.children) if (o.visible && o !== g.lights.group && o.name !== 'fx') { o.visible = false; this.hidden.push(o); }
    // ---- geometry
    const B = new Batch(), wall = wallpaper(def.wall, hashString(def.id)), floor = M.wood(def.floor), trim = M.wood('#2a1d14'), dark = M.dark(), cloth = M.cloth(0x4a3a36), metal = M.metal('#44494c'), pane = M.emissive(0x7d9cb4, 0.55), warm = M.emissive(0xffb060, 4);
    const rows = this.grid.length, cols = this.grid[0].length;
    let start: [number, number] = [1, 1];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const ch = this.grid[j][i], [x, z] = this.cell(i, j);
      if (ch === ' ') continue;
      if (ch === '#' || ch === 'w') {
        B.add(wall, box(C, H, C, x, H / 2, z, { tile: 1.1 }));
        if (ch === 'w') {
          const side = j === 0 ? 1 : -1;
          B.add(pane, box(C * 0.5, 1.0, 0.05, x, 1.5, z + side * (C / 2 + 0.01)));
          B.add(trim, box(C * 0.58, 0.08, 0.12, x, 0.98, z + side * (C / 2 + 0.03)));
          this.lights.push({ x, y: 1.6, z: z + side * 1.1, color: 0x7d9cb4, intensity: 1.6, distance: 5.5 });
        }
        continue;
      }
      // floor + ceiling for every walkable / furniture cell
      B.add(floor, box(C, 0.06, C, x, -0.03, z, { tile: 1.6 }));
      B.add(dark, box(C, 0.06, C, x, H + 0.03, z));
      if (ch === 'P') { start = [i, j]; this.exit = [i, j]; B.add(trim, box(C * 0.7, 2.1, 0.08, x, 1.05, z + C / 2 - 0.05)); this.lights.push({ x, y: 2.0, z: z - 0.4, color: 0x9ab4c8, intensity: 1.2, distance: 4 }); }
      if (ch === 'D' || ch === 'L') B.add(trim, box(C, 0.5, C, x, H - 0.25, z));
      if (ch === 'L') {
        // the leaf hangs from a hinge at its left edge so it can swing open once picked
        const vertical = this.grid[j - 1]?.[i] === '.' || this.grid[j + 1]?.[i] === '.' || this.grid[j - 1]?.[i] === 'D';
        const hinge = new THREE.Group(), leaf = new THREE.Mesh(new THREE.BoxGeometry(C * 0.9, 2.2, 0.1), M.wood('#3a2a1c'));
        leaf.position.set(C * 0.45, 1.1, 0); hinge.add(leaf);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M.metal('#b0a070')); knob.position.set(C * 0.8, 1.0, 0.08); hinge.add(knob);
        hinge.position.set(vertical ? x - C * 0.45 : x, 0, vertical ? z : z - C * 0.45); hinge.rotation.y = vertical ? 0 : -Math.PI / 2;
        this.root.add(hinge); this.doors.set(`${i},${j}`, hinge);
      }
      if (ch === 'T') B.add(trim, box(1.2, 0.08, 0.9, x, 0.78, z), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => box(0.07, 0.76, 0.07, x + a * 0.5, 0.38, z + b * 0.36)));
      if (ch === 'S') B.add(cloth, box(1.4, 0.45, 0.8, x, 0.3, z), box(1.4, 0.5, 0.2, x, 0.65, z - 0.35), box(0.2, 0.35, 0.8, x - 0.65, 0.6, z), box(0.2, 0.35, 0.8, x + 0.65, 0.6, z));
      if (ch === 'B') B.add(trim, box(1.0, 0.35, 1.5, x, 0.2, z), box(1.0, 0.7, 0.08, x, 0.5, z - 0.75)), B.add(cloth, box(0.95, 0.12, 1.4, x, 0.43, z + 0.02));
      if (ch === 'K') B.add(trim, box(C, 0.9, 0.7, x, 0.45, z - 0.3)), B.add(metal, box(C, 0.04, 0.72, x, 0.92, z - 0.3), box(C * 0.9, 0.7, 0.35, x, 1.9, z - 0.5));
      if (ch === 'H') for (let k = 0; k < 4; k++) B.add(trim, box(1.2, 0.04, 0.4, x, 0.3 + k * 0.5, z - 0.5)), B.add(k % 2 ? cloth : dark, box(0.3, 0.3, 0.25, x - 0.3 + k * 0.17, 0.48 + k * 0.5, z - 0.5));
      if (ch === 'c') { B.add(M.wood('#d8ccb0'), cyl(0.05, 0.05, 0.22, x + 0.5, 0.11, z - 0.5)); B.add(warm, box(0.03, 0.06, 0.03, x + 0.5, 0.26, z - 0.5)); this.lights.push({ x: x + 0.5, y: 0.5, z: z - 0.5, color: 0xff9a48, intensity: 3.5, distance: 6, flicker: true }); }
      if (ch === 'l') { B.add(M.emissive(0xd8e8f0, 2), box(0.6, 0.05, 0.15, x, H - 0.05, z)); this.lights.push({ x, y: H - 0.3, z, color: 0xc8dce8, intensity: 3, distance: 6.5, flicker: true }); }
      if (def.spots[ch]) {
        const sp = def.spots[ch], cab = new THREE.Group();
        const k = new Batch();
        if (sp.game === 'radio') k.add(dark, box(0.7, 0.4, 0.35, x, 0.95, z - 0.45)), k.add(M.emissive(0xffa040, 1.5), box(0.3, 0.12, 0.02, x - 0.12, 1.0, z - 0.27)), k.add(trim, box(1.0, 0.75, 0.6, x, 0.375, z - 0.45));
        else if (sp.game === 'fuse') k.add(metal, box(0.6, 0.8, 0.18, x, 1.4, z - C / 2 + 0.1)), k.add(M.emissive(0xff3020, 2), box(0.06, 0.06, 0.02, x + 0.2, 1.7, z - C / 2 + 0.2));
        else if (sp.game === 'lock') k.add(metal, box(0.8, 1.2, 0.6, x, 0.6, z - 0.4)), k.add(M.metal('#8a8a80'), cyl(0.08, 0.08, 0.05, x + 0.2, 0.7, z - 0.08, 10, { rotX: Math.PI / 2 }));
        else k.add(trim, box(1.0, 0.9, 0.55, x, 0.45, z - 0.45)), k.add(dark, box(0.9, 0.02, 0.02, x, 0.6, z - 0.17));
        cab.add(k.build());
        const glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), M.emissive(0xffe0a0, 3)); glint.name = 'glint'; glint.position.set(x, 1.35, z - 0.2); cab.add(glint);
        this.root.add(cab);
        const key = `${def.id}:${ch}`, done = g.looted.has(key);
        if (done) glint.visible = false;
        this.spots.push({ key, i, j, def: sp, done, mesh: glint });
      }
    }
    this.exit ??= start;
    const windows: [number, number][] = []; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (this.grid[j][i] === 'w') windows.push([i, j]);
    this.dressing = dress(this.root, B, this.grid, (i, j) => this.cell(i, j), C, H, hashString(def.id) + 7, this.exit ?? start, windows);
    this.root.add(B.build({ castShadow: false, receiveShadow: true }));
    scene.add(this.root);
    // ---- player
    [this.px, this.pz] = this.cell(start[0], start[1]); this.pz -= 0.3;
    this.yaw = 0;
    const L = g.leader, look = L.survivor!.look;
    this.view = characterAssetReady() ? new SkinnedView(look, 1) : new CharacterView(look, 1);
    this.view.setWeapon(WEAPONS[L.weapon].mesh); this.root.add(this.view.root);
    // ---- infected
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const t = HOUSE_INFECTED[this.grid[j][i]]; if (!t) continue;
      this.grid[j][i] = '.';
      const id = `${def.id}:z${i}_${j}`; if (g.killed.has(id)) continue;
      const d = INFECTED[t], [x, z] = this.cell(i, j);
      const look = infectedLook(d.body ?? (t as 'common'), hashString(id));
      const v = characterAssetReady() ? new SkinnedView(look, d.scale) : new CharacterView(look, d.scale);
      this.root.add(v.root);
      this.zs.push({ id, type: t, x, z, yaw: g.rng.range(0, 6.28), hp: d.hp, maxHp: d.hp, state: 'idle', attackT: -1, cd: 0, hurt: 0, path: [], repath: 0, deadT: 0, view: v, t: g.rng.range(0, 9), speed: 0, feeding: g.rng.chance(0.5) });
    }
    // flashlight: a pooled cone light that follows your aim
    this.torch = { x: 0, y: 0, z: 0, color: 0xfff0d8, intensity: 5, distance: 14, cone: true, angle: 0.42, aim: { x: 0, y: 0, z: 0 } };
    g.lights.set([this.torch, ...this.lights]);
    g.r.view = (cam) => this.place(cam);
    g.r.camera.fov = 62; g.r.camera.updateProjectionMatrix();
    // ---- UI: crosshair + prompt
    this.ui.className = 'house-ui';
    this.ui.innerHTML = `<div class="xhair"></div>`;
    this.prompt.className = 'house-prompt'; this.prompt.append(document.createElement('span'), this.bar);
    this.ui.append(this.prompt);
    document.body.append(this.ui);
    addEventListener('mousemove', this.onMove); g.r.canvas.addEventListener('click', this.onClick); document.addEventListener('pointerlockchange', this.onLock);
    g.ev.emit('place', { title: def.title });
    if (def.enter) setTimeout(() => g.toast(def.enter!, 'info'), 1600);
    audio.play('door', 0, 0.9);
  }

  // ------------------------------------------------------------------ grid helpers
  private cell(i: number, j: number): [number, number] { return [HX + i * C, j * C]; }
  private at(x: number, z: number): [number, number] { return [Math.floor((x - HX) / C + 0.5), Math.floor(z / C + 0.5)]; }
  private solidAt(x: number, z: number): boolean { const [i, j] = this.at(x, z); const ch = this.grid[j]?.[i]; return ch === undefined || SOLID.has(ch) || !!this.spots.find((s) => s.i === i && s.j === j); }
  private blocked(x: number, z: number): boolean { return this.solidAt(x - R, z - R) || this.solidAt(x + R, z - R) || this.solidAt(x - R, z + R) || this.solidAt(x + R, z + R); }
  private los(ax: number, az: number, bx: number, bz: number): boolean {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.25);
    for (let k = 1; k < n; k++) { const t = k / n; if (this.solidAt(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }
  private bfs(from: [number, number], to: [number, number]): [number, number][] {
    const key = (i: number, j: number) => j * 100 + i, prev = new Map<number, number>(), q: [number, number][] = [from];
    prev.set(key(...from), -1);
    while (q.length) {
      const [i, j] = q.shift()!;
      if (i === to[0] && j === to[1]) break;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj, ch = this.grid[nj]?.[ni];
        if (ch === undefined || (SOLID.has(ch)) || prev.has(key(ni, nj))) continue;
        prev.set(key(ni, nj), key(i, j)); q.push([ni, nj]);
      }
    }
    const out: [number, number][] = []; let k = prev.get(key(...to)) !== undefined ? key(...to) : -1;
    while (k !== -1 && k !== undefined) { out.unshift([k % 100, Math.floor(k / 100)]); k = prev.get(k)!; }
    return out.slice(1);
  }
  private get fwd(): [number, number] { return [Math.sin(this.yaw), -Math.cos(this.yaw)]; }

  // ------------------------------------------------------------------ simulation (fixed step)
  tick(dt: number, f: InputFrame | null): void {
    if (this.busy || this.done) return;
    // later sub-steps of one frame get no input frame: keep the held state, drop one-shot presses
    if (f) this.lastF = { ...f, pressed: new Set() }; else f = this.lastF;
    this.time += dt;
    const L = this.g.leader, w = WEAPONS[L.weapon];
    // look: mouse (pointer lock), right stick, arrow keys; without pointer lock A/D also turn
    const turn = (f?.turn ?? 0) + (!this.locked && f?.strafe && !f.held.has('fire') ? f.strafe * 0.8 : 0);
    this.yaw += this.lookDX * 0.0028 + turn * 2.6 * dt; this.lookDX = 0;
    // move
    const strafe = this.locked ? f?.strafe ?? 0 : 0, fwdIn = -(f?.moveY ?? 0);
    const run = !!f?.held.has('run'), crouch = L.crouching;
    if (f?.pressed.has('crouch')) L.crouching = !L.crouching;
    const max = (run ? 3.6 : crouch ? 1.0 : 1.9) * (this.aim > 0.5 ? 0.6 : 1);
    const [fx, fz] = this.fwd, rx = -fz, rz = fx;
    let mx = fx * fwdIn + rx * strafe, mz = fz * fwdIn + rz * strafe; const m = Math.hypot(mx, mz); if (m > 1) { mx /= m; mz /= m; }
    const k = 1 - Math.exp(-12 * dt);
    this.vx += (mx * max - this.vx) * k; this.vz += (mz * max - this.vz) * k;
    if (this.use || this.reloadT >= 0 && false) { this.vx *= 0.5; this.vz *= 0.5; }
    const nx = this.px + this.vx * dt, nz = this.pz + this.vz * dt;
    if (!this.blocked(nx, this.pz)) this.px = nx; else this.vx = 0;
    if (!this.blocked(this.px, nz)) this.pz = nz; else this.vz = 0;
    this.speed = Math.hypot(this.vx, this.vz);
    if (this.speed > 0.4 && Math.floor(this.time * (run ? 3.2 : 2)) !== Math.floor((this.time - dt) * (run ? 3.2 : 2))) { audio.play('step', 0, crouch ? 0.2 : run ? 0.8 : 0.45); if (run) this.alert(this.px, this.pz, 5); }
    // weapons
    this.fireCd -= dt; this.recoil = Math.max(0, this.recoil - dt * 4); this.hurtT = Math.max(0, this.hurtT - dt * 2);
    this.aim += ((f?.held.has('fire') || this.fireCd > -0.6 ? 1 : 0) - this.aim) * (1 - Math.exp(-10 * dt));
    if (this.reloadT >= 0) {
      this.reloadT += dt;
      if (this.reloadT >= w.reload) { const need = w.mag - L.mag, got = w.ammo ? this.g.take(w.ammo, Math.min(need, this.g.ammo(w.ammo))) : need; L.mag += got; this.reloadT = -1; }
    } else if (f?.pressed.has('reload') && L.mag < w.mag && (!w.ammo || this.g.ammo(w.ammo) > 0)) { this.reloadT = 0; audio.play('reload', 0, 0.8); }
    if (this.meleeT >= 0) { this.meleeT += dt; if (this.meleeT > 0.45) this.meleeT = -1; }
    else if (f?.pressed.has('melee')) this.melee();
    else if (f?.held.has('fire') && this.fireCd <= 0 && this.reloadT < 0 && !this.use) {
      if (L.mag > 0) this.shoot(); else { audio.play('dryfire', 0, 0.8); this.fireCd = 0.4; if (!w.ammo || this.g.ammo(w.ammo) > 0) this.reloadT = 0; }
    }
    if (f?.pressed.has('heal')) this.g.heal(L);
    // interact
    const target = this.nearest();
    if (f?.pressed.has('interact') && target && !this.use) this.use = { s: target, t: 0 };
    if (this.use) {
      if (this.use.s !== target || this.speed > 1.2) this.use = null;
      else {
        this.use.t += dt;
        const need = this.use.s === 'exit' || Array.isArray(this.use.s) ? 0.3 : (this.use.s as Spot).def.game ? 0.2 : 1.3;
        if (this.use.t >= need) { const s = this.use.s; this.use = null; void this.activate(s); }
      }
    }
    // infected
    for (const z of this.zs) this.think(z, dt);
  }

  private nearest(): Spot | 'exit' | [number, number] | null {
    const [fx, fz] = this.fwd, px = this.px + fx * 0.9, pz = this.pz + fz * 0.9;
    let best: Spot | 'exit' | [number, number] | null = null, bd = 1.25;
    for (const s of this.spots) { if (s.done) continue; const [x, z] = this.cell(s.i, s.j), d = Math.hypot(x - px, z - pz); if (d < bd) { bd = d; best = s; } }
    const [ex, ez] = this.cell(...this.exit); if (Math.hypot(ex - this.px, ez + 0.2 - this.pz) < 1.0) best = 'exit';
    for (let j = 0; j < this.grid.length; j++) for (let i = 0; i < this.grid[j].length; i++) if (this.grid[j][i] === 'L') { const [x, z] = this.cell(i, j), d = Math.hypot(x - px, z - pz); if (d < bd) { bd = d; best = [i, j]; } }
    return best;
  }

  private async activate(s: Spot | 'exit' | [number, number]): Promise<void> {
    if (s === 'exit') { this.done = true; return; }
    if (Array.isArray(s)) {
      this.busy = true; const ok = await this.play('lock'); this.busy = false;
      if (ok) { this.grid[s[1]][s[0]] = 'D'; this.rebuildDoor(s); audio.play('door', 0, 0.8); } else { this.g.toast('The pick slipped. Something heard that.', 'warn'); this.alert(this.px, this.pz, 9); }
      return;
    }
    if (s.def.game) {
      this.busy = true; const ok = await this.play(s.def.game); this.busy = false;
      if (!ok) { this.g.toast(s.def.game === 'radio' ? 'Only static.' : 'It won\'t give.', 'warn'); if (s.def.game === 'lock') this.alert(this.px, this.pz, 8); return; }
    } else audio.play('search', 0, 0.6);
    s.done = true; if (s.mesh) s.mesh.visible = false;
    this.g.looted.add(s.key);
    const got: string[] = [];
    for (const [k, n] of Object.entries(s.def.loot ?? {}) as [ItemId, number][]) { const a = this.g.stash.add(k, n); if (a) got.push(`+${a} ${ITEMS[k].name}`); }
    if (got.length) { audio.play('pickup'); this.g.toast(got.join('  '), 'loot'); }
    if (s.def.line) this.g.toast(s.def.line, 'info');
    if (s.def.note) { this.g.notes.add(s.def.note); this.g.ev.emit('note', { id: s.def.note }); }
    this.g.ev.emit('stash', {});
  }

  private doors = new Map<string, THREE.Object3D>();
  private swing: { o: THREE.Object3D; from: number; t: number }[] = [];
  private rebuildDoor([i, j]: [number, number]): void {
    const d = this.doors.get(`${i},${j}`); if (d) this.swing.push({ o: d, from: d.rotation.y, t: 0 });
  }

  private shoot(): void {
    const L = this.g.leader, w = WEAPONS[L.weapon];
    L.mag--; this.fireCd = w.cooldown; this.recoil = 1; this.g.shotsFired++;
    const [fx, fz] = this.fwd, mx = this.px + fx * 0.7 + -fz * 0.18, mz = this.pz + fz * 0.7 + fx * 0.18, my = 1.35;
    audio.play(w.sfx, 0, 1);
    this.g.fx.muzzle(new THREE.Vector3(mx, my, mz), w.pellets > 1 ? 1.4 : 1);
    this.g.lights.transient.push({ x: mx, y: my, z: mz, color: 0xffc070, intensity: 16, distance: 8, t: 0.06 });
    this.g.cam.addTrauma(w.trauma * 0.6);
    this.alert(this.px, this.pz, w.noise * 0.6);
    // forgiving hitscan: nearest infected inside a cone that widens up close, with a clear line
    let hit: Z | null = null, hd = w.range;
    for (const z of this.zs) {
      if (z.state === 'dead') continue;
      const dx = z.x - this.px, dz = z.z - this.pz, d = Math.hypot(dx, dz);
      if (d > hd) continue;
      const cos = (dx * fx + dz * fz) / d, off = Math.acos(Math.min(1, cos)), allow = Math.atan2(0.42, d) + w.spread * 2 + 0.05;
      if (off < allow && this.los(this.px, this.pz, z.x, z.z)) { hit = z; hd = d; }
    }
    const end = hit ? new THREE.Vector3(hit.x, 1.3, hit.z) : new THREE.Vector3(mx + fx * 12, my, mz + fz * 12);
    this.g.fx.tracer(new THREE.Vector3(mx, my, mz), end);
    if (hit) { const fall = w.pellets > 1 ? Math.max(0.3, 1 - hd / w.range) : 1; this.damage(hit, w.damage * w.pellets * fall * 0.85, fx, fz); }
  }

  private melee(): void {
    this.meleeT = 0; audio.play('melee', 0, 0.8);
    const [fx, fz] = this.fwd;
    for (const z of this.zs) {
      if (z.state === 'dead') continue;
      const dx = z.x - this.px, dz = z.z - this.pz, d = Math.hypot(dx, dz);
      if (d < 1.4 && (dx * fx + dz * fz) / d > 0.5) { this.damage(z, 38, fx, fz); const nx = z.x + fx * 0.6, nz = z.z + fz * 0.6; if (!this.blockedAt(nx, nz)) { z.x = nx; z.z = nz; } z.cd = Math.max(z.cd, 0.8); }
    }
  }
  private blockedAt(x: number, z: number): boolean { return this.blocked(x, z); }

  private damage(z: Z, dmg: number, fx: number, fz: number): void {
    z.hp -= dmg; z.hurt = 1; z.state = z.state === 'dead' ? 'dead' : 'chase'; z.feeding = false;
    this.g.fx.puff(z.x - fx * 0.2, 1.3, z.z - fz * 0.2, { size: 0.25, life: 0.6, alpha: 0.5, color: 0x5a0a08 });
    audio.play('hitFlesh', 0, 0.8);
    if (z.hp <= 0) { z.state = 'dead'; z.deadT = 0; this.g.killed.add(z.id); audio.play('death', 0, 0.7); }
  }

  /** Sound in the house: everything in earshot with a path comes looking. */
  private alert(x: number, zz: number, radius: number): void {
    for (const z of this.zs) if (z.state === 'idle' && Math.hypot(z.x - x, z.z - zz) < radius * INFECTED[z.type].hearing) { z.state = 'chase'; z.feeding = false; this.g.sfx('groan', 0, 0.6); }
  }

  private think(z: Z, dt: number): void {
    z.t += dt; z.hurt = Math.max(0, z.hurt - dt * 3);
    if (z.state === 'dead') { z.deadT += dt; return; }
    const d = INFECTED[z.type], dx = this.px - z.x, dz = this.pz - z.z, dist = Math.hypot(dx, dz);
    if (z.state === 'idle') {
      // alive even when idle: feeding hunched over something, or swaying and turning toward sounds
      z.speed = 0;
      if (!z.feeding) z.yaw += Math.sin(z.t * 0.4) * dt * 0.4;
      const facing = (Math.sin(z.yaw) * dx - Math.cos(z.yaw) * dz) / Math.max(0.01, dist) > 0.2;
      const sight = d.sight * (this.g.leader.crouching ? 0.45 : 0.8) * (facing ? 1 : 0.3) * (z.feeding ? 0.5 : 1);
      if (dist < sight && this.los(z.x, z.z, this.px, this.pz)) { z.state = 'chase'; z.feeding = false; this.g.sfx(z.type === 'runner' ? 'shriek' : 'groan', 0, 0.9); }
      return;
    }
    // chase: straight at you with a clear line, else along a grid path
    z.cd -= dt;
    if (z.attackT >= 0) {
      z.attackT += dt; z.speed = 0;
      if (z.attackT >= d.windup) {
        z.attackT = -1; z.cd = d.cooldown;
        if (dist < d.reach + 0.45) {
          const L = this.g.leader; L.hp = Math.max(1, L.hp - d.damage); this.hurtT = 1; this.g.cam.addTrauma(0.4); audio.play('hurt', 0, 1);
          this.g.ev.emit('stash', {});
          if (L.hp <= 1) { this.g.toast('You barely make it back out.', 'warn'); this.done = true; }
        }
      }
      return;
    }
    if (dist < d.reach + 0.2 && z.cd <= 0) { z.attackT = 0; z.yaw = Math.atan2(dx, -dz); return; }
    let tx = this.px, tz = this.pz;
    if (!this.los(z.x, z.z, this.px, this.pz)) {
      z.repath -= dt;
      if (z.repath <= 0 || !z.path.length) { z.path = this.bfs(this.at(z.x, z.z), this.at(this.px, this.pz)); z.repath = 0.4; }
      if (z.path.length) { [tx, tz] = this.cell(...z.path[0]); if (Math.hypot(tx - z.x, tz - z.z) < 0.3) z.path.shift(); }
    }
    const mx = tx - z.x, mz = tz - z.z, m = Math.hypot(mx, mz) || 1, sp = dist < d.reach ? 0 : d.chase * 0.85;
    z.yaw = Math.atan2(mx, -mz);
    const nx = z.x + (mx / m) * sp * dt, nz = z.z + (mz / m) * sp * dt;
    if (!this.blocked(nx, z.z)) z.x = nx; if (!this.blocked(z.x, nz)) z.z = nz;
    // don't stack: push apart from each other
    for (const o of this.zs) if (o !== z && o.state !== 'dead') { const ox = z.x - o.x, oz = z.z - o.z, od = Math.hypot(ox, oz); if (od < 0.55 && od > 0) { z.x += (ox / od) * 0.01; z.z += (oz / od) * 0.01; } }
    z.speed = sp;
  }

  // ------------------------------------------------------------------ presentation (every frame)
  update(dt: number): void {
    const L = this.g.leader, w = WEAPONS[L.weapon], [fx, fz] = this.fwd;
    const ai = (o: Partial<AnimIn>): AnimIn => ({ t: this.time, phase: 0, speed: 0, run: false, crouch: false, gait: 'survivor', stance: 'none', aim: 0, recoil: 0, melee: 0, reload: 0, heal: 0, hurt: 0, attack: 0, throwT: 0, dormant: false, drawn: true, ...o });
    const v = this.view;
    if (v instanceof SkinnedView) v.animate(ai({ speed: this.speed, run: this.speed > 2.6, crouch: L.crouching, stance: w.stance, aim: this.aim, recoil: this.recoil, melee: this.meleeT >= 0 ? this.meleeT / 0.45 : 0, reload: this.reloadT >= 0 ? this.reloadT / w.reload : 0, hurt: this.hurtT, task: this.use && this.use.s !== 'exit' ? 'search' : null }), dt);
    v.root.position.set(this.px, 0, this.pz); v.root.rotation.set(0, Math.atan2(fx, fz), 0);
    v.flash(this.hurtT * 0.5);
    const fade = this.camT < 0.45; if (fade !== this.faded) { this.faded = fade; v.setOpacity(fade ? 0.35 : 1); }   // never a wall of hair
    for (const z of this.zs) {
      const zv = z.view, d = INFECTED[z.type];
      if (z.state === 'dead' && z.deadT > 4) { zv.root.visible = false; continue; }
      if (zv instanceof SkinnedView) zv.animate(ai({ t: z.t, phase: (z.t * 0.37) % 1, speed: z.speed, run: z.state === 'chase', gait: d.gait, crouch: z.feeding && z.state === 'idle', attack: z.attackT >= 0 ? z.attackT / d.windup : 0, hurt: z.hurt, dormant: z.state === 'dead', drawn: false }), dt);
      zv.root.position.set(z.x, 0, z.z); zv.root.rotation.set(0, Math.atan2(Math.sin(z.yaw), -Math.cos(z.yaw)), 0);
      zv.flash(z.hurt * 0.5);
      if (z.state === 'dead' && z.deadT > 3) zv.setOpacity(Math.max(0, 1 - (z.deadT - 3)));
    }
    // flashlight from the shoulder along the aim
    this.torch.x = this.px - fz * 0.25 + fx * 0.3; this.torch.y = 1.5; this.torch.z = this.pz + fx * 0.25 + fz * 0.3;
    this.torch.aim = { x: this.px + fx * 8, y: 0.6 + this.pitch * 4, z: this.pz + fz * 8 };
    this.g.lights.update(this.px, this.time);
    const dp = this.dressing.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < dp.count; k++) { dp.setY(k, ((dp.getY(k) + dt * (0.03 + (k % 7) * 0.006)) % (H - 0.2)) + 0.0); dp.setX(k, dp.getX(k) + Math.sin(this.time * 0.3 + k) * dt * 0.02); }
    dp.needsUpdate = true;
    for (const s of this.dressing.shafts) ((s as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.06 + Math.sin(this.time * 0.4) * 0.015;
    for (const sw of this.swing) { sw.t = Math.min(1, sw.t + dt * 1.5); sw.o.rotation.y = sw.from + (1 - (1 - sw.t) ** 3) * 1.6; }
    for (const s of this.spots) if (s.mesh && !s.done) { s.mesh.rotation.y += dt * 1.6; s.mesh.position.y = 1.35 + Math.sin(this.time * 2 + s.i) * 0.04; }
    audio.listenerX = 0;
    // prompt
    const t = this.nearest(), label = t === 'exit' ? 'Go back outside' : Array.isArray(t) ? 'Pick the lock' : t ? t.def.label : '';
    this.prompt.classList.toggle('on', !!label && !this.busy);
    (this.prompt.firstChild as HTMLElement).textContent = label ? `E  ${label}` : '';
    const need = this.use ? (this.use.s === 'exit' || Array.isArray(this.use.s) ? 0.3 : (this.use.s as Spot).def.game ? 0.2 : 1.3) : 1;
    this.bar.style.width = `${this.use ? Math.min(100, (this.use.t / need) * 100) : 0}%`;
    this.ui.classList.toggle('aim', this.aim > 0.5);
  }

  /** Over-the-shoulder camera, pulled in before it would clip into a wall. */
  private place(cam: THREE.PerspectiveCamera): void {
    const [fx, fz] = this.fwd, rx = -fz, rz = fx, aimK = this.aim * 0.35, s = this.g.r.shakeOffset;
    const head = new THREE.Vector3(this.px, this.g.leader.crouching ? 1.15 : 1.55, this.pz);
    const B0 = 2.9 - aimK * 1.1, side = 0.95 + aimK * 0.1;
    // march from the head toward the wanted spot and stop short of the first wall; the closer the
    // wall, the higher the camera rides, so it looks down over the shoulder instead of into the hair
    const dirx = -fx * B0 + rx * side, dirz = -fz * B0 + rz * side, len = Math.hypot(dirx, dirz);
    let t = 1;
    for (let k = 1; k <= 24; k++) {
      const q = k / 24, x = head.x + dirx * q, z = head.z + dirz * q, m = 0.28;
      if (this.solidAt(x, z) || this.solidAt(x + m, z) || this.solidAt(x - m, z) || this.solidAt(x, z + m) || this.solidAt(x, z - m)) { t = Math.max(0.12, (k - 1) / 24); break; }
    }
    const p = new THREE.Vector3(head.x + dirx * t, Math.min(H - 0.3, head.y + 0.35 + this.pitch * 1.5 + (1 - t) * 1.0), head.z + dirz * t);
    void len; this.camT = t;
    const kk = 1 - Math.exp(-14 * (1 / 60));
    if (!this.camPos.lengthSq()) this.camPos.copy(p); else this.camPos.lerp(p, kk * 3);
    const look = new THREE.Vector3(head.x + fx * 6 + rx * 0.4, head.y - 0.1 - this.pitch * 3, head.z + fz * 6 + rz * 0.4);
    if (!this.camLook.lengthSq()) this.camLook.copy(look); else this.camLook.lerp(look, kk * 4);
    cam.position.set(this.camPos.x + s.x * 0.3, this.camPos.y + s.y * 0.3, this.camPos.z);
    cam.lookAt(this.camLook);
  }

  dispose(): void {
    removeEventListener('mousemove', this.onMove); this.g.r.canvas.removeEventListener('click', this.onClick); document.removeEventListener('pointerlockchange', this.onLock);
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.remove();
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    this.view.dispose(); for (const z of this.zs) z.view.dispose();
    this.root.removeFromParent();
    for (const o of this.hidden) o.visible = true;
    this.g.r.view = null; this.g.r.resize();
  }
}
