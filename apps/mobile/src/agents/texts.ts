/**
 * The words of the agent surfaces, per UI language. The app has no i18n
 * framework; these are the only user-visible strings of the agent protocol,
 * kept in one place so a language is added in one edit. Terminology per the
 * kernel's `docs/terminology.md`: "Agent" (never "Orchestrator"); the
 * management layer's notices are "Systemhinweis" / "System notice".
 */
export type UiLocale = 'de' | 'en';

export interface AgentTexts {
  pickerTitle: string;
  pickerLoading: string;
  pickerEmpty: string;
  pickerLocked: (name: string) => string;
  answerFrom: (name: string) => string;
  systemNotice: string;
  dismiss: string;
  composerPlaceholder: (name: string | undefined) => string;
  noAgentNotice: string;
}

const de: AgentTexts = {
  pickerTitle: 'Mit wem möchtest du sprechen?',
  pickerLoading: 'Agenten werden geladen …',
  pickerEmpty: 'Dir steht hier noch kein Agent zur Verfügung. Bitte wende dich an die Administration.',
  pickerLocked: (name) => `Dieses Gespräch führst du mit ${name}.`,
  answerFrom: (name) => `Antwort von ${name}`,
  systemNotice: 'Systemhinweis',
  dismiss: 'Hinweis schließen',
  composerPlaceholder: (name) => (name ? `Frag ${name} …` : 'Wähle zuerst einen Agenten'),
  noAgentNotice: 'Wähle zuerst einen Agenten für dieses Gespräch.',
};

const en: AgentTexts = {
  pickerTitle: 'Who do you want to talk to?',
  pickerLoading: 'Loading agents …',
  pickerEmpty: 'No agent is available to you here yet. Please contact your administrator.',
  pickerLocked: (name) => `This conversation is with ${name}.`,
  answerFrom: (name) => `Answer from ${name}`,
  systemNotice: 'System notice',
  dismiss: 'Dismiss notice',
  composerPlaceholder: (name) => (name ? `Ask ${name} …` : 'Choose an agent first'),
  noAgentNotice: 'Choose an agent for this conversation first.',
};

/** `de` for a German device, `en` otherwise — also the language the server's
 *  `system` notices are rendered in (`handshake_select.locale`). */
export function uiLocale(): UiLocale {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale;
    return tag.toLowerCase().startsWith('de') ? 'de' : 'en';
  } catch {
    return 'en';
  }
}

export const agentTexts = (locale: UiLocale = uiLocale()): AgentTexts => (locale === 'de' ? de : en);
