/**
 * The agent protocol on the socket, for what `@omadia/canvas-core` does not
 * carry yet (spec 2042 §5.14, omadia-ui `docs/protocol/1.0.md` §13):
 *
 * - `handshake_select` gets `clientFeatures: ['agents']` and the UI `locale`,
 *   so the server pushes the agent directory and renders its `system` notices
 *   in the user's language;
 * - the `agents` frame — which `parseServerMessage` drops as an unknown type —
 *   and the offer's `serverFeatures` are handed to the app;
 * - `agents_get` (re-ask the directory) goes out on the same socket.
 *
 * It wraps the platform socket, so canvas-core stays untouched and synced as
 * is. When canvas-core carries these natively, this file is deleted and the
 * three call sites in `connection.ts` go with it. Pure: no React Native import.
 */
import type { WsLike } from '@omadia/canvas-core';
import { AGENTS_FEATURE, type AgentsFrame } from './protocol';

export interface WireTapHandlers {
  /** an `agents` frame (after the handshake, and as the answer to `agents_get`) */
  onAgents(frame: AgentsFrame): void;
  /** `serverFeatures` of the `handshake_offer` — empty for a server without any */
  onServerFeatures(features: readonly string[]): void;
}

const WS_OPEN = 1;

const parseObject = (raw: unknown): Record<string, unknown> | null => {
  if (typeof raw !== 'string') return null;
  try {
    const obj: unknown = JSON.parse(raw);
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
      ? (obj as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

/** `handshake_select` declares the `agents` feature and the UI language; any
 *  other outgoing frame passes unchanged. */
export function decorateOutgoing(raw: string, locale: string): string {
  const frame = parseObject(raw);
  if (frame === null || frame['type'] !== 'handshake_select') return raw;
  const declared = Array.isArray(frame['clientFeatures'])
    ? frame['clientFeatures'].filter((f): f is string => typeof f === 'string')
    : [];
  return JSON.stringify({
    ...frame,
    clientFeatures: declared.includes(AGENTS_FEATURE) ? declared : [...declared, AGENTS_FEATURE],
    locale,
  });
}

/** Look at one incoming frame; what canvas-core drops reaches the handlers. */
export function tapIncoming(raw: unknown, handlers: WireTapHandlers): void {
  const frame = parseObject(raw);
  if (frame === null) return;
  if (frame['type'] === 'agents') {
    handlers.onAgents(frame as unknown as AgentsFrame);
    return;
  }
  if (frame['type'] === 'handshake_offer') {
    const features = Array.isArray(frame['serverFeatures'])
      ? frame['serverFeatures'].filter((f): f is string => typeof f === 'string')
      : [];
    handlers.onServerFeatures(features);
  }
}

/** The directory request; only meaningful on an open, handshaken socket. */
export const AGENTS_GET_FRAME = JSON.stringify({ type: 'agents_get' });

/** Send `agents_get`; false when the socket is not open. */
export function requestAgentsOn(ws: WsLike | null): boolean {
  if (ws === null || ws.readyState !== WS_OPEN) return false;
  ws.send(AGENTS_GET_FRAME);
  return true;
}

/** `inner`, with the outgoing handshake decorated and incoming frames tapped. */
export function tapSocket(
  inner: WsLike,
  options: { locale: string; handlers: WireTapHandlers },
): WsLike {
  let onmessage: WsLike['onmessage'] = null;
  return {
    get readyState() {
      return inner.readyState;
    },
    send: (data) => inner.send(decorateOutgoing(data, options.locale)),
    close: (code, reason) => inner.close(code, reason),
    get onmessage() {
      return onmessage;
    },
    set onmessage(handler) {
      onmessage = handler;
      inner.onmessage = handler
        ? (ev) => {
            tapIncoming(ev.data, options.handlers);
            handler(ev);
          }
        : null;
    },
    get onclose() {
      return inner.onclose;
    },
    set onclose(handler) {
      inner.onclose = handler;
    },
    get onerror() {
      return inner.onerror;
    },
    set onerror(handler) {
      inner.onerror = handler;
    },
  };
}
