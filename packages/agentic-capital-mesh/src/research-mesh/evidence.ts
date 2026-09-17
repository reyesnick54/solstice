import type { EvidenceReference, SpecialistRecommendation, SpecialistTaskInput, SpecialistTaskOutput } from './types.ts';
import type { ModelRouteDecision } from './model-routing.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';

export type AssertionClaim = {
  readonly claimId: string;
  readonly statement: string;
  readonly evidenceIds: readonly string[];
};

export function verifyAssertions(input: {
  readonly claims: readonly AssertionClaim[];
  readonly evidenceBundle: readonly EvidenceReference[];
  readonly now: UtcInstant;
}): {
  readonly supported: readonly string[];
  readonly unsupported: readonly string[];
  readonly stale: readonly string[];
  readonly recommendation: SpecialistRecommendation;
} {
  const supported: string[] = [];
  const unsupported: string[] = [];
  const stale: string[] = [];

  for (const claim of input.claims) {
    if (claim.evidenceIds.length === 0) {
      unsupported.push(claim.claimId);
      continue;
    }
    const refs = input.evidenceBundle.filter((row) => claim.evidenceIds.includes(row.evidenceId));
    if (refs.length === 0) {
      unsupported.push(claim.claimId);
      continue;
    }
    const allFresh = refs.every((row) => row.freshnessOk && row.entitlementOk);
    if (!allFresh) {
      stale.push(claim.claimId);
      continue;
    }
    supported.push(claim.claimId);
  }

  const recommendation: SpecialistRecommendation =
    unsupported.length > 0 ? 'OPPOSE' : stale.length > 0 ? 'WAIT' : supported.length > 0 ? 'SUPPORT' : 'INVESTIGATE';

  return Object.freeze({
    supported: Object.freeze(supported),
    unsupported: Object.freeze(unsupported),
    stale: Object.freeze(stale),
    recommendation,
  });
}

export function buildEvidenceVerifierOutput(input: {
  readonly task: SpecialistTaskInput;
  readonly route: ModelRouteDecision;
  readonly startedAt: UtcInstant;
  readonly completedAt: UtcInstant;
  readonly claims: readonly AssertionClaim[];
}): SpecialistTaskOutput {
  const verification = verifyAssertions({
    claims: input.claims,
    evidenceBundle: input.task.evidenceBundle,
    now: input.completedAt,
  });

  return Object.freeze({
    outputId: `cmout_ev_${input.task.taskId}`,
    taskId: input.task.taskId,
    workOrderId: input.task.workOrderId,
    subjectId: input.task.subjectId,
    specialistRole: 'EVIDENCE_VERIFIER',
    task: 'verify-assertions',
    model: Object.freeze({
      provider: input.route.provider,
      modelId: input.route.modelId,
      version: input.route.version,
    }),
    toolsUsed: Object.freeze(['getMarketSnapshot', 'getMandate']),
    evidenceReferences: Object.freeze([...input.task.evidenceBundle]),
    findings: Object.freeze([
      `supported=${verification.supported.join(',') || 'none'}`,
      `unsupported=${verification.unsupported.join(',') || 'none'}`,
      `stale=${verification.stale.join(',') || 'none'}`,
    ]),
    assumptions: Object.freeze(['Evidence bundle is the authoritative provenance set for this task.']),
    contradictions: Object.freeze(
      verification.unsupported.length > 0
        ? ['At least one assertion lacks valid evidence and remains unsupported.']
        : [],
    ),
    confidence: verification.unsupported.length > 0 ? 0.2 : verification.stale.length > 0 ? 0.5 : 0.85,
    invalidatingConditions: Object.freeze(['New contradictory evidence', 'Entitlement revocation']),
    missingInformation: Object.freeze(
      verification.unsupported.length > 0 ? ['Provenance for unsupported assertions'] : [],
    ),
    recommendation: verification.recommendation,
    usage: Object.freeze({
      inputTokens: 120,
      outputTokens: 80,
      inferenceCalls: 0,
      toolCalls: 2,
      costMicros: 15_000n,
      currency: 'USD',
    }),
    timestamps: Object.freeze({ startedAt: input.startedAt, completedAt: input.completedAt }),
    lineage: Object.freeze({
      modelProvider: input.route.provider,
      modelId: input.route.modelId,
      modelVersion: input.route.version,
      promptTemplateId: input.route.promptTemplateId,
      promptTemplateVersion: input.route.promptTemplateVersion,
      sharedEvidenceIds: Object.freeze(input.task.evidenceBundle.map((row) => row.evidenceId)),
      sharedUpstreamSourceRefs: Object.freeze(input.task.evidenceBundle.map((row) => row.sourceRef)),
      toolLineage: Object.freeze(['evidence-verifier/v1']),
    }),
    taskState: 'SUCCEEDED',
    grantsFinancialAuthority: false as const,
  });
}
