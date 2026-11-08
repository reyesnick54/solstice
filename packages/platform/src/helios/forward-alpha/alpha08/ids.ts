/**
 * HELIOS FORWARD ALPHA08 — deterministic identifiers.
 */

import { createHash } from 'node:crypto';

import type { ForwardTrialCandidateId, ForwardTrialFamilyId } from './types.ts';

export function forwardTrialFamilyIdFromParts(input: {
  readonly strategyFamilyId: string;
  readonly signalFamilyId: string;
  readonly assetClassId: string;
  readonly featureFamilyId: string;
}): ForwardTrialFamilyId {
  const payload = [
    input.strategyFamilyId,
    input.signalFamilyId,
    input.assetClassId,
    input.featureFamilyId,
  ].join('|');
  const hex = createHash('sha256').update(payload).digest('hex').slice(0, 24);
  return `ftf_${hex}` as ForwardTrialFamilyId;
}

export function forwardTrialCandidateIdFromFingerprint(input: {
  readonly genomeId: string;
  readonly kind: string;
  readonly parameterVectorFingerprint: string;
  readonly recordedAtIso: string;
  readonly seq: number;
}): ForwardTrialCandidateId {
  const payload = [
    input.genomeId,
    input.kind,
    input.parameterVectorFingerprint,
    input.recordedAtIso,
    String(input.seq),
  ].join('|');
  const hex = createHash('sha256').update(payload).digest('hex').slice(0, 24);
  return `ftc_${hex}` as ForwardTrialCandidateId;
}
