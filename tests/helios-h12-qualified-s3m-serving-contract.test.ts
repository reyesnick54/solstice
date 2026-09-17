import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { asModelId, asModelVersion } from '../packages/model-registry/src/ids.ts';
import { err, ok } from '../packages/domain/src/result.ts';
import {
  S3M_FINANCE_MODEL_ID,
  S3M_FINANCE_MODEL_VERSION,
  S3M_FINANCE_REASONING_SCHEMA,
  S3mFinanceServingService,
  approveQualification,
  attributeS3mResearchUsage,
  buildAuthorizedS3mContext,
  defaultS3mFinanceModelProfile,
  onModelVersionChange,
  resolveAvailabilityStatus,
  runS3mFinanceQualificationHarness,
  validateS3mFinanceReasoningResult,
  validateS3mFinanceServingRequest,
  withQualificationState,
  type S3mFinanceServingRequest,
  type S3mModelGatewayPort,
} from '../packages/ai-runtime/src/s3m-finance/index.ts';
import { createDefaultAiRuntimePolicy } from '../packages/ai-runtime/src/policy.ts';
import type { AiGatewayRequest, AiGatewayResult } from '../packages/ai-runtime/src/gateway.ts';
import { S3M_PROVIDER_ID } from '../packages/ai-runtime/src/providers/s3m/normalization.ts';
import type { AiProviderFailure } from '../packages/ai-runtime/src/types.ts';
import { createHeliosS3mServingRoute } from '../packages/ai-runtime/src/integrations/helios-s3m-serving.ts';
import { heliosS3mSpendBridge } from '../packages/platform/src/helios/s3m-serving/index.ts';
import { asEconomicWorkOrderId, asHeliosProgramId, asHeliosTaskId } from '../packages/platform/src/helios/ids.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-16T15:00:00.000Z');

function sampleRequest(overrides: Partial<S3mFinanceServingRequest> = {}): S3mFinanceServingRequest {
  return Object.freeze({
    inferenceRequestId: overrides.inferenceRequestId ?? 'inf_h12_1',
    workOrderRef: overrides.workOrderRef ?? 'wo_h12_1',
    taskRef: overrides.taskRef ?? 'task_h12_1',
    purpose: overrides.purpose ?? 'MARKET_OPPORTUNITY_RESEARCH',
    authorizedContext:
      overrides.authorizedContext ??
      Object.freeze([
        Object.freeze({
          fieldId: 'ctx_1',
          contextClass: 'PUBLIC_RESEARCH' as const,
          payload: Object.freeze({ topic: 'macro outlook' }),
          sourceRef: 'fixture:public',
        }),
      ]),
    privacyClassification: overrides.privacyClassification ?? 'PUBLIC_RESEARCH',
    modelProfile: 'S3M_FINANCE',
    permittedTools: Object.freeze([]),
    structuredOutputSchema: S3M_FINANCE_REASONING_SCHEMA,
    usageLimits: Object.freeze({
      maxInputTokens: 4096,
      maxOutputTokens: 512,
      maxComputeUnits: 1,
      costCeilingMicros: '50000',
    }),
    deadline: overrides.deadline ?? null,
    userId: overrides.userId ?? 'cust_h12',
    correlationId: overrides.correlationId ?? 'corr_h12',
    fallbackPolicy: overrides.fallbackPolicy ?? 'WAIT',
  });
}

function validReasoningJson() {
  return JSON.stringify({
    schema: S3M_FINANCE_REASONING_SCHEMA,
    task: 'market scan',
    contextVersion: 'ctx_v1',
    evidenceRefs: ['ev_1'],
    analysisClasses: ['MACRO'],
    hypotheses: ['rates may fall'],
    constraints: ['simulation only'],
    candidateProposals: [],
    invalidatingConditions: ['inflation spike'],
    missingInformation: [],
    recommendedNextState: 'INVESTIGATE',
    grantsExecutionAuthority: false,
    selfAuthorizes: false,
  });
}

