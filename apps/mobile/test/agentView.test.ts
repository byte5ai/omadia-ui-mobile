import { describe, expect, it } from 'vitest';
import { applyServerMessage, initialCanvasState, type ServerMessage } from '@omadia/canvas-core';
import {
  coreMessage,
  initialAgentView,
  reduceAgentView,
  type AgentView,
  type AgentViewEvent,
} from '../src/agents/agentView';

const MIRA = { kind: 'agent', agentId: 'a1', slug: 'mira', displayName: 'Mira Schneider' } as const;
const msg = (m: Record<string, unknown>): AgentViewEvent => ({
  kind: 'message',
  message: m as unknown as ServerMessage,
});
const run = (events: AgentViewEvent[], from: AgentView = initialAgentView): AgentView =>
  events.reduce(reduceAgentView, from);

describe('server features', () => {
  it('knows whether the server speaks the agent protocol', () => {
    expect(initialAgentView.serverSupportsAgents).toBeNull();
    expect(run([{ kind: 'server_features', features: ['agents'] }]).serverSupportsAgents).toBe(true);
    expect(run([{ kind: 'server_features', features: [] }]).serverSupportsAgents).toBe(false);
  });
});

describe('agents frame', () => {
  it('reads the directory and the default agent (channel form)', () => {
    const v = run([
      {
        kind: 'agents',
        frame: {
          type: 'agents',
          agents: [
            { id: 'a1', slug: 'mira', displayName: 'Mira', avatarUrl: '/a.png' },
            { id: 'a2', slug: 'ben', displayName: 'Ben' },
          ],
          defaultAgent: { slug: 'ben' },
        },
      },
    ]);
    expect(v.agentsLoaded).toBe(true);
    expect(v.agents.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(v.defaultSlug).toBe('ben');
  });

  it('an empty list is loaded, not loading', () => {
    const v = run([{ kind: 'agents', frame: { type: 'agents', agents: [] } }]);
    expect(v).toMatchObject({ agents: [], agentsLoaded: true, defaultSlug: null });
  });

  it('a new connection asks again: the directory is unknown until it arrives', () => {
    const loaded = run([{ kind: 'agents', frame: { type: 'agents', agents: [] } }]);
    expect(reduceAgentView(loaded, { kind: 'connection_reset' })).toEqual(initialAgentView);
  });
});

describe('speaker', () => {
  it('takes the speaker the server stamped on a delta, a completion and a surface event', () => {
    expect(run([msg({ type: 'agent_text_delta', forTurn: 't', text: 'x', speaker: MIRA })]).speaker).toEqual(MIRA);
    expect(run([msg({ type: 'turn_complete', forTurn: 't', speaker: MIRA })]).speaker).toEqual(MIRA);
    expect(
      run([msg({ type: 'surface_snapshot', canvasSessionId: 'c', surfaceSeq: 0, speaker: MIRA })]).speaker,
    ).toEqual(MIRA);
  });

  it('never invents one: no stamp, no speaker; a malformed stamp is ignored', () => {
    expect(run([msg({ type: 'agent_text_delta', forTurn: 't', text: 'x' })]).speaker).toBeNull();
    expect(run([msg({ type: 'turn_complete', forTurn: 't', speaker: { kind: 'bot' } })]).speaker).toBeNull();
  });

  it('keeps the last known speaker when a later frame carries none', () => {
    const v = run([
      msg({ type: 'agent_text_delta', forTurn: 't', text: 'x', speaker: MIRA }),
      msg({ type: 'turn_complete', forTurn: 't' }),
    ]);
    expect(v.speaker).toEqual(MIRA);
  });

  it('a switch of canvas forgets the speaker and the notice', () => {
    const v = run([
      msg({ type: 'turn_complete', forTurn: 't', speaker: MIRA }),
      { kind: 'notice', notice: { code: 'no_agent', text: 'x' } },
      { kind: 'canvas_switched' },
    ]);
    expect(v).toMatchObject({ speaker: null, systemNotice: null });
  });
});

describe('system notices', () => {
  it('a refused turn is a notice naming the agent', () => {
    const v = run([
      msg({
        type: 'turn_error',
        forTurn: 't',
        message: 'agent_not_available',
        speaker: { kind: 'system' },
        code: 'agent_not_available',
        systemNotice: {
          code: 'agent_not_available',
          text: 'Mira steht dir hier nicht zur Verfügung.',
          locale: 'de',
          agent: { slug: 'mira', displayName: 'Mira' },
        },
      }),
    ]);
    expect(v.systemNotice).toEqual({
      code: 'agent_not_available',
      text: 'Mira steht dir hier nicht zur Verfügung.',
      agentName: 'Mira',
    });
  });

  it('an unknown code still renders through its text', () => {
    const v = run([
      msg({ type: 'turn_error', message: 'm', systemNotice: { code: 'future_code', text: 'Hallo' } }),
    ]);
    expect(v.systemNotice).toEqual({ code: 'future_code', text: 'Hallo' });
  });

  it('system-speaker text accumulates into the notice, never into the agent speaker', () => {
    const sys = { kind: 'system' };
    const v = run([
      msg({ type: 'agent_text_delta', forTurn: 't', text: 'Du hast ', speaker: sys }),
      msg({ type: 'agent_text_delta', forTurn: 't', text: 'Mira gewählt.', speaker: sys }),
    ]);
    expect(v.systemNotice?.text).toBe('Du hast Mira gewählt.');
    expect(v.speaker).toBeNull();
  });

  it('a new turn clears the notice; a dismiss clears it; a local notice sets it', () => {
    const base = run([{ kind: 'notice', notice: { code: 'no_agent', text: 'Wähle zuerst.' } }]);
    expect(base.systemNotice?.code).toBe('no_agent');
    expect(reduceAgentView(base, { kind: 'turn_started' }).systemNotice).toBeNull();
    expect(reduceAgentView(base, { kind: 'notice', notice: null }).systemNotice).toBeNull();
  });
});

describe('coreMessage — what canvas-core may see', () => {
  const snapshot = {
    type: 'surface_snapshot',
    canvasSessionId: 'c',
    surfaceSeq: 0,
    producesRevision: '0',
    tree: { type: 'container', id: 'root', children: [{ type: 'status', id: 's', text: 'hi' }] },
    protocolVersion: '1.0',
    opsCatalogVersion: '1.0',
  };

  it('strips the speaker stamp from a surface event: canvas-core rejects it otherwise', () => {
    const stamped = { ...snapshot, speaker: MIRA } as unknown as ServerMessage;
    expect(applyServerMessage(initialCanvasState, stamped).state.tree).toBeNull();
    const core = coreMessage(stamped);
    expect(core).not.toBeNull();
    expect(core).not.toHaveProperty('speaker');
    expect(applyServerMessage(initialCanvasState, core as ServerMessage).state.tree).not.toBeNull();
  });

  it('keeps an unstamped event and an agent delta as they are', () => {
    const plain = snapshot as unknown as ServerMessage;
    expect(coreMessage(plain)).toBe(plain);
    const delta = { type: 'agent_text_delta', forTurn: 't', text: 'x', speaker: MIRA } as unknown as ServerMessage;
    expect(coreMessage(delta)).toBe(delta);
  });

  it('keeps the words of the system speaker out of the prose of the canvas', () => {
    const delta = { type: 'agent_text_delta', forTurn: 't', text: 'x', speaker: { kind: 'system' } } as unknown as ServerMessage;
    expect(coreMessage(delta)).toBeNull();
  });
});
