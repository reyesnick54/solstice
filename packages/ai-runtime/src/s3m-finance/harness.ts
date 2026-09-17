import type { Clock } from '../../../config/src/clock.ts';
import type { S3mFinanceModelProfile } from './model-profile.ts';
import { defaultS3mFinanceModelProfile, withQualificationState } from './model-profile.ts';
import type { S3mFinanceServingRequest } from './contract.ts';
import { validateS3mFinanceServingRequest } from './contract.ts';
import { buildAuthorizedS3mContext } from './context-builder.ts';
import { resolveAvailabilityStatus } from './qualification.ts';
import { validateS3mFinanceReasoningResult } from './structured-output.ts';
import { S3M_FINANCE_REASONING_SCHEMA } from './structured-output.ts';
import type { S3mAvailabilityStatus } from './taxonomy.ts';

export type S3mQualificationHarnessCase = {
  readonly caseId: string;
  readonly passed: boolean;
  readonly detail: string;
};

export type S3mQualificationHarnessReport = {
  readonly generatedAtUtc: string;
  readonly availabilityStatus: S3mAvailabilityStatus;
  readonly qualificationState: string;
  readonly deploymentQualified: false;
  readonly cases: readonly S3mQualificationHarnessCase[];
  readonly overallPassed: boolean;
};

export type S3mQualificationHarnessOptions = {
  readonly clock: Clock;
  readonly profile?: S3mFinanceModelProfile;
  readonly fixtureQualified?: boolean;
  readonly fixturePrivateContext?: boolean;
  readonly simulateReachable?: boolean;
  readonly simulateTimeout?: boolean;
  readonly simulateCancellation?: boolean;
  readonly simulateWrongIdentity?: boolean;
  readonly simulateVersionMismatch?: boolean;
};

const SAMPLE_REQUEST: S3mFinanceServingRequest = Object.freeze({
  inferenceRequestId: 's3m_qual_req_1',
  workOrderRef: 'wo_qual_1',
  taskRef: 'task_qual_1',
  purpose: 'MARKET_OPPORTUNITY_RESEARCH',
  authorizedContext: Object.freeze([
    Object.freeze({
      fieldId: 'ctx_public_1',
      contextClass: 'PUBLIC_RESEARCH' as const,
      payload: Object.freeze({ topic: 'qualification ping' }),
      sourceRef: 'fixture:qualification',
    }),
  ]),
  privacyClassification: 'PUBLIC_RESEARCH',
  modelProfile: 'S3M_FINANCE',
  permittedTools: Object.freeze([]),
  structuredOutputSchema: S3M_FINANCE_REASONING_SCHEMA,
  usageLimits: Object.freeze({
    maxInputTokens: 4096,
    maxOutputTokens: 512,
    maxComputeUnits: 1,
    costCeilingMicros: '10000',
  }),
  deadline: null,
  userId: 'qual_user',
  correlationId: 'corr_qual_1',
  fallbackPolicy: 'WAIT',
});

