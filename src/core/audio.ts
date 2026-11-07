/**
 * Procedural audio (audio-design skill) — Web Audio only, no sample files (offline-safe).
 * Bus tree: master ← { music, ambience, sfx, ui, voice }. Volumes are set in dB from squared
 * 0..1 sliders. Voice ducks music+ambience (sidechain-style ramp). Every SFX gets small random
 * pitch/gain variation and stereo position from world x. Music is adaptive: three layers
 * (drone / tension / combat) crossfaded by an intensity value, scheduled on a beat clock.
 */
export type Bus = 'music' | 'ambience' | 'sfx' | 'ui' | 'voice';
export type Sfx =
  | 'rifle' | 'pistol' | 'shotgun' | 'dryfire' | 'reload' | 'melee' | 'hitFlesh' | 'hitMetal' | 'hitWood' | 'hitConcrete'
  | 'step' | 'stepWet' | 'groan' | 'shriek' | 'bruteRoar' | 'hurt' | 'death' | 'pickup' | 'craft' | 'search' | 'heal'
  | 'throw' | 'glassBreak' | 'uiMove' | 'uiSelect' | 'uiBack' | 'alert' | 'radioStatic' | 'thunder' | 'door' | 'casing';

export const dbToGain = (db: number) => Math.pow(10, db / 20);
export const sliderToDb = (v: number) => (v <= 0.0001 ? -80 : 20 * Math.log10(v * v));

export class AudioEngine {
  ctx: AudioContext | null = null;
  private bus = {} as Record<Bus | 'master' | 'duck', GainNode>;
  private noiseBuf!: AudioBuffer;
  listenerX = 0;
  private intensity = 0;          // 0 calm … 1 combat
  private layers: { drone: GainNode; tension: GainNode; combat: GainNode } | null = null;
  private nextBeat = 0; private beat = 0;
  private rainGain: GainNode | null = null;
  volumes: Record<Bus | 'master', number> = { master: 0.85, music: 0.6, ambience: 0.75, sfx: 0.9, ui: 0.7, voice: 0.9 };

  unlock(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4; comp.connect(ctx.destination);
    const g = () => ctx.createGain();
    this.bus.master = g(); this.bus.master.connect(comp);
    this.bus.duck = g(); this.bus.duck.connect(this.bus.master);           // music+ambience pass through duck
    for (const b of ['music', 'ambience'] as const) { this.bus[b] = g(); this.bus[b].connect(this.bus.duck); }
    for (const b of ['sfx', 'ui', 'voice'] as const) { this.bus[b] = g(); this.bus[b].connect(this.bus.master); }
    const len = ctx.sampleRate * 2; this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.startAmbience();
    this.startMusic();
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    for (const [b, v] of Object.entries(this.volumes)) this.bus[b as Bus]?.gain.setTargetAtTime(dbToGain(sliderToDb(v)), this.ctx.currentTime, 0.05);
  }

  /** Duck music+ambience while voice/radio plays. */
  duck(on: boolean): void {
    if (!this.ctx) return;
    this.bus.duck.gain.setTargetAtTime(on ? dbToGain(-11) : 1, this.ctx.currentTime, on ? 0.03 : 0.35);
  }
  setRain(on: boolean): void { if (this.ctx && this.rainGain) this.rainGain.gain.setTargetAtTime(on ? 0.17 : 0, this.ctx.currentTime, 1); }
  /** Adaptive music driver: 0 calm, ~0.5 suspicion, 1 combat. */
  setIntensity(v: number): void { this.intensity = Math.max(0, Math.min(1, v)); }

