import { describe, expect, it } from 'vitest';
import { CanvasSocket, type ServerMessage, type WsLike } from '@omadia/canvas-core';
import type { AgentTurn } from '../src/agents/protocol';
import {
  decorateOutgoing,
  requestAgentsOn,
  tapIncoming,
  tapSocket,
  type WireTapHandlers,
} from '../src/agents/wireTap';

class FakeWs implements WsLike {
  readyState = 1;
  sent: string[] = [];
  onmessage: WsLike['onmessage'] = null;
  onclose: WsLike['onclose'] = null;
  onerror: WsLike['onerror'] = null;
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.readyState = 3;
  }
  receive(frame: unknown): void {
    this.onmessage?.({ data: typeof frame === 'string' ? frame : JSON.stringify(frame) });
  }
}

const recorder = () => {
  const agents: unknown[] = [];
  const features: Array<readonly string[]> = [];
  const handlers: WireTapHandlers = {
    onAgents: (f) => agents.push(f),
    onServerFeatures: (f) => features.push(f),
  };
  return { agents, features, handlers };
};

describe('decorateOutgoing', () => {
  it('declares the agents feature and the locale on the handshake_select', () => {
    const out = JSON.parse(
      decorateOutgoing(JSON.stringify({ type: 'handshake_select', handshakeId: 'h', localOperations: [] }), 'de'),
    ) as Record<string, unknown>;
    expect(out).toMatchObject({ type: 'handshake_select', handshakeId: 'h', clientFeatures: ['agents'], locale: 'de' });
  });

  it('keeps features it already declares, without duplicating agents', () => {
    const out = JSON.parse(
      decorateOutgoing(JSON.stringify({ type: 'handshake_select', clientFeatures: ['x', 'agents'] }), 'en'),
    ) as { clientFeatures: string[] };
    expect(out.clientFeatures).toEqual(['x', 'agents']);
  });

  it('leaves every other frame and non-JSON untouched', () => {
    const turn = JSON.stringify({ type: 'turn', text: 'hi', agentId: 'mira' });
    expect(decorateOutgoing(turn, 'de')).toBe(turn);
    expect(decorateOutgoing('not json', 'de')).toBe('not json');
    expect(decorateOutgoing('[1]', 'de')).toBe('[1]');
  });
});

describe('tapIncoming', () => {
  it('hands over the agents frame and the offer features, ignores the rest', () => {
    const r = recorder();
    tapIncoming(JSON.stringify({ type: 'agents', agents: [{ slug: 'mira' }] }), r.handlers);
    tapIncoming(JSON.stringify({ type: 'handshake_offer', serverFeatures: ['agents', 7] }), r.handlers);
    tapIncoming(JSON.stringify({ type: 'handshake_offer' }), r.handlers);
    tapIncoming(JSON.stringify({ type: 'turn_complete', forTurn: 't' }), r.handlers);
    tapIncoming('garbage', r.handlers);
    expect(r.agents).toEqual([{ type: 'agents', agents: [{ slug: 'mira' }] }]);
    expect(r.features).toEqual([['agents'], []]);
  });
});

describe('requestAgentsOn', () => {
  it('sends agents_get on an open socket only', () => {
    const ws = new FakeWs();
    expect(requestAgentsOn(ws)).toBe(true);
    expect(ws.sent).toEqual(['{"type":"agents_get"}']);
    ws.readyState = 3;
    expect(requestAgentsOn(ws)).toBe(false);
    expect(requestAgentsOn(null)).toBe(false);
  });
});

describe('over a real CanvasSocket', () => {
  const connect = () => {
    const ws = new FakeWs();
    const r = recorder();
    const messages: ServerMessage[] = [];
    const socket = new CanvasSocket({
      url: 'ws://test',
      localOperations: [],
      session: { load: () => undefined, save: () => undefined },
      createWebSocket: () => tapSocket(ws, { locale: 'de', handlers: r.handlers }),
      onMessage: (m) => messages.push(m),
      onStatus: () => undefined,
    });
    socket.connect();
    ws.receive({
      type: 'handshake_offer',
      handshakeId: 'h1',
      protocolVersions: ['1.0'],
      opsCatalogVersions: ['1.0'],
      serverFeatures: ['agents'],
    });
    ws.receive({ type: 'handshake_ack', handshakeId: 'h1', canvasSessionId: 'c1' });
    return { ws, socket, messages, ...r };
  };

  it('declares the feature in the handshake and receives the directory canvas-core drops', () => {
    const { ws, agents, features } = connect();
    const select = JSON.parse(ws.sent[0] as string) as Record<string, unknown>;
    expect(select).toMatchObject({ type: 'handshake_select', clientFeatures: ['agents'], locale: 'de' });
    expect(features).toEqual([['agents']]);
    ws.receive({ type: 'agents', agents: [{ id: 'a1', slug: 'mira', displayName: 'Mira' }] });
    expect(agents).toHaveLength(1);
  });

  it('keeps speaker, code and systemNotice on the messages canvas-core delivers', () => {
    const { ws, messages } = connect();
    ws.receive({
      type: 'turn_error',
      forTurn: 't1',
      message: 'no_agent',
      speaker: { kind: 'system' },
      code: 'no_agent',
      systemNotice: { code: 'no_agent', text: 'Kein Agent.' },
    });
    expect(messages[0]).toMatchObject({ speaker: { kind: 'system' }, code: 'no_agent' });
  });

  it('sends the agentId with the turn', () => {
    const { ws, socket } = connect();
    const turn: AgentTurn = { type: 'turn', turnId: 't1', text: 'hi', agentId: 'a1' };
    socket.sendTurn(turn);
    expect(JSON.parse(ws.sent[ws.sent.length - 1] as string)).toMatchObject({ type: 'turn', agentId: 'a1' });
  });
});
