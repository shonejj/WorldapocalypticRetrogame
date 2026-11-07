import { Story } from 'inkjs';

/**
 * Ink dialogue runner (dialogue-systems): story compiled at build time; knots are played on
 * beat triggers; lines are "SPEAKER: text"; choices go to the UI; variables persist in saves.
 */
export interface Line { speaker: string; text: string }
export interface DialogueStep { lines: Line[]; choices: string[] }

export class Dialogue {
  private story: Story;
  constructor(json: string) { this.story = new Story(json); }
  /** Jump to a knot and collect lines up to the first choice (or the end). */
  start(knot: string): DialogueStep { this.story.ChoosePathString(knot); return this.collect(); }
  choose(i: number): DialogueStep { this.story.ChooseChoiceIndex(i); return this.collect(); }
  private collect(): DialogueStep {
    const lines: Line[] = [];
    while (this.story.canContinue) {
      const raw = (this.story.Continue() ?? '').trim();
      if (!raw) continue;
      const m = /^([A-Z][A-Z0-9 ]{1,15}):\s*(.*)$/.exec(raw);
      lines.push(m ? { speaker: m[1], text: m[2] } : { speaker: '', text: raw });
    }
    return { lines, choices: this.story.currentChoices.map((c) => c.text) };
  }
  set(name: string, v: boolean | number): void { this.story.variablesState.$(name, v); }
  get(name: string): unknown { return this.story.variablesState.$(name); }
  save(): string { return this.story.state.toJson(); }
  load(json: string | null): void { if (json) try { this.story.state.LoadJson(json); } catch { /* ignore corrupt */ } }
}
