import type { Plugin } from 'vite';
import { Compiler } from 'inkjs/compiler/Compiler';

/**
 * Compile Ink (.ink) narrative scripts at build time so only the small inkjs runtime
 * ships. `import story from './chapter1.ink'` yields the compiled story JSON string.
 */
export function ink(): Plugin {
  return {
    name: 'tlf-ink',
    transform(src, id) {
      if (!id.endsWith('.ink')) return null;
      const c = new Compiler(src);
      try {
        const json = c.Compile().ToJson();
        return { code: `export default ${JSON.stringify(json)};`, map: null };
      } catch {
        this.error(`Ink compile failed for ${id}:\n${c.errors.join('\n')}`);
      }
    },
  };
}
