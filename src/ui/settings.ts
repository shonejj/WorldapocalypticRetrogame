import { readPrefs, writePrefs } from '../core/storage';

export interface Settings {
  master: number; music: number; sfx: number; ambience: number; voice: number;
  quality: 'high' | 'medium' | 'low'; pixel: number; shake: number; rain: boolean;
  nameTags: boolean; touch: 'auto' | 'on' | 'off'; showFps: boolean; autoQuality: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  master: 0.85, music: 0.6, sfx: 0.9, ambience: 0.75, voice: 0.9,
  quality: 'high', pixel: -1, shake: 1, rain: true, nameTags: false, touch: 'auto', showFps: false, autoQuality: true,
};
/** v2 (visual overhaul): pixel-art auto filter and clean screen (no name tags) become the defaults. */
const SETTINGS_VERSION = 2;
export const loadSettings = (): Settings => {
  const s = readPrefs<Settings & { v?: number }>('settings', DEFAULT_SETTINGS);
  if ((s.v ?? 1) < SETTINGS_VERSION) { s.pixel = DEFAULT_SETTINGS.pixel; s.nameTags = false; s.v = SETTINGS_VERSION; writePrefs('settings', s); }
  return s;
};
export const saveSettings = (s: Settings) => writePrefs('settings', { ...s, v: SETTINGS_VERSION });
