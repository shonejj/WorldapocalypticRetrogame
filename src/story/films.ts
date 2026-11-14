/**
 * In-engine openings: the chapter intros are shot with the game's own camera over the real level —
 * rain, fog, the infected going about their business, the squad walking in — with a few lines of
 * large captions per shot. They replace the painted storyboards for chapter starts.
 *
 * x/to: camera focus pans from x to `to` over `dur` seconds. zoom < 1 is closer; lift raises the
 * camera; mode blends to the isometric or flat long-lens view. `walk` makes the squad walk right.
 */
export interface Shot { x: number; to?: number; y?: number; zoom: number; lift?: number; mode?: 'iso' | 'flat'; dur: number; lines?: string[]; title?: [string, string]; walk?: boolean; radio?: boolean }

export const FILMS: Record<string, Shot[]> = {
  prologue: [
    { x: 150, to: 128, zoom: 1.7, lift: 3.2, dur: 7, lines: ['It began with something too small to see.', 'Genova Labs called it a therapy. Batch seven went out to every pharmacy in the district on a Tuesday.'] },
    { x: 96, to: 84, zoom: 0.8, lift: 0.2, mode: 'flat', dur: 7, lines: ['By Friday the hospitals were full.', 'In eleven days the city went quiet.'] },
    { x: 70, to: 76, zoom: 0.62, lift: -0.2, dur: 7, lines: ['The ones it took did not die.', 'They stand where they fell, and they listen.'] },
    { x: 140, to: 146, zoom: 1.0, lift: 2.4, mode: 'iso', dur: 7, radio: true, lines: ['Then, on a dead band, a voice.', '"Protocol Lighthouse. Resistant carriers, report to the coordinates. This message repeats."'] },
    { x: -14, to: -6, zoom: 0.7, lift: 0.1, dur: 8, walk: true, lines: ['Four of us heard it.', 'A driver, a nurse, a mechanic and a girl with a radio. None of us had a better idea.'] },
    { x: -6, zoom: 1.0, dur: 3.5, title: ['CHAPTER ONE', 'MARKET STREET'] },
  ],
  road: [
    { x: 30, to: 14, zoom: 1.5, lift: 2.2, dur: 7, lines: ['At first light the fog came down off the hills and did not lift.'] },
    { x: -8, to: 0, zoom: 0.8, mode: 'flat', dur: 7, walk: true, lines: ['They cannot see in it. Neither can we.'] },
    { x: 0, zoom: 1.0, dur: 3.5, title: ['CHAPTER TWO', 'THE LONG ROAD'] },
  ],
  facility: [
    { x: 80, to: 70, zoom: 1.6, lift: 3, dur: 7, radio: true, lines: ['The mast stood over everything. The voice no longer needed a radio.', '"...if you can hear this, you are not alone..."'] },
    { x: -8, to: 0, zoom: 0.75, mode: 'flat', dur: 6, walk: true },
    { x: 0, zoom: 1.0, dur: 3.5, title: ['CHAPTER THREE', 'GENOVA LABS'] },
  ],
};
