/**
 * The agent of a conversation (spec 2042 §5.3): chosen by the user per canvas
 * and fixed once the canvas has had its first turn. Every turn carries it; the
 * server refuses a turn without one and never picks. The client never picks
 * either: it preselects only what the server names (the directory's default
 * agent) or the one agent there is, visibly, and the user can still choose
 * another before the first turn.
 *
 * Pure and immutable; `agentChoiceStorage` in `storage.ts` persists the map.
 */
import type { AgentDirectoryEntry } from './protocol';
import { preselectedAgent } from './speakerView';

export interface CanvasAgentChoice {
  agentId: string;
  /** true once a turn was sent (or the registry already fixed it) */
  locked: boolean;
}

/** per canvas (`canvasSessionId`) */
export type AgentChoices = Readonly<Record<string, CanvasAgentChoice>>;

/** `agentId` per canvas as the server's canvas registry carries it (`canvas_list`) */
export type RegistryAgents = Readonly<Record<string, string>>;

export interface ResolvedAgent {
  /** undefined: none chosen and nothing to preselect — nothing may be sent */
  agentId: string | undefined;
  locked: boolean;
  /** true when the agent was preselected, not chosen by the user */
  preselected: boolean;
}

export function resolveAgent(
  choices: AgentChoices,
  registry: RegistryAgents,
  canvasId: string | null,
  agents: readonly AgentDirectoryEntry[],
  defaultSlug: string | null,
): ResolvedAgent {
  if (canvasId !== null) {
    const chosen = choices[canvasId];
    if (chosen) return { agentId: chosen.agentId, locked: chosen.locked, preselected: false };
    const fromRegistry = registry[canvasId];
    if (fromRegistry) return { agentId: fromRegistry, locked: true, preselected: false };
  }
  const preselected = preselectedAgent(agents, defaultSlug);
  return { agentId: preselected?.id, locked: false, preselected: preselected !== undefined };
}

/** The user picks an agent for a canvas; ignored once it is locked. */
export function chooseAgent(choices: AgentChoices, canvasId: string, agentId: string): AgentChoices {
  if (choices[canvasId]?.locked) return choices;
  return { ...choices, [canvasId]: { agentId, locked: false } };
}

/** A first turn is sent with `agentId`: the choice is fixed from now on. */
export function lockAgent(choices: AgentChoices, canvasId: string, agentId: string): AgentChoices {
  if (choices[canvasId]?.locked) return choices;
  return { ...choices, [canvasId]: { agentId, locked: true } };
}

/** Narrow persisted/untrusted JSON to a choice map. */
export function parseAgentChoices(raw: unknown): AgentChoices {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: Record<string, CanvasAgentChoice> = {};
  for (const [canvasId, value] of Object.entries(raw)) {
    if (typeof value !== 'object' || value === null) continue;
    const v = value as Record<string, unknown>;
    if (typeof v['agentId'] !== 'string' || v['agentId'].length === 0) continue;
    out[canvasId] = { agentId: v['agentId'], locked: v['locked'] === true };
  }
  return out;
}

/** The registry's per-canvas agents from the `canvas_list` entries. */
export function registryAgentsOf(
  canvases: ReadonlyArray<{ sessionId: string; agentId?: unknown }>,
): RegistryAgents {
  const out: Record<string, string> = {};
  for (const c of canvases) {
    if (typeof c.agentId === 'string' && c.agentId.length > 0) out[c.sessionId] = c.agentId;
  }
  return out;
}

/**
 * May a turn be sent, and with which agent? A server without the agent
 * protocol takes turns without one; otherwise no agent chosen = nothing sent.
 */
export type SendDecision =
  | { send: true; agentId: string | undefined }
  | { send: false; reason: 'no_agent' };

export function decideSend(
  serverSupportsAgents: boolean | null,
  agentId: string | undefined,
): SendDecision {
  if (serverSupportsAgents === false) return { send: true, agentId: undefined };
  return agentId === undefined ? { send: false, reason: 'no_agent' } : { send: true, agentId };
}
