import {
  CanvasSocket,
  type ClientTurn,
  type ConnectionStatus,
  type ServerMessage,
  type SessionPersistence,
  type WebSocketFactory,
  type WsLike,
} from '@omadia/canvas-core';

export interface CanvasConnectionHandlers {
  onMessage: (msg: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
}

export interface CanvasConnection {
  connect(): void;
  sendTurn(turn: ClientTurn): void;
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

const createWebSocket: WebSocketFactory = (url, headers) => {
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
    sendTurn(turn: ClientTurn) {
      socket.sendTurn(turn);
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
