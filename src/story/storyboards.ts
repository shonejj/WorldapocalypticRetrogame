import type { PanelId } from '../art/panels';

/**
 * Storyboards: the game's cutscenes. Each is a run of illustrated panels (art/panels.ts) with
 * captions; `title` turns a panel into a chapter card. Played before/after levels (LevelDef.intro /
 * .outro) — `ending` is resolved to one of the three endings by the story state.
 */
export interface Shot { panel: PanelId; text?: string[]; title?: [string, string]; radio?: boolean }
export const STORYBOARDS: Record<string, Shot[]> = {
  prologue: [
    { panel: 'lab_night', text: ['It began with something too small to see.', 'Genova Labs called it a therapy. Batch seven went out to every pharmacy in the district on a Tuesday.'] },
    { panel: 'city_fall', text: ['By Friday the hospitals were full.', 'In eleven days the city went quiet.'] },
    { panel: 'hosts', text: ['The ones it took did not die.', 'They stand where they fell, and they listen.'] },
    { panel: 'radio_room', radio: true, text: ['Then, on a dead band, a voice.', '"Protocol Lighthouse. Resistant carriers, report to the coordinates. This message repeats."'] },
    { panel: 'four_walk', text: ['Four of us heard it.', 'A driver, a nurse, a mechanic and a girl with a radio. None of us had a better idea.'] },
    { panel: 'four_walk', title: ['CHAPTER ONE', 'MARKET STREET'] },
  ],
  relay: [
    { panel: 'relay', radio: true, text: ['Relay 7 woke up, and the voice came through clean for the first time.', 'North-east. Past the quarantine line. A place called Genova.'] },
    { panel: 'safehouse', text: ['The relay keeper had lived in the flat above the shed.', 'He left candles, books, and a door that locked.'] },
  ],
  road: [
    { panel: 'road', text: ['At first light the fog came down off the hills and did not lift.', 'They cannot see in it. Neither can we.'] },
    { panel: 'road', title: ['CHAPTER TWO', 'THE LONG ROAD'] },
  ],
  gate: [
    { panel: 'gate', text: ['The gate had been built to keep the sick in.', 'It opened for a jerrycan and a dead man\'s keys.'] },
    { panel: 'safehouse', text: ['Past the line there was a barracks, a stove, and plants somebody had kept alive in a window.', 'One more night.'] },
  ],
  facility: [
    { panel: 'facility', radio: true, text: ['The mast stood over everything. The voice no longer needed a radio.', '"...if you can hear this, you are not alone..."'] },
    { panel: 'facility', title: ['CHAPTER THREE', 'GENOVA LABS'] },
  ],
  ending1: [
    { panel: 'end_cost', text: ['Reed lay down on the table at dusk. Maya did the draw herself, and wrote one more name.', 'The serum took. By winter there were forty doses, then four hundred.'] },
    { panel: 'end_true', text: ['Three of us walked out with the girl.', 'Every night at nine she reads a new message. It starts with his name.'] },
    { panel: 'end_true', title: ['THE COST', 'ENDING 1 OF 3'] },
  ],
  ending2: [
    { panel: 'end_silence', text: ['Miller cut the feed line. The mast went dark for the first time in four hundred days.', 'Nobody else would follow that voice to that table.'] },
    { panel: 'four_walk', text: ['We took the girl and walked north. Five of us now.', 'There is no cure. There is us, and the road, and the quiet.'] },
    { panel: 'four_walk', title: ['SILENCE', 'ENDING 2 OF 3'] },
  ],
  ending3: [
    { panel: 'end_cost', text: ['Two carriers. Half the draw each, twelve hours apart. Maya did not sleep.', 'In the morning both of them were complaining about the coffee.'] },
    { panel: 'end_true', radio: true, text: ['The serum took. Wren read the last message herself, and Iris held the microphone.', '"This is Genova. There is a cure, and it is coming to you. This is the last time this frequency will ask you to wait."'] },
    { panel: 'end_true', text: ['Miller left the next morning in an ambulance with the first forty doses.', 'He said he knew a driver at Lighthouse Point.'] },
    { panel: 'end_true', title: ['THE LAST FREQUENCY', 'TRUE ENDING'] },
  ],
};
