/**
 * HELIOS Forward Alpha ALPHA09 — orchestrates risk-adjusted forward evidence.
 */

import {
  HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_BLOCKED,
  HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_QUALIFIED,
} from './taxonomy.ts';
import { analyzeForwardAlphaConcentration } from './concentration.ts';
import { measureForwardPerformance, measureForwardRisk, measureForwardTail } from './measure.ts';
import { assessForwardAlphaTrackRecord } from './track-record.ts';
import type { ForwardAlpha09MeasureInput, ForwardAlpha09RiskAdjustedEvidence } from './types.ts';

export function runForwardAlpha09RiskAdjustedEvidence(
  input: ForwardAlpha09MeasureInput,
): ForwardAlpha09RiskAdjustedEvidence {
  const performance = measureForwardPerformance(input);
  const risk = measureForwardRisk(input, performance.annualizedReturn?.units ?? null);
  const tail = measureForwardTail(input);
  const concentration = analyzeForwardAlphaConcentration(input.trades);
  const trackRecord = assessForwardAlphaTrackRecord({
    horizonClass: input.horizonClass,
    observationDays: input.observationDays,
    independentOpportunityCount: input.trades.length,
    periodCount: input.periodReturns.length,
  });

  const structurallyAdequate =
    trackRecord.meetsDurationRequirement &&
    trackRecord.meetsOpportunityRequirement &&
    !concentration.repeatabilityClaimBlocked;

  const qualificationMarker = structurallyAdequate
    ? HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_QUALIFIED
    : HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_BLOCKED;

  return Object.freeze({
    schema: input.schema,
    strategyId: input.strategyId,
    performance,
    risk,
    tail,
    concentration,
    trackRecord,
    qualificationMarker,
    grantsExecutionAuthority: false,
    simulationOnly: true,
    researchOnly: true,
    sealedAt: input.sealedAt,
  });
}
