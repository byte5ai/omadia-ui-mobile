/**
 * What the app knows about agents on the current connection (spec 2042 INV-1,
 * 3, 4, 6, 7): the directory the server listed, who spoke last, the `system`
 * notice of the last turn. A pure reducer next to canvas-core's canvas state —
 * it reads the same server messages, never invents a speaker, and never picks
 * an agent.
 */
import type { ServerMessage } from '@omadia/canvas-core';
import {
  AGENTS_FEATURE,
  type AgentDirectoryEntry,
  type AgentsFrame,
  type Speaker,
} from './protocol';
import {
  agentDirectoryView,
  defaultAgentOfFrame,
  speakerView,
  systemNoticeView,
  type SystemNoticeView,
} from './speakerView';

export interface AgentView {
  /** does the server speak the agent protocol? `null` until its offer arrived;
   *  `false` for a server that predates agents (no picker, no `agentId`) */
  serverSupportsAgents: boolean | null;
  agents: readonly AgentDirectoryEntry[];
  /** false until the directory arrived: "nobody available" is not "loading" */
  agentsLoaded: boolean;
  /** slug of the directory's default agent — the picker preselects it */
  defaultSlug: string | null;
  /** who the last answer is from, as the server stamped it; null until known */
  speaker: Speaker | null;
  /** the `system` notice of the last turn (refused / failed / a notice text),
   *  shown set apart from agent messages; cleared when a new turn starts */
  systemNotice: SystemNoticeView | null;
}

export const initialAgentView: AgentView = {
  serverSupportsAgents: null,
  agents: [],
  agentsLoaded: false,
  defaultSlug: null,
  speaker: null,
  systemNotice: null,
};

export type AgentViewEvent =
  | { kind: 'server_features'; features: readonly string[] }
  | { kind: 'agents'; frame: AgentsFrame }
  | { kind: 'message'; message: ServerMessage }
  /** a turn is sent: last notice cleared */
  | { kind: 'turn_started' }
  /** the client's own notice (no agent chosen), or `null` to dismiss */
  | { kind: 'notice'; notice: SystemNoticeView | null }
  /** another canvas is shown: its speaker and notice are not this one's */
  | { kind: 'canvas_switched' }
  /** a new connection: the directory is asked for again */
  | { kind: 'connection_reset' };

type Stamped = { speaker?: unknown; systemNotice?: unknown };

export function reduceAgentView(state: AgentView, event: AgentViewEvent): AgentView {
  switch (event.kind) {
    case 'server_features':
      return { ...state, serverSupportsAgents: event.features.includes(AGENTS_FEATURE) };
    case 'agents':
      return {
        ...state,
        agents: agentDirectoryView(event.frame.agents),
        agentsLoaded: true,
        defaultSlug: defaultAgentOfFrame(event.frame),
      };
    case 'turn_started':
      return { ...state, systemNotice: null };
    case 'notice':
      return { ...state, systemNotice: event.notice };
    case 'canvas_switched':
      return { ...state, speaker: null, systemNotice: null };
    case 'connection_reset':
      return { ...initialAgentView };
    case 'message':
      return reduceMessage(state, event.message);
  }
}

function reduceMessage(state: AgentView, message: ServerMessage): AgentView {
  const stamped = message as Stamped;
  switch (message.type) {
    case 'agent_text_delta': {
      const speaker = speakerView(stamped.speaker);
      if (speaker?.kind === 'system') {
        // words of the management layer are never prose of an agent: they
        // accumulate into the set-apart `system` notice (INV-6/7)
        const prior = state.systemNotice;
        return {
          ...state,
          systemNotice: {
            code: prior?.code ?? 'system',
            text: (prior?.text ?? '') + message.text,
            ...(prior?.agentName !== undefined ? { agentName: prior.agentName } : {}),
          },
        };
      }
      return speaker === null ? state : { ...state, speaker };
    }
    case 'turn_complete': {
      const speaker = speakerView(stamped.speaker);
      return speaker === null ? state : { ...state, speaker };
    }
    case 'turn_error':
      // a refused or failed turn is a `system` notice naming the agent (INV-7)
      return { ...state, systemNotice: systemNoticeView(stamped.systemNotice) };
    default: {
      if (!message.type.startsWith('surface_')) return state;
      const speaker = speakerView(stamped.speaker);
      return speaker === null ? state : { ...state, speaker };
    }
  }
}

/**
 * The message as canvas-core's store may see it. `speaker` is transport
 * stamping the server adds to every answer frame; the surface-event schema
 * does not list it and would reject the event, so it is taken off. The text of
 * the `system` speaker is not agent prose and never reaches the prose of the
 * canvas (`null`: do not apply); neither does a retract in its name, which
 * would otherwise trim the agent's prose.
 */
export function coreMessage(message: ServerMessage): ServerMessage | null {
  if (message.type === 'agent_text_delta' || message.type === 'agent_text_retract') {
    return speakerView((message as Stamped).speaker)?.kind === 'system' ? null : message;
  }
  if (message.type.startsWith('surface_') && 'speaker' in message) {
    const { speaker: _speaker, ...bare } = message as Record<string, unknown>;
    return bare as unknown as ServerMessage;
  }
  return message;
}
