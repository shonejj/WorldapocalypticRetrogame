/** Tiny DOM helper: h('div.cls#id', {attrs}, ...children). */
export function h<K extends keyof HTMLElementTagNameMap = 'div'>(sel: string, attrs: Record<string, unknown> = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const [tagPart, ...rest] = sel.split('.');
  const [tag, id] = tagPart.split('#');
  const el = document.createElement(tag || 'div') as HTMLElementTagNameMap[K];
  if (id) el.id = id;
  if (rest.length) el.className = rest.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'style' && typeof v === 'string') el.setAttribute('style', v);
    else if (v !== undefined && v !== null && v !== false) (el as unknown as Record<string, unknown>)[k] = v;
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