function fixtureGateway(input?: {
  readonly unavailable?: boolean;
  readonly wrongModel?: boolean;
  readonly cancelled?: boolean;
}): S3mModelGatewayPort {
  const cancelled = new Set<string>();
  return {
    cancel(requestId: string) {
      cancelled.add(requestId);
      return true;
    },
    infer(request: AiGatewayRequest): ReturnType<S3mModelGatewayPort['infer']> {
      if (cancelled.has(request.requestId) || request.cancel?.cancelled) {
        return err({
          ok: false,
          code: 'MODEL_CANCELLED',
          detail: 'cancelled',
          providerKind: 'S3M',
        });
      }
      if (input?.unavailable) {
        return err({
          ok: false,
          code: 'MODEL_UNAVAILABLE',
          detail: 'deployment unavailable',
          providerKind: 'S3M',
        });
      }
      const modelId = input?.wrongModel ? asModelId('mdl_wrong') : S3M_FINANCE_MODEL_ID;
      const version = input?.wrongModel ? asModelVersion('wrong-v1') : S3M_FINANCE_MODEL_VERSION;
      const response = Object.freeze({
        response: Object.freeze({
          requestId: request.requestId,
          providerId: S3M_PROVIDER_ID,
          providerKind: 'S3M' as const,
          modelRef: Object.freeze({ modelId, version }),
          text: validReasoningJson(),
          structured: null,
          toolIntents: Object.freeze([]),
          usage: Object.freeze({
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
            latencyMs: 25,
            estimatedCostMicros: '1200',
          }),
          grantsExecutionAuthority: false,
        }),
        runtime: null,
        events: Object.freeze([]),
        sse: '',
        provenance: null,
        usage: Object.freeze({
          provider: 'S3M',
          model: String(modelId),
          inputTokens: 100,
          outputTokens: 50,
          latencyMs: 25,
          estimatedCostMicros: '1200',
          agentId: null,
          userId: request.userId,
          conversationId: request.conversationId,
          purpose: request.purpose,
          recordedAt: NOW,
          postedToCustomerLedger: false,
        }),
        model: Object.freeze({
          modelId,
          provider: 'S3M',
          providerModel: 's3m-finance',
          version,
          capabilities: Object.freeze([]),
          contextWindow: 32768,
          supportsStreaming: false,
          supportsTools: false,
          supportsStructuredOutput: true,
          approvedPurposes: Object.freeze(['MARKET_OPPORTUNITY_RESEARCH']),
          environment: 'SANDBOX',
          status: 'TEST',
          cost: Object.freeze({ inputMicrosPer1kTokens: 60, outputMicrosPer1kTokens: 120, currency: 'USD' }),
          latencyClass: 'STANDARD',
          dataHandling: Object.freeze(['PUBLIC']),
          jurisdictionRestrictions: Object.freeze([]),
          liveApproved: false,
        }),
        fallbackUsed: false,
        fallbackProvenance: null,
        financialExecuted: false,
        productionActive: false,
        liveConnectivityEnabled: false,
      });
      return ok(response as AiGatewayResult);
    },
  };
}

function qualifiedProfile() {
  const base = defaultS3mFinanceModelProfile(NOW);
  return approveQualification(base, {
    state: 'QUALIFIED_SANDBOX',
    evidenceRef: 'ev_h12_fixture',
    approvalDate: NOW,
    endpointServiceIdentity: 's3m-finance-fixture',
  });
}

