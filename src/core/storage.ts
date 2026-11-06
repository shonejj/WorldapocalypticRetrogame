import { SAVE_NAMESPACE } from '../config/game';

/** localStorage wrapper that never throws (private mode, quota, disabled storage). */
export const store = {
  get<T>(key: string, fallback: T): T {
    try { const v = localStorage.getItem(`${SAVE_NAMESPACE}:${key}`); return v ? { ...fallback, ...JSON.parse(v) } as T : fallback; }
    catch { return fallback; }
  },
  set(key: string, value: unknown): void {
    try { localStorage.setItem(`${SAVE_NAMESPACE}:${key}`, JSON.stringify(value)); } catch { /* ignore */ }
  },
  remove(key: string): void { try { localStorage.removeItem(`${SAVE_NAMESPACE}:${key}`); } catch { /* ignore */ } },
};

export interface Settings {
  masterVolume: number;   // 0..1
  sfxVolume: number;
  ambienceVolume: number;
  renderScale: number;    // 0.5..1 (internal resolution; pixel art upscales crisply)
  rain: boolean;
  screenShake: boolean;
  showFps: boolean;
  touchControls: 'auto' | 'on' | 'off';
}

export const defaultSettings: Settings = {
  masterVolume: 0.8, sfxVolume: 0.9, ambienceVolume: 0.7, renderScale: 1,
  rain: true, screenShake: true, showFps: false, touchControls: 'auto',
};

export const loadSettings = (): Settings => store.get('settings', defaultSettings);
export const saveSettings = (s: Settings) => store.set('settings', s);
