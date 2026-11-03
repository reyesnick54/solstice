import { createHash } from 'node:crypto';

import { asCustomerId } from '@solstice/domain';
import { asJurisdiction } from '@solstice/domain';
import { asUtcInstant } from '@solstice/domain';
import { asEconomicWorkOrderId } from '../ids.ts';
import { asStrategyCapsuleId } from '../strategy-capsule/ids.ts';
import type { StrategyCapsuleRef } from '../strategy-capsule/types.ts';
import {
  FIXTURE_NOW,
  baseExecutionPlan,
  equityTightSpreadMarketState,
  fullProviderCapabilities,
  orderPlanningFixture,
} from '../multi-asset/m22/fixtures.ts';
import type { ExecutionRoutingRequest } from '../execution-routing/types.ts';
import { M02_REFERENCE_INSTRUMENT_IDS } from '../market-observation/instrument-registry.ts';
import type { ExecutionTwinFeatureManifest, ExecutionTwinIntegrationPorts, ExecutionTwinRunInput } from './types.ts';
import type { ExecutionTwinEnvironmentKind } from './taxonomy.ts';

export const EXECUTION_TWIN_FIXTURE_NOW = FIXTURE_NOW;

export function fixtureStrategyCapsule(now = FIXTURE_NOW): StrategyCapsuleRef {
  return Object.freeze({
    capsuleId: asStrategyCapsuleId('scap_os02_fixture'),
    version: '2.4.1',
    contentHash: 'sha256_os02_capsule_fixture_v1',
    promotionState: 'PROMOTED',
    qualificationState: 'QUALIFIED',
    validUntil: asUtcInstant('2026-12-31T00:00:00.000Z'),
    modelDependencies: Object.freeze(['mdl_s3m', 'strategy_lab_m09']),
    policyVersion: 'helios-strategy-capsule-v1',
    grantsExecutionAuthority: false as const,
  });
}

export function fixtureFeatureManifest(): ExecutionTwinFeatureManifest {
  return Object.freeze({
    manifestId: 'feat_manifest_os02_v1',
    version: '1.0.0',
    contentHash: createHash('sha256').update('os02-feature-fixture-v1').digest('hex'),
    strategyLabCompilerVersion: 'strategy-compiler-m09-v1',
  });
}

export function fixtureRoutingRequest(overrides: Partial<ExecutionRoutingRequest> = {}): ExecutionRoutingRequest {
  return Object.freeze({
    requestId: overrides.requestId ?? 'req_os02_routing',
    customerId: overrides.customerId ?? asCustomerId('cust_os02'),
    legalEntityId: 'le_us_demo',
    jurisdiction: asJurisdiction('US'),
    workOrderId: overrides.workOrderId ?? asEconomicWorkOrderId('ewo_os02'),
    instrumentId: overrides.instrumentId ?? M02_REFERENCE_INSTRUMENT_IDS.SPY,
    assetClass: overrides.assetClass ?? 'etf',
    orderType: overrides.orderType ?? 'LIMIT',
    orderAction: overrides.orderAction ?? 'BUY',
    notionalMinorUnits: overrides.notionalMinorUnits ?? '4500000',
    currency: 'USD',
    venuePreference: null,
    accountContexts: Object.freeze([
      Object.freeze({
        accountId: 'acct_paper_equity_sandbox',
        customerId: asCustomerId('cust_os02'),
        legalEntityId: 'le_us_demo',
        accountClass: 'BROKERAGE',
        eligible: true,
        certified: true,
        funded: true,
        fundingState: 'FUNDED',
      }),
    ]),
    marketSession: 'OPEN',
    venueAvailable: true,
    at: overrides.at ?? FIXTURE_NOW,
    ...overrides,
  });
}

export function fixtureExecutionTwinRunInput(input?: {
  readonly runId?: string;
  readonly environment?: ExecutionTwinEnvironmentKind;
  readonly randomSeed?: string;
  readonly blockRisk?: boolean;
}): ExecutionTwinRunInput {
  const now = FIXTURE_NOW;
  const capsule = fixtureStrategyCapsule(now);
  const featureManifest = fixtureFeatureManifest();
  const executionConfigDigest = createHash('sha256')
    .update(
      JSON.stringify({
        plan: baseExecutionPlan(now).executionPlanId,
        routing: 'sunrey-investments-paper',
      }),
    )
    .digest('hex');

  return Object.freeze({
    runId: input?.runId ?? 'run_os02_fixture',
    environment: input?.environment ?? 'HISTORICAL_REPLAY',
    customerId: asCustomerId('cust_os02'),
    workOrderId: 'ewo_os02',
    strategyCapsule: capsule,
    featureManifest,
    executionConfigDigest,
    randomSeed: input?.randomSeed ?? 'seed_os02_deterministic',
    jurisdictionEligible: true,
    mandateActive: true,
    planningEligible: true,
    orderPlanning: orderPlanningFixture({
      now,
      marketState: equityTightSpreadMarketState(now),
      providerCapabilities: fullProviderCapabilities(),
      executionPlan: baseExecutionPlan(now, {
        strategyRequirements: Object.freeze(['PASSIVE_ENTRY']),
        urgency: 'PASSIVE',
      }),
    }),
    routingRequest: fixtureRoutingRequest(),
  });
}

export function deterministicRiskPort(block = false): ExecutionTwinIntegrationPorts['risk'] {
  return {
    evaluate: (ctx) => {
      const digest = createHash('sha256')
        .update(
          JSON.stringify({
            capsuleHash: ctx.capsuleHash,
            featureManifestHash: ctx.featureManifestHash,
            executionConfigDigest: ctx.executionConfigDigest,
          }),
        )
        .digest('hex')
        .slice(0, 32);
      if (block) {
        return Object.freeze({
          permitted: false,
          reason: 'risk_blocked_fixture',
          digest,
        });
      }
      return Object.freeze({
        permitted: true,
        reason: 'risk_clear',
        digest,
      });
    },
  };
}

export function defaultExecutionTwinPorts(overrides: Partial<ExecutionTwinIntegrationPorts> = {}): ExecutionTwinIntegrationPorts {
  return Object.freeze({
    risk: deterministicRiskPort(false),
    compliance: {
      evaluate: ({ jurisdictionEligible }) =>
        Object.freeze({
          permitted: jurisdictionEligible,
          reason: jurisdictionEligible ? 'compliance_clear' : 'jurisdiction_blocked',
          digest: createHash('sha256').update(String(jurisdictionEligible)).digest('hex').slice(0, 32),
        }),
    },
    authority: {
      verifyBound: ({ workOrderId }) =>
        Object.freeze({
          permitted: true,
          reason: 'authority_binding_verified',
          digest: createHash('sha256').update(workOrderId).digest('hex').slice(0, 32),
        }),
    },
    mandate: {
      evaluate: ({ mandateActive, planningEligible }) =>
        Object.freeze({
          permitted: mandateActive && planningEligible,
          reason: mandateActive && planningEligible ? 'mandate_eligible' : 'mandate_ineligible',
          digest: createHash('sha256').update(`${mandateActive}:${planningEligible}`).digest('hex').slice(0, 32),
        }),
    },
    ...overrides,
  });
}
