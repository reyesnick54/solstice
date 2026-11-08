/**
 * HELIOS FORWARD ALPHA08 — append-only forward trial universe (no dropping losers).
 */

import type { UtcInstant } from '@solstice/domain';

import { forwardTrialCandidateIdFromFingerprint } from './ids.ts';
import type {
  ForwardCandidateKind,
  ForwardMonitoringOutcome,
  ForwardTrialCandidate,
  ForwardTrialCandidateId,
  ForwardTrialFamily,
} from './types.ts';

export type RecordForwardTrialCandidateInput = {
  readonly recordedAt: UtcInstant;
  readonly candidateId?: ForwardTrialCandidateId;
  readonly trialFamily: ForwardTrialFamily;
  readonly kind: ForwardCandidateKind;
  readonly genomeId: string;
  readonly parameterVectorFingerprint: string;
  readonly campaignId?: string | null;
  readonly forwardExcessReturns: readonly number[];
  readonly behavioralSignature?: readonly number[] | null;
  readonly priorCumulativeResearchTrials: number;
  readonly priorEffectiveIndependentResearchTrials: number;
  readonly monitoringOutcome?: ForwardMonitoringOutcome;
};

export type ForwardTrialRegistrySnapshot = {
  readonly candidates: readonly ForwardTrialCandidate[];
};

export type ForwardTrialRegistry = {
  readonly registerCandidate: (input: RecordForwardTrialCandidateInput) => ForwardTrialCandidate;
  readonly listCandidates: () => readonly ForwardTrialCandidate[];
  readonly snapshot: () => ForwardTrialRegistrySnapshot;
  /** Marks outcome but never removes from universe. */
  readonly updateMonitoringOutcome: (
    candidateId: ForwardTrialCandidateId,
    outcome: ForwardMonitoringOutcome,
  ) => ForwardTrialCandidate | null;
};

export function createForwardTrialRegistry(): ForwardTrialRegistry {
  const candidates: ForwardTrialCandidate[] = [];
  let seq = 0;

  const materialize = (
    input: RecordForwardTrialCandidateInput,
    seqAtRecord: number,
  ): ForwardTrialCandidate => {
    const candidateId =
      input.candidateId ??
      forwardTrialCandidateIdFromFingerprint({
        genomeId: input.genomeId,
        kind: input.kind,
        parameterVectorFingerprint: input.parameterVectorFingerprint,
        recordedAtIso: input.recordedAt,
        seq: seqAtRecord,
      });
    return Object.freeze({
      candidateId,
      recordedAt: input.recordedAt,
      trialFamily: input.trialFamily,
      kind: input.kind,
      genomeId: input.genomeId,
      parameterVectorFingerprint: input.parameterVectorFingerprint,
      campaignId: input.campaignId ?? null,
      forwardExcessReturns: Object.freeze([...input.forwardExcessReturns]),
      behavioralSignature:
        input.behavioralSignature === undefined || input.behavioralSignature === null
          ? null
          : Object.freeze([...input.behavioralSignature]),
      priorCumulativeResearchTrials: Math.max(0, input.priorCumulativeResearchTrials),
      priorEffectiveIndependentResearchTrials: Math.max(
        0,
        input.priorEffectiveIndependentResearchTrials,
      ),
      monitoringOutcome: input.monitoringOutcome ?? 'ACTIVE',
      retainedInTrialUniverse: true as const,
    });
  };

  return Object.freeze({
    registerCandidate: (input) => {
      seq += 1;
      const record = materialize(input, seq);
      candidates.push(record);
      return record;
    },
    listCandidates: () => Object.freeze([...candidates]),
    snapshot: () => Object.freeze({ candidates: Object.freeze([...candidates]) }),
    updateMonitoringOutcome: (candidateId, outcome) => {
      const idx = candidates.findIndex((c) => c.candidateId === candidateId);
      if (idx < 0) {
        return null;
      }
      const prev = candidates[idx]!;
      const next = Object.freeze({
        ...prev,
        monitoringOutcome: outcome,
        retainedInTrialUniverse: true as const,
      });
      candidates[idx] = next;
      return next;
    },
  });
}

export function assertForwardTrialUniverseRetainsAll(
  beforeCount: number,
  afterCount: number,
  minimumIncrement: number,
): boolean {
  return afterCount >= beforeCount + minimumIncrement;
}
