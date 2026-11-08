import { createHash } from 'node:crypto';

import type { UtcInstant } from '../imports.ts';
import { ALPHA14_EVIDENCE_QUESTIONS, ALPHA_EVIDENCE_COMMITTEE_SCHEMA } from './taxonomy.ts';
import type {
  Alpha14CommitteeArtifact,
  AlphaEvidenceDomainBlock,
  AlphaEvidenceThesis,
  EvidenceStrengthLabel,
  FrozenAlphaEvidencePack,
  AlphaPerformanceClaimEnvelope,
} from './types.ts';
import { textViolatesAlpha14AuthorityGuard } from './artifact-validation.ts';

function hashSegment(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

function mergeStrings(primary: string | undefined, fallback: string): string {
  const t = (primary ?? '').trim();
  return t.length > 0 ? t : fallback;
}

function mergeUnique(lines: readonly (readonly string[] | undefined)[]): readonly string[] {
  const set = new Set<string>();
  for (const group of lines) {
    if (!group) continue;
    for (const line of group) {
      if (line.trim()) set.add(line.trim());
    }
  }
  return Object.freeze([...set]);
}

function pickDomainBlock(
  artifacts: readonly Alpha14CommitteeArtifact[],
  key: 'statisticalEvidence' | 'implementationEvidence' | 'regimeEvidence' | 'capacityEvidence',
  fallback: AlphaEvidenceDomainBlock,
): AlphaEvidenceDomainBlock {
  for (const art of [...artifacts].reverse()) {
    const block = art.extraction?.[key];
    if (block) return block;
  }
  return fallback;
}

function evidenceStrength(input: {
  readonly artifacts: readonly Alpha14CommitteeArtifact[];
  readonly claim: AlphaPerformanceClaimEnvelope;
  readonly unsupported: readonly string[];
}): EvidenceStrengthLabel {
  const skepticFails = input.artifacts.filter(
    (row) =>
      ['STATISTICAL_SKEPTIC', 'MULTIPLE_TESTING_AUDITOR', 'COUNTERFACTUAL_SKEPTIC'].includes(row.role) &&
      row.contradictingEvidence.length >= 2,
  ).length;
  if (input.claim.observationWindowDays < 60 || skepticFails >= 2) return 'INSUFFICIENT';
  if (input.unsupported.length >= 4 || input.claim.independentTrialCount > 50) return 'WEAK';
  if (input.unsupported.length >= 2) return 'MODERATE';
  return 'MODERATE';
}

export function buildAlphaEvidenceThesis(input: {
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly strategyRef: string;
  readonly informationTime: UtcInstant;
  readonly pack: FrozenAlphaEvidencePack;
  readonly performanceClaim: AlphaPerformanceClaimEnvelope;
  readonly artifacts: readonly Alpha14CommitteeArtifact[];
}): AlphaEvidenceThesis {
  const synthesis = input.artifacts.find((row) => row.role === 'ALPHA_EVIDENCE_SYNTHESIS');

  const supportedClaims = mergeUnique([
    input.artifacts.flatMap((row) => row.extraction?.supportedClaims ?? []),
    synthesis?.supportingEvidence,
  ]);

  const unsupportedClaims = mergeUnique([
    input.artifacts.flatMap((row) => row.extraction?.unsupportedClaims ?? []),
    input.artifacts.flatMap((row) => row.extraction?.rejectReasons ?? []),
    input.artifacts.flatMap((row) => row.contradictingEvidence),
  ]);

  const contradictions = mergeUnique([
    input.artifacts.flatMap((row) => row.extraction?.contradictions ?? []),
    input.artifacts.flatMap((row) => row.contradictingEvidence),
  ]);

  const limitations = mergeUnique([
    input.artifacts.flatMap((row) => row.extraction?.limitations ?? []),
    Object.freeze([
      'Simulation ENVIRONMENT only; no live trading authority',
      'Committee may not alter statistical gates or waive mandated evidence gates',
    ]),
  ]);

  const recommendedNextEvidence =
    synthesis?.extraction?.recommendedNextEvidence ??
    Object.freeze([
      'Sealed holdout performance with trial genealogy',
      'Conservative execution and cost stress',
    ]);

  const statisticalEvidence = pickDomainBlock(input.artifacts, 'statisticalEvidence', {
    domain: 'statistical',
    status: 'WARN',
    summary: 'Statistical support provisional; reject-first skeptics did not clear upgrade',
    detailRefs: Object.freeze([`claim:${input.performanceClaim.claimId}`]),
  });

  const implementationEvidence = pickDomainBlock(input.artifacts, 'implementationEvidence', {
    domain: 'implementation',
    status: input.performanceClaim.costsModeled ? 'WARN' : 'FAIL',
    summary: mergeStrings(
      undefined,
      input.performanceClaim.costsModeled
        ? 'Costs modeled in simulation; live erosion unverified'
        : 'Execution and cost assumptions may have created apparent edge',
    ),
    detailRefs: Object.freeze([input.performanceClaim.executionAssumptionRef]),
  });

  const regimeEvidence = pickDomainBlock(input.artifacts, 'regimeEvidence', {
    domain: 'regime',
    status: input.performanceClaim.dominantRegimeTag ? 'WARN' : 'UNKNOWN',
    summary: input.performanceClaim.dominantRegimeTag
      ? 'Possible single-regime dependence'
      : 'Regime robustness not demonstrated',
    detailRefs: Object.freeze(
      input.performanceClaim.dominantRegimeTag ? [input.performanceClaim.dominantRegimeTag] : [],
    ),
  });

  const capacityEvidence = pickDomainBlock(input.artifacts, 'capacityEvidence', {
    domain: 'capacity',
    status: 'UNKNOWN',
    summary: 'Scalability and capacity cliff not fully evidenced',
    detailRefs: Object.freeze([`strategy:${input.strategyRef}`]),
  });

  const strength = evidenceStrength({
    artifacts: input.artifacts,
    claim: input.performanceClaim,
    unsupported: unsupportedClaims,
  });

  const rejectsPerformanceUpgrade =
    strength === 'INSUFFICIENT' ||
    strength === 'WEAK' ||
    unsupportedClaims.length >= 3 ||
    input.performanceClaim.decaySignalClaimed ||
    input.performanceClaim.independentTrialCount > 50;

  const thesisId = `aet_${hashSegment(`${input.workOrderId}:${input.pack.contentHash}:${input.informationTime}`)}`;

  const thesisBody = [
    ...supportedClaims,
    ...unsupportedClaims,
    ...contradictions,
    statisticalEvidence.summary,
    implementationEvidence.summary,
  ].join(' ');

  if (textViolatesAlpha14AuthorityGuard(thesisBody)) {
    throw new Error('LANGUAGE_GUARD_VIOLATION: thesis body failed ALPHA14 authority guard');
  }

  const questionsAddressed = Object.freeze(
    [...new Set(input.artifacts.flatMap((row) => row.questionsAddressed))].filter((q) =>
      (ALPHA14_EVIDENCE_QUESTIONS as readonly string[]).includes(q),
    ) as (typeof ALPHA14_EVIDENCE_QUESTIONS)[number][],
  );

  return Object.freeze({
    thesisId,
    schema: ALPHA_EVIDENCE_COMMITTEE_SCHEMA,
    workOrderId: input.workOrderId,
    subjectId: input.subjectId,
    strategyRef: input.strategyRef,
    supportedClaims,
    unsupportedClaims,
    evidenceStrength: strength,
    statisticalEvidence,
    implementationEvidence,
    regimeEvidence,
    capacityEvidence,
    contradictions,
    limitations,
    recommendedNextEvidence: Object.freeze([...recommendedNextEvidence]),
    questionsAddressed,
    evidenceRefs: Object.freeze(input.pack.evidence.map((row) => row.evidenceId)),
    rejectsPerformanceUpgrade,
    simulationOnly: true as const,
    grantsFinancialAuthority: false as const,
    issuesOrders: false as const,
    activatesCapital: false as const,
  });
}