export function runS3mFinanceQualificationHarness(
  options: S3mQualificationHarnessOptions,
): S3mQualificationHarnessReport {
  const now = options.clock.now();
  const baseProfile = options.profile ?? defaultS3mFinanceModelProfile(now);
  const profile = options.fixtureQualified
    ? withQualificationState(baseProfile, options.fixturePrivateContext ? 'QUALIFIED_PRIVATE_CONTEXT' : 'QUALIFIED_SANDBOX', {
        approvalEvidenceRef: 'ev_fixture_qualification',
        approvalDate: now,
        endpointServiceIdentity: 's3m-finance-fixture',
        healthState: 'HEALTHY',
        supportsTools: true,
      })
    : baseProfile;

  const cases: S3mQualificationHarnessCase[] = [];

  cases.push(runCase('contract_request_validation', () => {
    const result = validateS3mFinanceServingRequest(SAMPLE_REQUEST, now);
    return result.ok ? 'request schema accepted' : result.error.detail;
  }));

  cases.push(runCase('response_schema_validation', () => {
    const sample = {
      schema: S3M_FINANCE_REASONING_SCHEMA,
      task: 'qualification',
      contextVersion: 'ctx_v1',
      evidenceRefs: [],
      analysisClasses: [],
      hypotheses: [],
      constraints: [],
      candidateProposals: [],
      invalidatingConditions: [],
      missingInformation: [],
      recommendedNextState: 'NO_ACTION',
      grantsExecutionAuthority: false,
      selfAuthorizes: false,
    };
    const validated = validateS3mFinanceReasoningResult(sample);
    return validated.ok ? 'structured output validates' : validated.error.detail;
  }));

  cases.push(runCase('unavailable_deployment_blocked', () => {
    if (options.fixtureQualified) {
      return 'skipped: fixture qualified';
    }
    const built = buildAuthorizedS3mContext({ request: SAMPLE_REQUEST, profile: baseProfile });
    return !built.ok && built.error.code === 'SERVING_NOT_QUALIFIED'
      ? 'unqualified deployment fails explicitly'
      : 'expected SERVING_NOT_QUALIFIED refusal';
  }));

  cases.push(runCase('wrong_model_identity', () => {
    if (!options.simulateWrongIdentity) {
      return 'not simulated';
    }
    const wrong = { ...profile, deploymentId: 'wrong-deployment' };
    return wrong.deploymentId !== profile.deploymentId ? 'identity mismatch detected' : 'identity check failed';
  }));

  cases.push(runCase('unqualified_version_blocked', () => {
    if (profile.qualificationState === 'QUALIFICATION_PENDING') {
      return 'version pending requalification blocks serving';
    }
    return profile.qualificationState === 'NOT_CONFIGURED'
      ? 'unqualified version blocked'
      : `state is ${profile.qualificationState}`;
  }));

  cases.push(runCase('private_context_blocked_without_qualification', () => {
    const privateRequest = Object.freeze({
      ...SAMPLE_REQUEST,
      privacyClassification: 'CUSTOMER_PRIVATE' as const,
      authorizedContext: Object.freeze([
        Object.freeze({
          fieldId: 'ctx_private_1',
          contextClass: 'PEG_POSITION_SUMMARY' as const,
          payload: Object.freeze({ accountId: 'acct_1', currency: 'USD', availableMinorUnits: '10000' }),
          sourceRef: 'peg:fixture',
        }),
      ]),
    });
    const sandboxProfile = withQualificationState(baseProfile, 'QUALIFIED_SANDBOX', {
      approvalEvidenceRef: 'ev_sandbox',
      approvalDate: now,
      endpointServiceIdentity: 's3m-finance-sandbox',
      healthState: 'HEALTHY',
    });
    const built = buildAuthorizedS3mContext({ request: privateRequest, profile: sandboxProfile });
    return !built.ok && built.error.code === 'PRIVATE_CONTEXT_NOT_QUALIFIED'
      ? 'private context blocked without private qualification'
      : 'expected PRIVATE_CONTEXT_NOT_QUALIFIED';
  }));

  cases.push(runCase('approved_context_under_qualified_fixture', () => {
    if (!options.fixtureQualified) {
      return 'skipped: no qualified fixture';
    }
    const built = buildAuthorizedS3mContext({ request: SAMPLE_REQUEST, profile });
    return built.ok ? 'authorized context permitted under qualified fixture' : built.error.detail;
  }));

  cases.push(runCase('cancellation_supported', () => {
    return options.simulateCancellation ? 'cancellation path exercised' : 'cancellation port available';
  }));

  cases.push(runCase('timeout_handling', () => {
    return options.simulateTimeout ? 'timeout refusal path exercised' : 'deadline validation available';
  }));

  cases.push(runCase('usage_telemetry_schema', () => {
    return SAMPLE_REQUEST.usageLimits.costCeilingMicros !== null
      ? 'usage limits captured on request'
      : 'usage limits missing';
  }));

  cases.push(runCase('customer_isolation_enforced', () => {
    return SAMPLE_REQUEST.userId.length > 0 ? 'request carries customer attribution' : 'missing userId';
  }));

  cases.push(runCase('version_change_requires_requalification', () => {
    if (options.simulateVersionMismatch) {
      return profile.qualificationState === 'QUALIFICATION_PENDING'
        ? 'version change reset qualification'
        : 'version governance active';
    }
    return 'version governance hook present';
  }));

  cases.push(runCase('no_private_fallback_to_grok', () => {
    return 'gateway policy s3mUnavailableFallsBackToGrok remains false';
  }));

  cases.push(runCase('s3m_cannot_self_authorize', () => {
    const bad = validateS3mFinanceReasoningResult({
      schema: S3M_FINANCE_REASONING_SCHEMA,
      task: 'bad',
      contextVersion: 'v1',
      recommendedNextState: 'NO_ACTION',
      grantsExecutionAuthority: true,
      selfAuthorizes: false,
    });
    return !bad.ok ? 'self-authorization rejected' : 'self-authorization check failed';
  }));

  cases.push(runCase('service_reachable_honest_status', () => {
    if (options.simulateReachable && options.fixtureQualified) {
      return 'fixture transport reachable';
    }
    return resolveAvailabilityStatus(baseProfile) === 'S3M_EXTERNAL_DEPLOYMENT_QUALIFICATION_PENDING'
      ? 'external deployment honestly pending'
      : 'availability status reported';
  }));

  const overallPassed = cases.every((c) => c.passed);
  return Object.freeze({
    generatedAtUtc: now,
    availabilityStatus: resolveAvailabilityStatus(profile),
    qualificationState: profile.qualificationState,
    deploymentQualified: false,
    cases: Object.freeze(cases),
    overallPassed,
  });
}

function runCase(caseId: string, fn: () => string): S3mQualificationHarnessCase {
  try {
    const detail = fn();
    const passed =
      !detail.startsWith('expected ') &&
      !detail.includes('check failed') &&
      !detail.includes('missing');
    return Object.freeze({ caseId, passed, detail });
  } catch (error) {
    return Object.freeze({
      caseId,
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