describe('HELIOS H12 — qualified S3M serving contract', () => {
  it('1. contract request validation', () => {
    const result = validateS3mFinanceServingRequest(sampleRequest(), NOW);
    assert.equal(result.ok, true);
    const bad = validateS3mFinanceServingRequest(
      Object.freeze({
        ...sampleRequest(),
        structuredOutputSchema: 'UNSUPPORTED_SCHEMA' as typeof S3M_FINANCE_REASONING_SCHEMA,
      }),
      NOW,
    );
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.equal(bad.error.code, 'UNSUPPORTED_SCHEMA');
    }
  });

  it('2. response schema validation', () => {
    const parsed = validateS3mFinanceReasoningResult(JSON.parse(validReasoningJson()));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.value.grantsExecutionAuthority, false);
      assert.equal(parsed.value.selfAuthorizes, false);
    }
  });

  it('3. unavailable deployment fails explicitly', () => {
    const clock = new FrozenClock(NOW);
    const service = new S3mFinanceServingService({
      clock,
      gateway: fixtureGateway({ unavailable: true }),
      profile: qualifiedProfile(),
    });
    const result = service.infer(sampleRequest());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.result, null);
      assert.equal(result.value.errorCode, 'MODEL_UNAVAILABLE');
    }
  });

  it('4. wrong model identity blocked', () => {
    const clock = new FrozenClock(NOW);
    const service = new S3mFinanceServingService({
      clock,
      gateway: fixtureGateway({ wrongModel: true }),
      profile: qualifiedProfile(),
    });
    const result = service.infer(sampleRequest());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.errorCode, 'MODEL_IDENTITY_MISMATCH');
      assert.equal(result.value.safetyStatus, 'REFUSED');
    }
  });

  it('5. unqualified version blocked', () => {
    const profile = defaultS3mFinanceModelProfile(NOW);
    assert.equal(profile.qualificationState, 'NOT_CONFIGURED');
    const built = buildAuthorizedS3mContext({ request: sampleRequest(), profile });
    assert.equal(built.ok, false);
    if (!built.ok) {
      assert.equal(built.error.code, 'SERVING_NOT_QUALIFIED');
    }
  });

  it('6. private context blocked without qualification', () => {
    const profile = withQualificationState(defaultS3mFinanceModelProfile(NOW), 'QUALIFIED_SANDBOX', {
      approvalEvidenceRef: 'ev_sandbox',
      approvalDate: NOW,
      endpointServiceIdentity: 's3m-finance-sandbox',
      healthState: 'HEALTHY',
    });
    const built = buildAuthorizedS3mContext({
      request: sampleRequest({
        privacyClassification: 'CUSTOMER_PRIVATE',
        authorizedContext: Object.freeze([
          Object.freeze({
            fieldId: 'peg_1',
            contextClass: 'PEG_POSITION_SUMMARY',
            payload: Object.freeze({
              accountId: 'acct_1',
              currency: 'USD',
              availableMinorUnits: '10000',
            }),
            sourceRef: 'peg:fixture',
          }),
        ]),
        purpose: 'PORTFOLIO_REASONING',
      }),
      profile,
    });
    assert.equal(built.ok, false);
    if (!built.ok) {
      assert.equal(built.error.code, 'PRIVATE_CONTEXT_NOT_QUALIFIED');
    }
  });

  it('7. approved context allowed under qualified fixture', () => {
    const built = buildAuthorizedS3mContext({
      request: sampleRequest(),
      profile: qualifiedProfile(),
    });
    assert.equal(built.ok, true);
    const clock = new FrozenClock(NOW);
    const service = new S3mFinanceServingService({
      clock,
      gateway: fixtureGateway(),
      profile: qualifiedProfile(),
    });
    const result = service.infer(sampleRequest());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.structuredOutputValid, true);
      assert.equal(result.value.safetyStatus, 'ACCEPTED');
    }
  });

  it('8. cancellation', () => {
    const clock = new FrozenClock(NOW);
    const gateway = fixtureGateway();
    const service = new S3mFinanceServingService({ clock, gateway, profile: qualifiedProfile() });
    assert.equal(service.cancel('inf_cancel_1'), true);
  });

  it('9. timeout via expired deadline', () => {
    const expired = validateS3mFinanceServingRequest(
      sampleRequest({ deadline: asUtcInstant('2026-09-16T14:00:00.000Z') }),
      NOW,
    );
    assert.equal(expired.ok, false);
    if (!expired.ok) {
      assert.equal(expired.error.code, 'DEADLINE_EXPIRED');
    }
  });

  it('10. usage accounting', () => {
    const attribution = attributeS3mResearchUsage({
      inferenceRequestId: 'inf_usage_1',
      workOrderRef: 'wo_1',
      taskRef: 'task_1',
      providerId: 'S3M',
      modelId: S3M_FINANCE_MODEL_ID,
      usage: Object.freeze({
        inputTokens: 100,
        outputTokens: 50,
        computeUnits: 1,
        gpuDurationMs: null,
        estimatedCostMicros: '1200',
        latencyMs: 30,
      }),
      recordedAt: NOW,
    });
    assert.equal(attribution.postedToCustomerLedger, false);
    assert.equal(attribution.workOrderRef, 'wo_1');
    const spend = heliosS3mSpendBridge.toResearchSpendRecord({
      attribution: Object.freeze({
        inferenceRequestId: attribution.inferenceRequestId,
        workOrderRef: attribution.workOrderRef,
        taskRef: attribution.taskRef,
        providerId: attribution.providerId,
        modelId: attribution.modelId,
        inputTokens: attribution.inputTokens,
        outputTokens: attribution.outputTokens,
        computeUnits: attribution.computeUnits,
        gpuDurationMs: attribution.gpuDurationMs,
        estimatedCostMicros: attribution.estimatedCostMicros,
        latencyMs: attribution.latencyMs,
        costStatus: attribution.costStatus,
        recordedAt: attribution.recordedAt,
        postedToCustomerLedger: false,
      }),
      workOrderId: asEconomicWorkOrderId('ewo_h12'),
      taskId: asHeliosTaskId('htk_h12'),
      customerId: 'cust_h12',
      programId: asHeliosProgramId('hpg_h12'),
      reservedAmount: '5000',
      attemptNumber: 1,
      retryCausedAdditionalCost: false,
      succeeded: true,
      now: NOW,
    });
    assert.equal(spend.providerId, 'S3M');
    assert.equal(spend.modelId, S3M_FINANCE_MODEL_ID);
    assert.equal(spend.actualAmount, '1200');
  });

  it('11. customer isolation via request attribution', () => {
    const clock = new FrozenClock(NOW);
    const route = createHeliosS3mServingRoute({
      clock,
      gateway: fixtureGateway(),
      profile: qualifiedProfile(),
    });
    const status = route.status();
    assert.equal(status.routeId, 'helios.s3m-finance.serving');
    const a = route.infer(sampleRequest({ userId: 'cust_a', inferenceRequestId: 'inf_a' }));
    const b = route.infer(sampleRequest({ userId: 'cust_b', inferenceRequestId: 'inf_b' }));
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (a.ok && b.ok) {
      assert.equal(a.response.inferenceRequestId, 'inf_a');
      assert.equal(b.response.inferenceRequestId, 'inf_b');
      assert.notEqual(a.response.inferenceRequestId, b.response.inferenceRequestId);
    }
  });

  it('12. version change requires requalification', () => {
    const profile = qualifiedProfile();
    const changed = onModelVersionChange(profile, asModelVersion('s3m-finance-v1'));
    assert.equal(changed.qualificationState, 'QUALIFICATION_PENDING');
    assert.equal(changed.approvalEvidenceRef, null);
    assert.equal(changed.modelVersion, 's3m-finance-v1');
  });

  it('13. no fallback of private data to Grok', () => {
    const policy = createDefaultAiRuntimePolicy('S3M_PRIMARY');
    assert.equal(policy.s3mUnavailableFallsBackToGrok, false);
    const harness = runS3mFinanceQualificationHarness({ clock: new FrozenClock(NOW) });
    const caseResult = harness.cases.find((c) => c.caseId === 'no_private_fallback_to_grok');
    assert.ok(caseResult?.passed);
  });

  it('14. S3M cannot self-authorize', () => {
    const bad = validateS3mFinanceReasoningResult({
      schema: S3M_FINANCE_REASONING_SCHEMA,
      task: 'bad',
      contextVersion: 'v1',
      recommendedNextState: 'NO_ACTION',
      grantsExecutionAuthority: true,
      selfAuthorizes: false,
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.equal(bad.error.code, 'SELF_AUTHORIZATION_FORBIDDEN');
    }
  });

  it('15. restart-safe result and evidence', () => {
    const clock = new FrozenClock(NOW);
    const service = new S3mFinanceServingService({
      clock,
      gateway: fixtureGateway(),
      profile: qualifiedProfile(),
    });
    const result = service.infer(sampleRequest());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.value.servingEvidence.requestHash.length > 0);
      assert.ok(result.value.servingEvidence.responseHash);
      assert.equal(result.value.servingEvidence.qualificationState, 'QUALIFIED_SANDBOX');
    }
    const obs = service.observe();
    assert.equal(obs.exposesPrivatePrompts, false);
  });

  it('16. architecture boundary checks', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const s3mFindings = findings.filter((f) => f.file.includes('s3m-serving'));
    assert.equal(s3mFindings.length, 0);
    const status = resolveAvailabilityStatus(defaultS3mFinanceModelProfile(NOW));
    assert.equal(status, 'S3M_EXTERNAL_DEPLOYMENT_QUALIFICATION_PENDING');
    const harness = runS3mFinanceQualificationHarness({
      clock: new FrozenClock(NOW),
      fixtureQualified: true,
    });
    assert.equal(harness.availabilityStatus, 'S3M_CONTRACT_READY');
    assert.equal(harness.deploymentQualified, false);
  });
});
