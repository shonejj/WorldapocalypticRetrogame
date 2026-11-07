import { readPrefs, writePrefs } from '../core/storage';

export interface Settings {
  master: number; music: number; sfx: number; ambience: number; voice: number;
  quality: 'high' | 'medium' | 'low'; pixel: 0 | 2 | 3 | 4; shake: number; rain: boolean;
  nameTags: boolean; touch: 'auto' | 'on' | 'off'; showFps: boolean; autoQuality: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  master: 0.85, music: 0.6, sfx: 0.9, ambience: 0.75, voice: 0.9,
  quality: 'high', pixel: 0, shake: 1, rain: true, nameTags: true, touch: 'auto', showFps: false, autoQuality: true,
};
export const loadSettings = () => readPrefs<Settings>('settings', DEFAULT_SETTINGS);
export const saveSettings = (s: Settings) => writePrefs('settings', s);
