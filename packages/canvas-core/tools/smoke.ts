/**
 * End-to-end smoke test of the canvas-core stack against a REAL middleware:
 * connect → handshake → optional turn → feed every ServerMessage through the
 * canvasStore reducer → report tree validity and node count.
 *
 *   bun tools/smoke.ts <ws-url> [--turn "text"] [--cookie "omadia_session=…"] [--login]
 *
 * --login: POST credentials to the password provider and reuse the Set-Cookie
 * session. Credentials come from env (OMADIA_USER / OMADIA_PASS) so they never
 * touch the command line or any agent context:
 *
 *   OMADIA_USER=you@example.com OMADIA_PASS=… \
 *     bun tools/smoke.ts ws://127.0.0.1:8080/omadia-ui/canvas --login --turn "ping"
 *
 * Exit 0: handshake ready (and, with --turn, turn_complete with a valid tree).
 */
import WebSocket from 'ws';
import { CanvasSocket, type WsLike } from '../src/canvasSocket.js';
import { applyServerMessage, initialCanvasState, type CanvasState } from '../src/canvasStore.js';
import type { ServerMessage } from '../src/protocol.js';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
if (!url) {
  console.error('usage: bun tools/smoke.ts <ws-url> [--turn "text"] [--cookie "…"] [--login]');
  process.exit(2);
}
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);
const turnText = flag('turn');

/** Derive the http(s) origin from the ws(s):// canvas URL. */
const httpOrigin = (wsUrl: string): string =>
  new URL(wsUrl).origin.replace(/^ws/, 'http');

/** Log in via the password provider, return the `omadia_session=…` cookie. */
async function login(wsUrl: string): Promise<string> {
  const user = process.env.OMADIA_USER;
  const pass = process.env.OMADIA_PASS;
  if (!user || !pass) throw new Error('--login needs OMADIA_USER and OMADIA_PASS in the environment');
  const res = await fetch(`${httpOrigin(wsUrl)}/api/v1/auth/login/local`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: user, username: user, password: pass }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  const setCookie = res.headers.getSetCookie?.().join('; ') ?? res.headers.get('set-cookie') ?? '';
  const match = /omadia_session=[^;]+/.exec(setCookie);
  if (!match) throw new Error('login succeeded but no omadia_session cookie was set');
  return match[0];
}

let cookie = flag('cookie');
if (has('login')) {
  cookie = await login(url);
  console.log('login: omadia_session acquired');
}

const nodeWsFactory = (wsUrl: string, headers?: Record<string, string>): WsLike =>
  new WebSocket(wsUrl, { headers }) as unknown as WsLike;

let state: CanvasState = initialCanvasState;
let sessionId: string | undefined;
let turnDone = false;
let failure: string | undefined;

const countNodes = (node: unknown): number => {
  if (typeof node !== 'object' || node === null) return 0;
  const children = (node as { children?: unknown[] }).children;
  return 1 + (Array.isArray(children) ? children.reduce((n: number, c) => n + countNodes(c), 0) : 0);
};

const socket = new CanvasSocket({
  url,
  cookie,
  localOperations: [],
  createWebSocket: nodeWsFactory,
  session: {
    load: () => sessionId,
    save: (id) => {
      sessionId = id;
    },
  },
  onMessage: (msg: ServerMessage) => {
    const result = applyServerMessage(state, msg);
    state = result.state;
    if (result.resync) console.log(`⚠ store requested resync on ${msg.type}`);
    console.log(`← ${msg.type}`);
    if (msg.type === 'turn_complete') turnDone = true;
    if (msg.type === 'turn_error') {
      failure = `turn_error: ${JSON.stringify(msg)}`;
      turnDone = true;
    }
  },
  onStatus: (s) => {
    console.log(`status: ${s.state}${s.detail ? ` (${s.detail})` : ''}${s.canvasSessionId ? ` session=${s.canvasSessionId}` : ''}`);
    if (s.state === 'failed') failure = s.detail;
  },
});

socket.connect();

const deadline = Date.now() + (turnText ? 120_000 : 15_000);
let turnSent = false;
const poll = setInterval(() => {
  if (sessionId && turnText && !turnSent) {
    turnSent = true;
    console.log(`→ turn: "${turnText}"`);
    socket.sendTurn({ type: 'turn', turnId: `smoke-${Date.now()}`, text: turnText });
  }
  const done = turnText ? turnDone : Boolean(sessionId);
  if (done || failure || Date.now() > deadline) {
    clearInterval(poll);
    socket.close();
    const nodes = state.tree ? countNodes(state.tree) : 0;
    console.log(`\n— RESULT —`);
    console.log(`handshake: ${sessionId ? `ready (session=${sessionId})` : 'NOT READY'}`);
    console.log(`tree: ${state.tree ? `present, ${nodes} node(s)` : 'none'}`);
    if (failure) console.log(`failure: ${failure}`);
    if (Date.now() > deadline && !done) console.log('failure: timeout');
    process.exit(failure || !sessionId || (turnText && !turnDone) ? 1 : 0);
  }
}, 100);
