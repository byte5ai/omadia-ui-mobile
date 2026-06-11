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
  resync(): void;
  close(): void;
}

type ReactNativeWebSocketConstructor = new (
  url: string,
  protocols: string[] | null,
  options?: { headers?: Record<string, string> },
) => WsLike;

const ReactNativeWebSocket = WebSocket as unknown as ReactNativeWebSocketConstructor;

const createWebSocket: WebSocketFactory = (url, headers) =>
  new ReactNativeWebSocket(url, null, headers ? { headers } : undefined) as unknown as WsLike;

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
    resync() {
      socket.resync();
    },
    close() {
      socket.close();
    },
  };
}
