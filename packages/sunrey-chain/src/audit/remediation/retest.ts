import { hashCanonical } from './chain.ts';
import type {
  ActorKind,
  ExternalSecurityFinding,
  FindingRegressionEvidence,
  FindingRemediationEvidence,
  FindingRetestRequest,
  FindingRetestResult,
  RetestOutcome,
} from './types.ts';

export function createRetestRequest(input: {
  readonly requestId: string;
  readonly finding: ExternalSecurityFinding;
  readonly originalReportReference: string;
  readonly remediated: FindingRemediationEvidence;
  readonly regression: FindingRegressionEvidence;
  readonly formalEvidence?: string | null;
  readonly fuzzEvidence?: string | null;
  readonly rangeEvidence?: string | null;
}): FindingRetestRequest {
  if (input.finding.affectedCommit === input.remediated.remediatedCommit) {
    throw new Error('retest package requires a remediated commit distinct from the affected commit');
  }
  return Object.freeze({
    requestId: input.requestId,
    findingId: input.finding.findingId,
    originalReportReference: input.originalReportReference,
    affectedOldCommit: input.finding.affectedCommit,
    remediatedCommit: input.remediated.remediatedCommit,
    patchDigest: input.remediated.patchDigest,
    regressionTest: input.regression.testReference,
    formalEvidence: input.formalEvidence ?? input.regression.formalReference,
    fuzzEvidence: input.fuzzEvidence ?? input.regression.fuzzCorpusReference,
    rangeEvidence: input.rangeEvidence ?? input.regression.adversarialScenarioId,
    buildInstructions: 'npm ci && npm run test:formal-smoke && npm run test:fuzz-smoke && npm run sunrey-range -- campaign --smoke',
    reproductionInstructions: `npm run sunrey-audit -- finding reproduce ${input.finding.findingId}`,
  });
}

export function recordRetestResult(input: {
  readonly resultId: string;
  readonly request: FindingRetestRequest;
  readonly reviewerIdentityReference: string;
  readonly dateUtc: string;
  readonly scope: string;
  readonly result: RetestOutcome;
  readonly reportDigest: string;
  readonly actor: ActorKind;
  readonly boundCommit: string;
  readonly softwareGenerated?: boolean;
}): FindingRetestResult {
  if (input.softwareGenerated === true || input.actor === 'AI') {
    throw new Error('software cannot generate an external-pass record itself');
  }
  if (input.actor !== 'HUMAN') {
    throw new Error('FindingRetestResult requires a human reviewer identity');
  }
  if (!input.reviewerIdentityReference.trim() || !input.reportDigest.trim()) {
    throw new Error('FindingRetestResult requires reviewer identity, date, scope, result, and report digest');
  }
  if (input.boundCommit !== input.request.remediatedCommit) {
    throw new Error('a retest for commit A cannot automatically clear the same finding on unrelated commit B');
  }
  return Object.freeze({
    resultId: input.resultId,
    requestId: input.request.requestId,
    findingId: input.request.findingId,
    reviewerIdentityReference: input.reviewerIdentityReference,
    dateUtc: input.dateUtc,
    scope: input.scope,
    result: input.result,
    reportDigest: input.reportDigest,
    humanEvidenceVerification: true,
    softwareGenerated: false,
    boundCommit: input.boundCommit,
  });
}

export function rejectTamperedRetest(
  result: FindingRetestResult,
  expectedDigest: string,
): void {
  if (result.reportDigest !== expectedDigest) {
    throw new Error('tampered retest result rejected');
  }
}

export function retestCompatibilityExplicit(
  result: FindingRetestResult,
  futureCommit: string,
  explicitCompatibility: boolean,
): boolean {
  if (result.boundCommit === futureCommit) {
    return true;
  }
  return explicitCompatibility;
}

export function retestRequestDigest(request: FindingRetestRequest): string {
  return hashCanonical(request);
}
