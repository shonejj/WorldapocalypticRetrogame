/** h('tag.class#id', attrs, ...children) — tiny DOM builder. Selector form: tag first, then .classes/#id. */
export function h<K extends keyof HTMLElementTagNameMap = 'div'>(sel: string, attrs: Record<string, unknown> = {}, ...kids: (Node | string | null | false | undefined)[]): HTMLElementTagNameMap[K] {
  const m = /^([a-z0-9]*)/.exec(sel)!, tag = m[1] || 'div';
  const el = document.createElement(tag) as HTMLElementTagNameMap[K];
  for (const part of sel.slice(m[1].length).match(/[.#][^.#]+/g) ?? []) { if (part[0] === '#') el.id = part.slice(1); else el.classList.add(part.slice(1)); }
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'style' && typeof v === 'string') el.setAttribute('style', v);
    else if (k.startsWith('data-') || k.startsWith('aria-')) el.setAttribute(k, String(v));
    else if (v !== undefined && v !== null && v !== false) (el as unknown as Record<string, unknown>)[k] = v;
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