  private noise(dest: AudioNode, loop = false, rate = 1): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource(); s.buffer = this.noiseBuf; s.loop = loop; s.playbackRate.value = rate; s.connect(dest); return s;
  }

  private startAmbience(): void {
    const ctx = this.ctx!, amb = this.bus.ambience;
    const rain = ctx.createGain(); rain.gain.value = 0.17; rain.connect(amb); this.rainGain = rain;   // rain sits under everything (was too loud)
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.35; bp.connect(rain);
    this.noise(bp, true).start();
    const hiss = ctx.createBiquadFilter(); hiss.type = 'highpass'; hiss.frequency.value = 6000; const hg = ctx.createGain(); hg.gain.value = 0.07; hiss.connect(hg); hg.connect(rain);
    this.noise(hiss, true, 1.3).start();
    const wind = ctx.createGain(); wind.gain.value = 0.22; wind.connect(amb);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.connect(wind);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06; const lg = ctx.createGain(); lg.gain.value = 180; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    this.noise(lp, true, 0.6).start();
    const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 50;
    const hl = ctx.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 160; const hgn = ctx.createGain(); hgn.gain.value = 0.012;
    hum.connect(hl); hl.connect(hgn); hgn.connect(amb); hum.start();
  }

  // ---------------------------------------------------------------- adaptive music
  private startMusic(): void {
    const ctx = this.ctx!, m = this.bus.music;
    const layer = () => { const g = ctx.createGain(); g.gain.value = 0; g.connect(m); return g; };
    this.layers = { drone: layer(), tension: layer(), combat: layer() };
    // dread bed: a minor-second cluster (A1 + B♭1) and a sub, through a slowly breathing low-pass —
    // unresolved, never a melody; plus a filtered-noise "breath" that swells and sinks
    for (const [f, det, gain] of [[55, -5, 0.05], [58.27, 4, 0.04], [27.5, 0, 0.09], [82.4, -12, 0.018]] as const) {
      const o = ctx.createOscillator(); o.type = f < 30 ? 'sine' : 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 220; flt.Q.value = 3;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.03 + Math.random() * 0.03; const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(flt.frequency); lfo.start();
      const g = ctx.createGain(); g.gain.value = gain; o.connect(flt); flt.connect(g); g.connect(this.layers.drone); o.start();
    }
    const br = ctx.createBiquadFilter(); br.type = 'bandpass'; br.frequency.value = 700; br.Q.value = 9;
    const bg = ctx.createGain(); bg.gain.value = 0; br.connect(bg); bg.connect(this.layers.drone); this.noise(br, true, 0.5).start();
    const blfo = ctx.createOscillator(); blfo.frequency.value = 0.07; const bl = ctx.createGain(); bl.gain.value = 0.03; blfo.connect(bl); bl.connect(bg.gain); blfo.start();
    const sweep = ctx.createOscillator(); sweep.frequency.value = 0.021; const sw = ctx.createGain(); sw.gain.value = 420; sweep.connect(sw); sw.connect(br.frequency); sweep.start();
    // tension: high filtered noise bed (sizzle) that pulses with the beat scheduler
    const tf = ctx.createBiquadFilter(); tf.type = 'bandpass'; tf.frequency.value = 4800; tf.Q.value = 6;
    const tg = ctx.createGain(); tg.gain.value = 0.05; tf.connect(tg); tg.connect(this.layers.tension); this.noise(tf, true, 0.7).start();
    this.nextBeat = ctx.currentTime + 0.1;
  }

  /** Call every frame: crossfade layers to intensity and schedule beats ahead (lookahead scheduler). */
  update(): void {
    const ctx = this.ctx; if (!ctx || !this.layers) return;
    this.ambientEvents();
    const t = ctx.currentTime, I = this.intensity;
    this.layers.drone.gain.setTargetAtTime(0.55 + 0.25 * (1 - I), t, 1.5);
    this.layers.tension.gain.setTargetAtTime(Math.max(0, Math.min(1, (I - 0.15) * 2)) * 0.9, t, 0.8);
    this.layers.combat.gain.setTargetAtTime(I > 0.65 ? 0.9 : 0, t, I > 0.65 ? 0.4 : 2.5);
    const spb = 60 / (84 + I * 30);
    while (this.nextBeat < t + 0.15) {
      const bt = this.nextBeat, b = this.beat++ % 16;
      // tension ostinato: two high notes (E5/F5 — semitone unease)
      if (I > 0.2 && b % 4 === 2) this.note(this.layers.tension, b % 8 === 2 ? 659.3 : 698.5, bt, 0.25, 0.05, 'triangle');
      // combat: kick on 1/3, tom fills
      if (b % 4 === 0 || (b % 16 === 10)) this.kick(this.layers.combat, bt, b % 8 === 0 ? 1 : 0.6);
      if (b % 16 === 14 || b % 16 === 15) this.kick(this.layers.combat, bt, 0.45, 110);
      if (b % 2 === 1) this.hat(this.layers.combat, bt);
      // calm: sparse dissonant low notes (tritone/minor second), never a tune
      if (b % 16 === 0 && Math.random() < 0.35) this.note(this.layers.drone, [110, 155.6, 116.5, 77.8][Math.floor(Math.random() * 4)], bt, 3.5, 0.03, 'triangle');
      // heartbeat as danger rises (double thump)
      if (I > 0.4 && b % 4 === 0) { this.kick(this.layers.tension, bt, 0.35 + I * 0.3, 46); this.kick(this.layers.tension, bt + 0.16, 0.22 + I * 0.2, 42); }
      this.nextBeat += spb / 2;
    }
  }
  /** Distant life in the dark: far groans, creaking metal, a rare scream. Call every frame. */
  private nextEvent = 0;
  ambientEvents(): void {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime; if (t < this.nextEvent) return;
    this.nextEvent = t + 7 + Math.random() * 14;
    const r = Math.random(), amb = this.bus.ambience, pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8; pan.connect(amb);
    if (r < 0.5) {                      // far groan: buzzy voice falling in pitch through a throat-like band-pass
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(120 + Math.random() * 40, t); o.frequency.exponentialRampToValueAtTime(70, t + 1.8);
      f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 4; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 2);
      o.connect(f); f.connect(g); g.connect(pan); o.start(t); o.stop(t + 2.1);
    } else if (r < 0.85) {              // metal creak: slow FM squeal
      const o = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
      o.frequency.value = 300 + Math.random() * 300; m.frequency.value = 7 + Math.random() * 6; mg.gain.value = 60; m.connect(mg); mg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.018, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g); g.connect(pan); o.start(t); m.start(t); o.stop(t + 1.7); m.stop(t + 1.7);
    } else {                            // a scream, very far away
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(600, t); o.frequency.linearRampToValueAtTime(900, t + 0.4); o.frequency.exponentialRampToValueAtTime(300, t + 1.4);
      f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 3; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.02, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      o.connect(f); f.connect(g); g.connect(pan); o.start(t); o.stop(t + 1.6);
    }
  }
  /** Spotted: a dissonant hit — clustered saws and a noise burst, sharp attack, long tail. */
  stinger(): void {
    const ctx = this.ctx; if (!ctx || !this.layers) return;
    const t = ctx.currentTime, dest = this.bus.music;
    for (const f of [110, 116.5, 164.8, 233.1]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(300, t + 2.5);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      o.connect(lp); lp.connect(g); g.connect(dest); o.start(t); o.stop(t + 3);
    }
    this.kick(dest, t, 1, 40);
  }
  private note(dest: AudioNode, f: number, t: number, len: number, peak: number, type: OscillatorType): void {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + len + 0.05);
  }
  private kick(dest: AudioNode, t: number, v: number, f0 = 70): void {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f0 * 2, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + 0.18);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.4);
  }
  private hat(dest: AudioNode, t: number): void {
    const ctx = this.ctx!, f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    f.connect(g); g.connect(dest); const s = this.noise(f); s.start(t); s.stop(t + 0.07);
  }

  // ---------------------------------------------------------------- one-shot SFX
  /** Play a sound at world x (undefined = centred). Varies pitch/gain each time. */
  play(kind: Sfx, x?: number, vol = 1, bus: Bus = kind.startsWith('ui') ? 'ui' : 'sfx'): void {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    let gain = vol * dbToGain((Math.random() - 0.5) * 3), pan = 0;
    if (x !== undefined) { const dx = x - this.listenerX; pan = Math.max(-1, Math.min(1, dx / 12)); gain *= 1 / (1 + Math.max(0, Math.abs(dx) - 5) * 0.15); if (gain < 0.015) return; }
    const rate = 1 + (Math.random() - 0.5) * 0.12;
    const out = ctx.createGain(); out.gain.value = gain; const p = ctx.createStereoPanner(); p.pan.value = pan; out.connect(p); p.connect(this.bus[bus]);
    const t = ctx.currentTime;
    const env = (g: GainNode, a: number, peak: number, d: number, t0 = t) => { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); };
    const nz = (type: BiquadFilterType, f: number, q: number, peak: number, d: number, r = 1, t0 = t) => {
      const g = ctx.createGain(); env(g, 0.002, peak, d, t0); g.connect(out); const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f * rate; fl.Q.value = q; fl.connect(g);
      const s = this.noise(fl, false, r * rate); s.start(t0); s.stop(t0 + d + 0.05);
    };
    const tone = (type: OscillatorType, f0: number, f1: number, peak: number, d: number, t0 = t) => {
      const g = ctx.createGain(); env(g, 0.004, peak, d, t0); g.connect(out); const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0 * rate, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1 * rate), t0 + d); o.connect(g); o.start(t0); o.stop(t0 + d + 0.05);
    };
    switch (kind) {
      case 'rifle': nz('lowpass', 4200, 0.7, 1.2, 0.2); tone('sine', 180, 45, 0.8, 0.14); nz('bandpass', 700, 1, 0.3, 0.9, 0.5); break;
      case 'pistol': nz('lowpass', 3300, 0.7, 1.0, 0.18); tone('sine', 150, 40, 0.7, 0.12); nz('bandpass', 900, 1, 0.22, 0.7, 0.5); break;
      case 'shotgun': nz('lowpass', 2100, 0.7, 1.5, 0.42); tone('sine', 110, 30, 1, 0.24); nz('bandpass', 500, 1, 0.35, 1.2, 0.4); break;
      case 'dryfire': nz('highpass', 4200, 3, 0.25, 0.03); break;
      case 'reload': nz('highpass', 3000, 2, 0.25, 0.04); tone('square', 1700, 1400, 0.05, 0.03, t + 0.25); nz('highpass', 2500, 2, 0.2, 0.05, 1, t + 0.45); break;
      case 'melee': nz('bandpass', 1300, 2, 0.35, 0.15, 1.3); break;
      case 'hitFlesh': tone('sine', 120, 50, 0.6, 0.12); nz('lowpass', 800, 1, 0.45, 0.1); break;
      case 'hitMetal': tone('triangle', 1300, 800, 0.2, 0.3); nz('highpass', 2600, 1, 0.15, 0.08); break;
      case 'hitWood': nz('bandpass', 420, 2, 0.4, 0.1); break;
      case 'hitConcrete': nz('bandpass', 900, 1.5, 0.3, 0.07); break;
      case 'step': nz('lowpass', 520, 1, 0.12, 0.06, 1.2); break;
      case 'stepWet': nz('bandpass', 1900, 1.4, 0.12, 0.09, 1.4); nz('lowpass', 400, 1, 0.08, 0.05); break;
      case 'groan': {
        const g = ctx.createGain(); env(g, 0.18, 0.28, 1.2); g.connect(out);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 480 * rate; f.Q.value = 4; f.connect(g);
        const o = ctx.createOscillator(); o.type = 'sawtooth'; const b = (70 + Math.random() * 35) * rate; o.frequency.setValueAtTime(b, t); o.frequency.linearRampToValueAtTime(b * 0.78, t + 1.3);
        const v = ctx.createOscillator(); v.frequency.value = 5 + Math.random() * 3; const vg = ctx.createGain(); vg.gain.value = 7; v.connect(vg); vg.connect(o.frequency);
        o.connect(f); o.start(t); v.start(t); o.stop(t + 1.5); v.stop(t + 1.5); break;
      }
      case 'shriek': tone('sawtooth', 950, 380, 0.2, 0.55); nz('highpass', 3200, 1, 0.16, 0.45); break;
      case 'bruteRoar': tone('sawtooth', 90, 50, 0.45, 1.3); nz('lowpass', 500, 1, 0.4, 1.2, 0.5); break;
      case 'hurt': tone('square', 230, 110, 0.14, 0.18); break;
      case 'death': tone('sawtooth', 170, 40, 0.24, 0.8); break;
      case 'pickup': tone('triangle', 660, 990, 0.16, 0.12); break;
      case 'craft': nz('bandpass', 1500, 2, 0.2, 0.08); tone('triangle', 520, 780, 0.12, 0.16, t + 0.1); break;
      case 'search': nz('bandpass', 1100, 1.2, 0.12, 0.2, 0.8); break;
      case 'heal': tone('sine', 440, 660, 0.12, 0.3); break;
      case 'throw': nz('bandpass', 900, 2, 0.15, 0.2, 1.6); break;
      case 'glassBreak': for (let i = 0; i < 5; i++) tone('triangle', 2400 + Math.random() * 2600, 1500, 0.12, 0.25, t + i * 0.02); nz('highpass', 4000, 1, 0.4, 0.3); break;
      case 'uiMove': nz('highpass', 2400, 2, 0.12, 0.025); break;
      case 'uiSelect': tone('triangle', 880, 1320, 0.1, 0.08); break;
      case 'uiBack': tone('triangle', 660, 440, 0.1, 0.08); break;
      case 'alert': tone('square', 520, 520, 0.07, 0.12); tone('square', 390, 390, 0.07, 0.12, t + 0.14); break;
      case 'radioStatic': nz('bandpass', 1700, 3, 0.25, 0.5); tone('sine', 1250, 1210, 0.04, 0.5); break;
      case 'thunder': { const g = ctx.createGain(); env(g, 0.08, 0.9, 3.4); g.connect(out); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 170; f.connect(g); const n = this.noise(f, false, 0.35); n.start(t); n.stop(t + 3.6); tone('sine', 52, 30, 0.45, 2.2); break; }
      case 'door': tone('sawtooth', 140, 90, 0.08, 0.5); nz('lowpass', 400, 1, 0.2, 0.3); break;
      case 'casing': tone('triangle', 3200 + Math.random() * 800, 2800, 0.05, 0.08, t + 0.25); break;
    }
  }
}

export const audio = new AudioEngine();
