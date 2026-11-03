#!/usr/bin/env node
/**
 * HELIOS AAF02 — evidence-time feature fabric qualification gate.
 */

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  computeFeatureObservation,
  createHeliosFeatureFabricStore,
  evaluateAaf02Qualification,
  HELIOS_AAF02_EVIDENCE_TIME_FEATURE_FABRIC_QUALIFIED,
  HeliosFeatureFabric,
  isFeatureVisibleAt,
  recomputeFeatureObservation,
  selectFeatureRevisionAt,
  transformationVersionChangeCreatesNewLineage,
  type FeatureContributionInput,
  type FeatureDefinition,
} from '../packages/platform/src/helios/index.ts';
import { buildInformationTime } from '../packages/platform/src/helios/observation/information-time.ts';

const NOW = asUtcInstant('2026-09-17T12:00:00.000Z');

function definition(overrides: Partial<FeatureDefinition> = {}): FeatureDefinition {
  return Object.freeze({
    schemaVersion: 'sunrey.helios.feature-fabric.v1',
    featureId: overrides.featureId ?? 'aaf02.qualify',
    featureVersion: overrides.featureVersion ?? '1.0.0',
    displayName: 'qualify',
    description: 'qualify',
    valueKind: 'integer_minor',
    unit: 'USD',
    transformationId: 'sum_minor',
    transformationVersion: overrides.transformationVersion ?? '1',
    transformationParameters: Object.freeze({}),
    grantsExecutionAuthority: false,
  });
}

function contrib(
  observationId: string,
  knowableAt: ReturnType<typeof asUtcInstant>,
  extras: Partial<FeatureContributionInput> = {},
): FeatureContributionInput {
  const informationTime = buildInformationTime({
    observation: {
      observationId,
      providerId: 'fixture',
      capability: 'market_prices',
      providerCategory: 'markets',
      data: {},
      source: { provider: 'fixture', dataset: 'test' },
      time: { retrievedAt: knowableAt, sourceTimestamp: knowableAt },
      authorityClass: 'reference_data',
      provenance: { rawPayload: '{}', providerSchemaVersion: '1' },
      freshnessPolicy: { maxAgeMs: 60_000, policyId: 'test' },
      validationStatus: 'valid',
      licensing: { commercialUseStatus: 'permitted', redistributionStatus: 'permitted' },
    },
    ingestionTime: knowableAt,
  });
  return Object.freeze({
    observationId,
    informationTime,
    entitlement: Object.freeze({
      entitlementClass: 'provider_feed_delayed',
      commercialUseStatus: 'permitted',
      redistributionStatus: 'permitted',
      feedDelayClassification: 'delayed',
      unavailable: false,
    }),
    qualityState: 'VALID',
    sourceIndependence: 'INDEPENDENT',
    evidenceRef: `evidence://${observationId}`,
    numericValueMinor: 1n,
    ...extras,
  });
}

