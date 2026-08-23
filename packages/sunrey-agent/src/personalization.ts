import type { ExplanationComplexity, PersonalizationVerbosity } from './taxonomy.ts';
import type { AgentPersonalization, UserAgent } from './types.ts';

export const DEFAULT_PERSONALIZATION: Omit<AgentPersonalization, 'ownerId' | 'agentId'> = {
  verbosity: 'NORMAL',
  displayCurrency: 'USD',
  language: 'und',
  explanationComplexity: 'STANDARD',
  personalizationMemoryEnabled: true,
  altersFinancialMathematics: false,
  altersRegulatoryDisclosures: false,
};

export function createPersonalization(input: {
  readonly agent: UserAgent;
  readonly ownerId: string;
  readonly verbosity?: PersonalizationVerbosity;
  readonly displayCurrency?: string;
  readonly language?: string;
  readonly explanationComplexity?: ExplanationComplexity;
  readonly personalizationMemoryEnabled?: boolean;
}): AgentPersonalization {
  return Object.freeze({
    ownerId: input.ownerId,
    agentId: input.agent.agentId,
    verbosity: input.verbosity ?? DEFAULT_PERSONALIZATION.verbosity,
    displayCurrency: input.displayCurrency ?? DEFAULT_PERSONALIZATION.displayCurrency,
    language: normalizeLanguageTag(input.language ?? DEFAULT_PERSONALIZATION.language),
    explanationComplexity: input.explanationComplexity ?? DEFAULT_PERSONALIZATION.explanationComplexity,
    personalizationMemoryEnabled: input.personalizationMemoryEnabled ?? true,
    altersFinancialMathematics: false,
    altersRegulatoryDisclosures: false,
  });
}

export function normalizeLanguageTag(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'und';
  }
  return trimmed.replace('_', '-');
}

export function applyPersonalizationStyle(text: string, prefs: AgentPersonalization): string {
  if (prefs.verbosity === 'BRIEF' && text.length > 280) {
    return text.slice(0, 280);
  }
  return text;
}

export function personalizationCannotAlterMath(prefs: AgentPersonalization): true {
  if (prefs.altersFinancialMathematics !== false || prefs.altersRegulatoryDisclosures !== false) {
    throw new Error('personalization cannot alter financial mathematics or disclosures');
  }
  return true;
}
