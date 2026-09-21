import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { GROW_REPORT_DISCLOSURE_FLAGS } from './taxonomy.ts';
import type { GrowIntelligenceFactsSnapshot, StructuredMorningBriefArtifact } from './types.ts';

export function buildStructuredMorningBrief(input: {
  readonly facts: GrowIntelligenceFactsSnapshot;
  readonly now: UtcInstant;
}): StructuredMorningBriefArtifact {
  const { facts, now } = input;
  return Object.freeze({
    schema: 'sunrey.helios.grow.morning-brief.v1',
    reportId: `mbr_${randomUUID()}`,
    customerId: facts.customerId,
    subjectId: facts.subjectId,
    reportingDate: facts.reportingDate,
    timeZone: facts.timeZone,
    executionMode: facts.executionMode,
    environment: 'simulation',
    growCapital: facts.growCapital,
    availableCash: facts.availableCash,
    activePositions: facts.activePositions,
    marketRegimes: facts.marketRegimes,
    scheduledMarketEvents: facts.scheduledMarketEvents,
    monitoredMarkets: facts.monitoredMarkets,
    riskState: facts.riskState,
    providerLimitations: facts.providerLimitations,
    dataLimitations: facts.dataLimitations,
    strategyStateChanges: facts.strategyStateChanges,
    disclosures: Object.freeze([
      GROW_REPORT_DISCLOSURE_FLAGS[0],
      GROW_REPORT_DISCLOSURE_FLAGS[2],
      GROW_REPORT_DISCLOSURE_FLAGS[3],
    ]),
    factsHash: facts.factsHash,
    generatedAt: now,
    grantsExecutionAuthority: false,
    noGuaranteedOutcomes: true,
  });
}
