import { Painter, hex, shade } from '../painter';
import type { ItemId } from '../../game/data';

/** Small world pickups (ammo boxes, medkits, cans, bottles). Cached per item. */
const cache = new Map<ItemId, Painter>();
export function ITEM_PICKUP_TEX(item: ItemId): Painter {
  let p = cache.get(item);
  if (p) return p;
  p = new Painter(23, 19, item.length * 13);
  const box = (c: string, label?: string, lc = '#e8e0c0') => {
    p!.texRect(2, 6, 19, 13, hex(c), 0.08, 0.3); p!.rect(2, 6, 19, 2, shade(hex(c), 1.25));
    if (label) p!.rect(5, 10, 13, 4, hex(lc));
  };
  switch (item) {
    case 'ammo_pistol': box('#4a5a3a', 'x', '#c9a227'); break;
    case 'ammo_shells': box('#7a2a22', 'x', '#d8c890'); break;
    case 'ammo_rifle': box('#3a4a5a', 'x', '#c9a227'); break;
    case 'medkit': case 'bandage': box(item === 'medkit' ? '#d8d4c8' : '#c8b8a0'); p.rect(9, 8, 5, 9, hex('#b0302a')); p.rect(7, 10, 9, 5, hex('#b0302a')); break;
    case 'food': p.texRect(6, 5, 11, 14, hex('#9aa0a0'), 0.06, 0.4); p.rect(6, 9, 11, 6, hex('#b8742a')); break;
    case 'water': p.texRect(8, 2, 7, 17, hex('#6aa0c0'), 0.06, 0.4); p.rect(9, 0, 5, 3, hex('#2a5a8a')); p.rect(8, 8, 7, 4, hex('#d8e8f0')); break;
    case 'battery': p.texRect(5, 7, 13, 10, hex('#2a2a2a'), 0.06, 0.3); p.rect(5, 7, 5, 10, hex('#c9a227')); break;
    default: box('#5a5a52'); break;
  }
  p.outline(0.5); p.rimLight(0, -1, 1.4);
  cache.set(item, p);
  return p;
}
