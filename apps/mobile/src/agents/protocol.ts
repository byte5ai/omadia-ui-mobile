/**
 * The agent part of the canvas wire (omadia-canvas-protocol/1.1, additive;
 * spec 2042 §5.3, §5.14), as this client uses it. Wire copies of the server's
 * `AgentSpeaker` / `SystemSpeaker` / `SYSTEM_NOTICE_CODES` (kernel
 * `@omadia/plugin-api` speaker.ts, relayed by `@omadia/ui-channel`); the
 * shapes mirror omadia-ui `app/src/shared/protocol.ts` and `docs/protocol/1.0.md`
 * §13. Everything arriving here is untrusted — read it through `speakerView`.
 *
 * `@omadia/canvas-core` does not carry these yet: its `parseServerMessage`
 * drops the `agents` frame, its `HandshakeSelect` cannot declare features and
 * its `ClientTurn` has no `agentId`. `wireTap.ts` bridges that on the socket.
 */
import type { ClientTurn } from '@omadia/canvas-core';

/** Feature id negotiated in `serverFeatures` / `clientFeatures`. */
export const AGENTS_FEATURE = 'agents';

/** An agent speaking as itself. */
export interface AgentSpeaker {
  kind: 'agent';
  agentId: string;
  slug: string;
  displayName: string;
  avatarUrl?: string;
}

/** The management layer — a notice, never an agent. */
export interface SystemSpeaker {
  kind: 'system';
}

export type Speaker = AgentSpeaker | SystemSpeaker;

/** One agent of the directory the user may address here, as the client uses
 *  it. `id` is what a turn carries as `agentId`. */
export interface AgentDirectoryEntry {
  id: string;
  slug: string;
  displayName: string;
  avatarUrl?: string;
  description?: string;
  archetype?: string;
}

/** What an unaddressed message reaches here: the default agent, or none (the
 *  notice code says why). The canvas channel sends it camelCase
 *  (`defaultAgent`), the kernel directory snake_case (`default_agent`). */
export type DefaultAgentWire = { slug: string } | { slug: null; notice?: string };

/** server → client: the agents available to this user in this channel (after
 *  the handshake, and as the answer to `agents_get`). Untrusted. */
export interface AgentsFrame {
  type: 'agents';
  agents?: unknown;
  defaultAgent?: unknown;
  default_agent?: unknown;
}

/** A turn that names its agent: `metadata.agentId` on the server. The server
 *  refuses a turn without one (`no_agent`) and never picks. */
export type AgentTurn = ClientTurn & { agentId?: string };

/** A management-layer notice naming the agent it is about. Untrusted — read
 *  through `speakerView.systemNoticeView`. The `code` is one of the kernel's
 *  `SYSTEM_NOTICE_CODES`, added additively; an unknown code renders via `text`. */
export interface SystemNoticeWire {
  code: string;
  text: string;
  locale?: string;
  agent?: { slug?: string; displayName?: string; agentId?: string };
}
