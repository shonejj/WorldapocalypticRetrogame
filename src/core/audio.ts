/**
 * Fully procedural audio (Web Audio API) — no files, works offline.
 * Sounds are positional along X: stereo pan + distance attenuation relative to
 * the listener (camera centre), so audio doubles as a threat cue.
 */
export type Sfx = 'gunshot' | 'shotgun' | 'rifle' | 'melee' | 'hit' | 'step' | 'stepWet' | 'groan' | 'screech'
  | 'pickup' | 'reload' | 'empty' | 'hurt' | 'death' | 'impactMetal' | 'impactWood' | 'heal' | 'ui' | 'alert' | 'radio';

export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private noiseBuf!: AudioBuffer;
  private rainGain: GainNode | null = null;
  listenerX = 0;
  volumes = { master: 0.8, sfx: 0.9, ambience: 0.7 };

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.connect(comp);
    this.amb = ctx.createGain(); this.amb.connect(comp);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.startAmbience();
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.sfx.gain.value = this.volumes.sfx;
    this.amb.gain.value = this.volumes.ambience;
  }

  setRain(on: boolean): void {
    if (this.rainGain && this.ctx) this.rainGain.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.8);
  }

  private noise(dest: AudioNode, loop = false): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = loop;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    s.connect(dest);
    return s;
  }

  private startAmbience(): void {
    const ctx = this.ctx!;
    // Rain: band-passed noise + high hiss
    const rain = ctx.createGain(); rain.gain.value = 0.22; rain.connect(this.amb); this.rainGain = rain;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.4; bp.connect(rain);
    this.noise(bp, true).start();
    // Wind: low noise with slow LFO on filter
    const wind = ctx.createGain(); wind.gain.value = 0.12; wind.connect(this.amb);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.connect(wind);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 220; lfo.connect(lfoGain); lfoGain.connect(lp.frequency); lfo.start();
    this.noise(lp, true).start();
    // Electrical hum from dead city infrastructure (very quiet)
    const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 50;
    const hg = ctx.createGain(); hg.gain.value = 0.006; const hlp = ctx.createBiquadFilter(); hlp.type = 'lowpass'; hlp.frequency.value = 200;
    hum.connect(hlp); hlp.connect(hg); hg.connect(this.amb); hum.start();
  }

  /** Play a sound at world x (undefined = UI / non-positional). */
  play(kind: Sfx, x?: number, volume = 1): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    let gainVal = volume, pan = 0;
    if (x !== undefined) {
      const dx = x - this.listenerX;
      pan = Math.max(-1, Math.min(1, dx / 14));
      gainVal *= 1 / (1 + Math.max(0, Math.abs(dx) - 4) * 0.12);
      if (gainVal < 0.02) return;
    }
    const out = ctx.createGain(); out.gain.value = gainVal;
    const panner = ctx.createStereoPanner(); panner.pan.value = pan;
    out.connect(panner); panner.connect(this.sfx);
    const t = ctx.currentTime;
    const env = (g: GainNode, a: number, peak: number, decay: number, t0 = t) => {
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + decay);
    };
    const noiseHit = (type: BiquadFilterType, freq: number, q: number, peak: number, decay: number, rate = 1) => {
      const g = ctx.createGain(); env(g, 0.002, peak, decay); g.connect(out);
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; f.connect(g);
      const s = this.noise(f); s.playbackRate.value = rate; s.start(t); s.stop(t + decay + 0.05);
    };
    const tone = (type: OscillatorType, f0: number, f1: number, peak: number, decay: number, delay = 0) => {
      const t0 = t + delay;
      const g = ctx.createGain(); env(g, 0.004, peak, decay, t0); g.connect(out);
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + decay);
      o.connect(g); o.start(t0); o.stop(t0 + decay + 0.05);
    };
    switch (kind) {
      case 'gunshot': noiseHit('lowpass', 3200, 0.7, 1.2, 0.28); tone('sine', 160, 40, 0.9, 0.18); noiseHit('bandpass', 900, 1, 0.25, 0.9, 0.5); break;
      case 'shotgun': noiseHit('lowpass', 2200, 0.7, 1.5, 0.45); tone('sine', 110, 30, 1.1, 0.25); noiseHit('bandpass', 600, 1, 0.35, 1.2, 0.4); break;
      case 'rifle': noiseHit('lowpass', 4200, 0.7, 1.1, 0.2); tone('sine', 190, 50, 0.7, 0.12); break;
      case 'melee': noiseHit('bandpass', 1400, 2, 0.35, 0.16, 1.4); break;
      case 'hit': tone('sine', 120, 50, 0.7, 0.12); noiseHit('lowpass', 700, 1, 0.5, 0.1); break;
      case 'step': noiseHit('lowpass', 500, 1, 0.12, 0.06, 1.2); break;
      case 'stepWet': noiseHit('bandpass', 1800, 1.5, 0.12, 0.09, 1.5); noiseHit('lowpass', 400, 1, 0.08, 0.05); break;
      case 'groan': {
        const g = ctx.createGain(); env(g, 0.15, 0.25, 1.1); g.connect(out);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 4; f.connect(g);
        const o = ctx.createOscillator(); o.type = 'sawtooth'; const base = 70 + Math.random() * 40;
        o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * 0.8, t + 1.2);
        const vib = ctx.createOscillator(); vib.frequency.value = 5 + Math.random() * 3; const vg = ctx.createGain(); vg.gain.value = 6; vib.connect(vg); vg.connect(o.frequency);
        o.connect(f); o.start(t); vib.start(t); o.stop(t + 1.4); vib.stop(t + 1.4); break;
      }
      case 'screech': tone('sawtooth', 900, 400, 0.18, 0.5); noiseHit('highpass', 3000, 1, 0.15, 0.4); break;
      case 'pickup': tone('triangle', 660, 990, 0.18, 0.12); break;
      case 'reload': noiseHit('highpass', 3000, 2, 0.25, 0.04); tone('square', 1800, 1500, 0.06, 0.03, 0.22); break;
      case 'empty': noiseHit('highpass', 4000, 3, 0.25, 0.03); break;
      case 'hurt': tone('square', 220, 110, 0.15, 0.18); break;
      case 'death': tone('sawtooth', 160, 40, 0.25, 0.7); break;
      case 'impactMetal': tone('triangle', 1100 + Math.random() * 600, 700, 0.18, 0.25); noiseHit('highpass', 2500, 1, 0.15, 0.08); break;
      case 'impactWood': noiseHit('bandpass', 420, 2, 0.4, 0.09); break;
      case 'heal': tone('sine', 440, 660, 0.12, 0.3); break;
      case 'ui': noiseHit('highpass', 2200, 2, 0.15, 0.03); break;
      case 'alert': tone('square', 520, 520, 0.08, 0.12); tone('square', 390, 390, 0.08, 0.12, 0.14); break;
      case 'radio': noiseHit('bandpass', 1600, 3, 0.2, 0.6); tone('sine', 1200, 1180, 0.05, 0.6); break;
    }
  }
}

export const audio = new Audio();