function main(): void {
  const q2Published = asUtcInstant('2026-08-14T12:00:00.000Z');
  const q2End = asUtcInstant('2026-06-30T23:59:59.000Z');
  const q2Feature = computeFeatureObservation({
    definition: definition({ featureId: 'aaf02.q2' }),
    canonicalEntityId: 'entity.acme',
    eventTime: q2End,
    computedAt: q2Published,
    revisionId: 'q2',
    validFrom: q2Published,
    contributions: [contrib('obs_q2', q2Published, { numericValueMinor: 1n })],
  });

  const macroV1 = computeFeatureObservation({
    definition: definition({ featureId: 'aaf02.gdp' }),
    canonicalEntityId: 'entity.us',
    eventTime: NOW,
    computedAt: asUtcInstant('2026-01-31T14:00:00.000Z'),
    revisionId: 'v1',
    validFrom: asUtcInstant('2026-01-31T14:00:00.000Z'),
    contributions: [contrib('gdp_v1', asUtcInstant('2026-01-31T14:00:00.000Z'))],
  });
  const macroV2 = computeFeatureObservation({
    definition: definition({ featureId: 'aaf02.gdp' }),
    canonicalEntityId: 'entity.us',
    eventTime: NOW,
    computedAt: asUtcInstant('2026-02-28T15:30:00.000Z'),
    revisionId: 'v2',
    validFrom: asUtcInstant('2026-02-28T15:30:00.000Z'),
    contributions: [contrib('gdp_v2', asUtcInstant('2026-02-28T15:30:00.000Z'))],
  });

  const futureRejected = computeFeatureObservation({
    definition: definition({ featureId: 'aaf02.future' }),
    canonicalEntityId: 'entity.x',
    eventTime: NOW,
    computedAt: NOW,
    revisionId: 'f',
    validFrom: NOW,
    contributions: [contrib('obs_future', asUtcInstant('2026-09-18T00:00:00.000Z'))],
    evaluationTimeForVisibility: NOW,
  });

  const delayed = computeFeatureObservation({
    definition: definition({ featureId: 'aaf02.delayed' }),
    canonicalEntityId: 'entity.x',
    eventTime: asUtcInstant('2026-09-16T11:59:55.000Z'),
    computedAt: asUtcInstant('2026-09-16T12:15:00.000Z'),
    revisionId: 'd',
    validFrom: asUtcInstant('2026-09-16T12:15:00.000Z'),
    contributions: [contrib('obs_delayed', asUtcInstant('2026-09-16T12:15:00.000Z'))],
  });

  const stale = computeFeatureObservation({
    definition: definition({ featureId: 'aaf02.stale' }),
    canonicalEntityId: 'entity.x',
    eventTime: NOW,
    computedAt: NOW,
    revisionId: 's',
    validFrom: NOW,
    contributions: [
      contrib('obs_stale', NOW, {
        qualityState: 'DEGRADED_STALE',
      }),
    ],
  });

  const restricted = computeFeatureObservation({
    definition: definition({ featureId: 'aaf02.restricted' }),
    canonicalEntityId: 'entity.x',
    eventTime: NOW,
    computedAt: NOW,
    revisionId: 'r',
    validFrom: NOW,
    contributions: [
      contrib('obs_restricted', NOW, {
        entitlement: Object.freeze({
          entitlementClass: 'commercial_restricted',
          commercialUseStatus: 'restricted',
          redistributionStatus: 'permitted',
          feedDelayClassification: 'delayed',
          unavailable: false,
        }),
      }),
    ],
  });

  const detInput = {
    definition: definition({ featureId: 'aaf02.det' }),
    canonicalEntityId: 'entity.x',
    eventTime: NOW,
    computedAt: NOW,
    revisionId: 'det',
    validFrom: NOW,
    contributions: [contrib('obs_det', NOW)],
  };
  const detFirst = computeFeatureObservation(detInput);
  const detSecond =
    detFirst.ok ? recomputeFeatureObservation(detInput, detFirst.observation) : { ok: false as const, code: 'x', message: 'x' };

  const lineageA = computeFeatureObservation({
    definition: definition({ featureId: 'aaf02.lin', transformationVersion: '1' }),
    canonicalEntityId: 'entity.x',
    eventTime: NOW,
    computedAt: NOW,
    revisionId: 'l1',
    validFrom: NOW,
    contributions: [contrib('obs_l', NOW)],
  });
  const lineageB = computeFeatureObservation({
    definition: definition({ featureId: 'aaf02.lin', transformationVersion: '2' }),
    canonicalEntityId: 'entity.x',
    eventTime: NOW,
    computedAt: NOW,
    revisionId: 'l2',
    validFrom: NOW,
    contributions: [contrib('obs_l', NOW)],
  });

  const store = createHeliosFeatureFabricStore();
  const fabric = new HeliosFeatureFabric({ clock: new FrozenClock(NOW), store });
  fabric.registerDefinition(definition({ featureId: 'aaf02.restart' }));
  const restartComputed = fabric.compute({
    definition: definition({ featureId: 'aaf02.restart' }),
    canonicalEntityId: 'entity.r',
    eventTime: NOW,
    computedAt: NOW,
    revisionId: 'restart',
    validFrom: NOW,
    contributions: [contrib('obs_restart', NOW)],
  });
  fabric.sealManifest({
    definitions: [definition({ featureId: 'aaf02.restart' })],
    observations: restartComputed.ok ? [restartComputed.observation] : [],
    contributions: [contrib('obs_restart', NOW)],
    sourceDatasets: ['fixture'],
    universeDefinition: 'entity.r',
    missingValuePolicy: 'omit',
    codeVersion: 'aaf02-qualify',
    modelVersion: null,
  });

  const macroRows =
    macroV1.ok && macroV2.ok ? [macroV1.observation, macroV2.observation] : [];

  const result = evaluateAaf02Qualification({
    q2FilingBlockedBeforePublication:
      q2Feature.ok &&
      !isFeatureVisibleAt(asUtcInstant('2026-08-01T09:00:00.000Z'), q2Feature.observation.knowableAt),
    macroRevisionPreservesHistory:
      macroRows.length === 2 &&
      selectFeatureRevisionAt(macroRows, asUtcInstant('2026-02-15T10:00:00.000Z'), 'aaf02.gdp')?.revisionId ===
        'v1' &&
      selectFeatureRevisionAt(macroRows, asUtcInstant('2026-03-01T10:00:00.000Z'), 'aaf02.gdp')?.revisionId === 'v2',
    futureObservationRejected: !futureRejected.ok && futureRejected.code === 'FUTURE_OBSERVATION',
    delayedMarketKnowabilityPreserved:
      delayed.ok &&
      delayed.observation.knowableAt === asUtcInstant('2026-09-16T12:15:00.000Z') &&
      !isFeatureVisibleAt(asUtcInstant('2026-09-16T12:05:00.000Z'), delayed.observation.knowableAt),
    staleProducesDegradedFeature: stale.ok && stale.observation.qualityState === 'DEGRADED_STALE',
    restrictedEntitlementPropagates:
      restricted.ok && restricted.observation.entitlementState === 'RESTRICTED',
    restartPreservesIdentity:
      restartComputed.ok &&
      store.getObservation(restartComputed.observation.featureObservationId) !== undefined &&
      store.snapshot().manifests.length === 1,
    recomputationDeterministic:
      detFirst.ok &&
      detSecond.ok &&
      detFirst.observation.featureObservationId === detSecond.observation.featureObservationId,
    transformationVersionNewLineage:
      lineageA.ok &&
      lineageB.ok &&
      transformationVersionChangeCreatesNewLineage(lineageA.observation.lineage, '2') &&
      lineageA.observation.lineage.lineageId !== lineageB.observation.lineage.lineageId,
    noCustomerFinancialAuthority:
      restartComputed.ok &&
      restartComputed.observation.grantsExecutionAuthority === false &&
      ENVIRONMENT === 'simulation' &&
      LIVE_TRADING_ENABLED === false,
  });

  console.log(JSON.stringify({ marker: result.marker, qualified: result.qualified, blockers: result.blockers }, null, 2));
  process.exit(result.marker === HELIOS_AAF02_EVIDENCE_TIME_FEATURE_FABRIC_QUALIFIED ? 0 : 1);
}

main();
