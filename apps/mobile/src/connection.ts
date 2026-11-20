import {
  CanvasSocket,
  type ClientTurn,
  type ConnectionStatus,
  type ServerMessage,
  type SessionPersistence,
  type WebSocketFactory,
  type WsLike,
} from '@omadia/canvas-core';
import type { AgentsFrame, AgentTurn } from './agents/protocol';
import { uiLocale } from './agents/texts';
import { requestAgentsOn, tapSocket, type WireTapHandlers } from './agents/wireTap';

export interface CanvasConnectionHandlers {
  onMessage: (msg: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
  /** the agent directory (`agents` frame) — canvas-core drops it, see wireTap.ts */
  onAgents?: (frame: AgentsFrame) => void;
  /** `serverFeatures` of the offer: does this server speak the agent protocol? */
  onServerFeatures?: (features: readonly string[]) => void;
}

export interface CanvasConnection {
  connect(): void;
  /** `agentId` names the agent of the canvas (`metadata.agentId`); omitted only
   *  for a server that does not speak the agent protocol. */
  sendTurn(turn: ClientTurn, agentId?: string): void;
  /** ask the server for the agent directory again; false when not connected */
  requestAgents(): boolean;
  requestCanvasList(): void;
  resync(): void;
  switchCanvas(sessionId: string): void;
  close(): void;
}

type ReactNativeWebSocketConstructor = new (
  url: string,
  protocols: string[] | null,
  options?: { headers?: Record<string, string> },
) => WsLike;

const ReactNativeWebSocket = WebSocket as unknown as ReactNativeWebSocketConstructor;

const platformWebSocket: WebSocketFactory = (url, headers) => {
  // React Native attaches the `omadia_session` cookie automatically from the
  // native cookie store (populated by the login fetch) on both iOS and Android.
  // Passing an explicit `Cookie` header here in ADDITION duplicates it, yielding
  // a malformed double-cookie header that the server rejects with 401. So we
  // deliberately drop the header and let the native store carry the session.
  void headers;
  console.log(`[ws] connect ${url} (cookie via native store)`);
  return new ReactNativeWebSocket(url, null) as unknown as WsLike;
};

export function createCanvasConnection(
  serverUrl: string,
  session: SessionPersistence,
  handlers: CanvasConnectionHandlers,
  cookie?: string,
): CanvasConnection {
  const tap: WireTapHandlers = {
    onAgents: (frame) => handlers.onAgents?.(frame),
    onServerFeatures: (features) => handlers.onServerFeatures?.(features),
  };
  const locale = uiLocale();
  let currentWs: WsLike | null = null;
  const createWebSocket: WebSocketFactory = (url, headers) => {
    currentWs = tapSocket(platformWebSocket(url, headers), { locale, handlers: tap });
    return currentWs;
  };

  const socket = new CanvasSocket({
    url: serverUrl,
    ...(cookie ? { cookie } : {}),
    localOperations: [],
    session,
    createWebSocket,
    onMessage: handlers.onMessage,
    onStatus: handlers.onStatus,
  });

  return {
    connect() {
      socket.connect();
    },
    sendTurn(turn: ClientTurn, agentId?: string) {
      const named: AgentTurn = agentId ? { ...turn, agentId } : turn;
      socket.sendTurn(named);
    },
    requestAgents() {
      return requestAgentsOn(currentWs);
    },
    requestCanvasList() {
      socket.requestCanvasList();
    },
    resync() {
      socket.resync();
    },
    switchCanvas(sessionId: string) {
      socket.switchCanvas(sessionId);
    },
    close() {
      socket.close();
    },
  };
}
