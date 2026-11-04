import type { EvidenceVault } from '@solstice/evidence';

import type { ResearchRunContextPackage } from './research-history.ts';
import type { DecisionMemoryEntry } from './decision-memory.ts';

export const TRADINGAGENTS_MEMORY_EVIDENCE_KIND = 'helios.tradingagents.decision_memory.v1' as const;
export const TRADINGAGENTS_RESEARCH_CONTEXT_EVIDENCE_KIND =
  'helios.tradingagents.research_context.v1' as const;

export function sealDecisionMemoryEntry(
  vault: EvidenceVault,
  entry: DecisionMemoryEntry,
): ReturnType<EvidenceVault['seal']> {
  return vault.seal(TRADINGAGENTS_MEMORY_EVIDENCE_KIND, Object.freeze({ ...entry }));
}

export function sealResearchContextPackage(
  vault: EvidenceVault,
  pkg: ResearchRunContextPackage,
): ReturnType<EvidenceVault['seal']> {
  return vault.seal(TRADINGAGENTS_RESEARCH_CONTEXT_EVIDENCE_KIND, Object.freeze({ ...pkg }));
}
