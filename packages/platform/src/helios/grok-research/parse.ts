import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { randomUUID } from 'node:crypto';
import type {
  GrokResearchResult,
  GrokResearchUsage,
  HeliosResearchTaskInput,
  ResearchAssertion,
  ResearchCandidateRef,
  ResearchEvidenceRef,
  ResearchHypothesis,
} from './types.ts';
import { GROK_RESEARCH_SCHEMA_VERSION } from './taxonomy.ts';
import type { ResearchCompletionStatus, ResearchRecommendationClass } from './taxonomy.ts';
import type { ResearchToolCallRecord } from './types.ts';
import type { SanitizedResearchContext } from './context-sanitizer.ts';
import {
  bindAssertionToEvidence,
  collectKnownEvidenceIds,
  evidenceRefFromToolCall,
  modelCannotSelfVerify,
} from './evidence-binding.ts';

export function buildGrokResearchResult(input: {
  readonly task: HeliosResearchTaskInput;
  readonly context: SanitizedResearchContext;
  readonly toolRecords: readonly ResearchToolCallRecord[];
  readonly usage: GrokResearchUsage;
  readonly provider: string;
  readonly model: string;
  readonly modelVersion: string;
  readonly synthesis: string | null;
  readonly completionStatus: ResearchCompletionStatus;
  readonly recommendation: ResearchRecommendationClass;
  readonly startedAt: UtcInstant;
  readonly completedAt: UtcInstant;
}): GrokResearchResult {
  const evidenceRefs: ResearchEvidenceRef[] = [];
  for (const record of input.toolRecords) {
    const ref = evidenceRefFromToolCall(record, input.completedAt);
    if (ref) evidenceRefs.push(ref);
  }

  const knownIds = collectKnownEvidenceIds(
    input.task.existingEvidenceRefs,
    input.toolRecords,
    evidenceRefs,
  );

  const keyFacts: ResearchAssertion[] = [];
  for (const record of input.toolRecords) {
    if (record.authorization !== 'ALLOWED' || !record.resultEvidenceRef) continue;
    const payload = record.resultPayload;
    if (payload?.symbol) {
      keyFacts.push(bindAssertionToEvidence({
        assertionId: `assert_${record.request.requestId}`,
        kind: 'FACT',
        statement: `Market observation available for ${payload.symbol}`,
        citedEvidenceIds: Object.freeze([record.resultEvidenceRef]),
        knownEvidenceIds: knownIds,
        contradictedPairs: new Map(),
      }));
    }
    if (payload?.query) {
      keyFacts.push(bindAssertionToEvidence({
        assertionId: `assert_econ_${record.request.requestId}`,
        kind: 'INFERENCE',
        statement: `Economic search returned results for public query`,
        citedEvidenceIds: Object.freeze([record.resultEvidenceRef]),
        knownEvidenceIds: knownIds,
        contradictedPairs: new Map(),
      }));
    }
  }

  const contradictions: ResearchAssertion[] = [];
  const hypotheses: ResearchHypothesis[] = [
    Object.freeze({
      hypothesisId: `hyp_${randomUUID().slice(0, 8)}`,
      statement: `Public macro drivers may affect ${input.context.question}`,
      evidenceRefs: Object.freeze(evidenceRefs.map((e) => e.evidenceId)),
      invalidatingConditions: Object.freeze(['contradictory central bank guidance', 'stale liquidity data']),
      confidenceBand: 'LOW',
    }),
  ];

  const candidateRefs: ResearchCandidateRef[] = [];
  if (input.recommendation === 'PROPOSE_CANDIDATE' && input.task.candidateOpportunityKey) {
    candidateRefs.push(Object.freeze({
      candidateKey: input.task.candidateOpportunityKey,
      hypothesisId: hypotheses[0]?.hypothesisId ?? null,
      instrumentSymbol: 'USD',
      evidenceRefs: Object.freeze(evidenceRefs.map((e) => e.evidenceId)),
    }));
  }

  const verifiedFacts = keyFacts.map((fact) =>
    modelCannotSelfVerify(fact, !fact.unsupported && fact.evidenceRefs.length > 0),
  );

  return Object.freeze({
    schemaVersion: GROK_RESEARCH_SCHEMA_VERSION,
    researchResultId: `grr_${randomUUID()}`,
    workOrderId: input.task.workOrderId,
    taskId: input.task.taskId,
    customerId: input.task.customerId,
    provider: input.provider,
    model: input.model,
    modelVersion: input.modelVersion,
    question: input.context.question,
    privacyClass: 'PUBLIC',
    evidenceRefs: Object.freeze(evidenceRefs),
    keyFacts: Object.freeze(verifiedFacts),
    contradictions: Object.freeze(contradictions),
    hypotheses: Object.freeze(hypotheses),
    candidateRefs: Object.freeze(candidateRefs),
    invalidatingConditions: Object.freeze(['material contradictory evidence', 'budget revalidation failure']),
    missingEvidence: Object.freeze([]),
    calibrationBand: 'SIMULATION',
    recommendation: input.recommendation,
    usage: input.usage,
    narrativeSummary: input.synthesis,
    completionStatus: input.completionStatus,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    grantsExecutionAuthority: false,
    grantsFinancialMutation: false,
  });
}

export function parseGrokResearchResult(value: unknown): Result<GrokResearchResult, string> {
  if (!value || typeof value !== 'object') return err('result must be an object');
  const root = value as Record<string, unknown>;
  if (root.schemaVersion !== GROK_RESEARCH_SCHEMA_VERSION) return err('unsupported schema');
  if (root.grantsExecutionAuthority === true || root.grantsFinancialMutation === true) {
    return err('research result cannot grant authority or mutation');
  }
  return ok(root as unknown as GrokResearchResult);
}
