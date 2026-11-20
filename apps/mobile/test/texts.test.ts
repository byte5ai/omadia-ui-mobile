import { describe, expect, it } from 'vitest';
import { agentTexts } from '../src/agents/texts';

describe('agentTexts', () => {
  it('has both languages with the same surface', () => {
    const de = agentTexts('de');
    const en = agentTexts('en');
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
    expect(de.systemNotice).toBe('Systemhinweis');
    expect(en.systemNotice).toBe('System notice');
  });

  it('names the agent in the placeholder and asks for a choice without one', () => {
    expect(agentTexts('de').composerPlaceholder('Mira')).toBe('Frag Mira …');
    expect(agentTexts('de').composerPlaceholder(undefined)).toBe('Wähle zuerst einen Agenten');
    expect(agentTexts('en').answerFrom('Mira')).toBe('Answer from Mira');
  });

  it('never says "Orchestrator" to the user (terminology)', () => {
    for (const locale of ['de', 'en'] as const) {
      const t = agentTexts(locale);
      const all = [
        t.pickerTitle, t.pickerLoading, t.pickerEmpty, t.pickerLocked('X'), t.answerFrom('X'),
        t.systemNotice, t.dismiss, t.composerPlaceholder('X'), t.composerPlaceholder(undefined), t.noAgentNotice,
      ].join(' ');
      expect(all.toLowerCase()).not.toContain('orchestrator');
    }
  });
});
