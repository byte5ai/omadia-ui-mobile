import { describe, expect, it } from 'vitest';
import {
  chooseAgent,
  decideSend,
  lockAgent,
  parseAgentChoices,
  registryAgentsOf,
  resolveAgent,
} from '../src/agents/agentChoice';
import type { AgentDirectoryEntry } from '../src/agents/protocol';

const MIRA: AgentDirectoryEntry = { id: 'a1', slug: 'mira', displayName: 'Mira' };
const BEN: AgentDirectoryEntry = { id: 'a2', slug: 'ben', displayName: 'Ben' };

describe('resolveAgent', () => {
  it('preselects the default agent the directory names', () => {
    expect(resolveAgent({}, {}, 'c1', [MIRA, BEN], 'ben')).toEqual({
      agentId: 'a2',
      locked: false,
      preselected: true,
    });
  });

  it('preselects the only agent there is', () => {
    expect(resolveAgent({}, {}, 'c1', [MIRA], null).agentId).toBe('a1');
  });

  it('never picks among several: no default, no agent', () => {
    expect(resolveAgent({}, {}, 'c1', [MIRA, BEN], null)).toEqual({
      agentId: undefined,
      locked: false,
      preselected: false,
    });
    expect(resolveAgent({}, {}, 'c1', [], null).agentId).toBeUndefined();
  });

  it('the user choice beats the preselection and the registry', () => {
    const choices = { c1: { agentId: 'a2', locked: false } };
    expect(resolveAgent(choices, { c1: 'a1' }, 'c1', [MIRA, BEN], 'mira')).toEqual({
      agentId: 'a2',
      locked: false,
      preselected: false,
    });
  });

  it('adopts the agent the registry fixed for the canvas', () => {
    expect(resolveAgent({}, { c1: 'a1' }, 'c1', [MIRA, BEN], 'ben')).toEqual({
      agentId: 'a1',
      locked: true,
      preselected: false,
    });
  });

  it('keeps a locked agent even when the directory no longer lists it', () => {
    const choices = { c1: { agentId: 'gone', locked: true } };
    expect(resolveAgent(choices, {}, 'c1', [MIRA], null).agentId).toBe('gone');
  });

  it('choices are per canvas', () => {
    const choices = { c1: { agentId: 'a2', locked: true } };
    expect(resolveAgent(choices, {}, 'c2', [MIRA, BEN], 'mira').agentId).toBe('a1');
  });
});

describe('chooseAgent / lockAgent', () => {
  it('choosing does not mutate and can be changed until the first turn', () => {
    const empty = {};
    const first = chooseAgent(empty, 'c1', 'a1');
    expect(empty).toEqual({});
    expect(chooseAgent(first, 'c1', 'a2')).toEqual({ c1: { agentId: 'a2', locked: false } });
  });

  it('is fixed once locked: a later choice or lock is ignored', () => {
    const locked = lockAgent({}, 'c1', 'a1');
    expect(locked).toEqual({ c1: { agentId: 'a1', locked: true } });
    expect(chooseAgent(locked, 'c1', 'a2')).toBe(locked);
    expect(lockAgent(locked, 'c1', 'a2')).toBe(locked);
  });
});

describe('persistence shape', () => {
  it('narrows untrusted JSON to complete choices', () => {
    expect(
      parseAgentChoices({
        c1: { agentId: 'a1', locked: true },
        c2: { agentId: 'a2' },
        c3: { agentId: '' },
        c4: 'x',
        c5: null,
      }),
    ).toEqual({ c1: { agentId: 'a1', locked: true }, c2: { agentId: 'a2', locked: false } });
    expect(parseAgentChoices(null)).toEqual({});
    expect(parseAgentChoices([1])).toEqual({});
  });

  it('reads the agent per canvas from the registry entries', () => {
    expect(
      registryAgentsOf([
        { sessionId: 'c1', agentId: 'a1' },
        { sessionId: 'c2' },
        { sessionId: 'c3', agentId: '' },
        { sessionId: 'c4', agentId: 7 },
      ]),
    ).toEqual({ c1: 'a1' });
  });
});

describe('decideSend', () => {
  it('sends with the agent of the canvas', () => {
    expect(decideSend(true, 'a1')).toEqual({ send: true, agentId: 'a1' });
  });

  it('sends nothing without an agent — the server would refuse, the client does not guess', () => {
    expect(decideSend(true, undefined)).toEqual({ send: false, reason: 'no_agent' });
    expect(decideSend(null, undefined)).toEqual({ send: false, reason: 'no_agent' });
  });

  it('a server that does not speak agents takes turns without one, and gets no agentId', () => {
    expect(decideSend(false, undefined)).toEqual({ send: true, agentId: undefined });
    expect(decideSend(false, 'a1')).toEqual({ send: true, agentId: undefined });
  });
});
