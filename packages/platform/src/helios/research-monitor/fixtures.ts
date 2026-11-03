import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { asResearchMonitorId } from './ids.ts';
import { RESEARCH_MONITOR_SCHEMA_VERSION } from './taxonomy.ts';
import type { CanonicalFeatureObservation, ResearchMonitorDefinition, ResearchMonitorExpression } from './types.ts';
import { computeKnowableAt } from '../observation/information-time.ts';

export const FIXTURE_MONITOR_NOW = asUtcInstant('2026-11-03T06:30:00.000Z');

export function semiconductorVolatilityDislocationExpression(): ResearchMonitorExpression {
  return Object.freeze({
    kind: 'binary',
    op: 'and',
    left: Object.freeze({
      kind: 'binary',
      op: 'and',
      left: Object.freeze({
        kind: 'binary',
        op: 'gt',
        left: Object.freeze({ kind: 'feature', featureId: 'NVDA_30m_realized_vol' }),
        right: Object.freeze({
          kind: 'binary',
          op: 'mul',
          left: Object.freeze({ kind: 'number', value: '2.0' }),
          right: Object.freeze({ kind: 'feature', featureId: 'NVDA_20d_median_realized_vol' }),
        }),
      }),
      right: Object.freeze({
        kind: 'binary',
        op: 'lt',
        left: Object.freeze({ kind: 'feature', featureId: 'SOXX_breadth' }),
        right: Object.freeze({ kind: 'number', value: '0.35' }),
      }),
    }),
    right: Object.freeze({
      kind: 'binary',
      op: 'gt',
      left: Object.freeze({ kind: 'feature', featureId: 'NVDA_relative_volume' }),
      right: Object.freeze({ kind: 'number', value: '2.5' }),
    }),
  });
}

export function semiconductorVolatilityDislocationDefinition(
  overrides: Partial<ResearchMonitorDefinition> = {},
): ResearchMonitorDefinition {
  return Object.freeze({
    monitorId: asResearchMonitorId('monitor_semiconductor_volatility_dislocation'),
    name: 'semiconductor_volatility_dislocation',
    version: Object.freeze({
      major: 1,
      minor: 0,
      patch: 0,
      schemaVersion: RESEARCH_MONITOR_SCHEMA_VERSION,
    }),
    watch: Object.freeze(['NVDA', 'QQQ', 'SOXX']),
    condition: Object.freeze({
      expression: semiconductorVolatilityDislocationExpression(),
      description: 'NVDA vol dislocation with weak SOXX breadth and elevated relative volume',
    }),
    trigger: Object.freeze({
      action: 'REQUEST_RESEARCH',
      researchTopic: 'semiconductor_volatility_dislocation',
    }),
    startAt: asUtcInstant('2026-11-01T00:00:00.000Z'),
    expiresAt: asUtcInstant('2026-12-01T00:00:00.000Z'),
    cooldownMs: 3_600_000,
    maxTriggers: 5,
    researchBudgetMinor: '100',
    priority: 'HIGH',
    allowedAgentClasses: Object.freeze(['MACRO', 'EQUITY_SPECIALIST']),
    requiredEvidence: Object.freeze(['MARKET_OBSERVATION', 'REGIME_STATE']),
    pointInTimeFeatureRequirements: Object.freeze([
      { featureId: 'NVDA_30m_realized_vol', maxAgeMs: 1_800_000, requiredKind: 'realized_volatility' },
      { featureId: 'NVDA_20d_median_realized_vol', maxAgeMs: 86_400_000, requiredKind: 'realized_volatility' },
      { featureId: 'SOXX_breadth', maxAgeMs: 3_600_000, requiredKind: 'breadth' },
      { featureId: 'NVDA_relative_volume', maxAgeMs: 900_000, requiredKind: 'relative_volume' },
    ]),
    staleDataPolicy: 'FAIL_CLOSED',
    ...overrides,
  });
}

function featureObservation(input: {
  readonly featureId: string;
  readonly kind: CanonicalFeatureObservation['kind'];
  readonly value: string;
  readonly asOf: string;
  readonly knowableAt: string;
  readonly stale?: boolean;
  readonly missing?: boolean;
}): CanonicalFeatureObservation {
  const asOf = asUtcInstant(input.asOf);
  const sunreyArrivalTime = asUtcInstant(input.knowableAt);
  const informationTime = Object.freeze({
    sourceEventTime: asOf,
    sourcePublishedTime: null,
    providerAvailabilityTime: null,
    sunreyArrivalTime,
    ingestionTime: asOf,
    knowableAt: computeKnowableAt({
      providerAvailabilityTime: null,
      sunreyArrivalTime,
      ingestionTime: asOf,
    }),
  });
  return Object.freeze({
    featureId: input.featureId,
    kind: input.kind,
    instrumentId: input.featureId.startsWith('NVDA') ? 'NVDA' : input.featureId.startsWith('SOXX') ? 'SOXX' : null,
    value: input.value,
    asOf,
    informationTime,
    observationRef: `obs/${input.featureId}`,
    stale: input.stale ?? false,
    missing: input.missing ?? false,
  });
}

export function triggeredSemiconductorFeatureSet(
  asOf: UtcInstant = FIXTURE_MONITOR_NOW,
): readonly CanonicalFeatureObservation[] {
  return Object.freeze([
    featureObservation({
      featureId: 'NVDA_30m_realized_vol',
      kind: 'realized_volatility',
      value: '0.80',
      asOf,
      knowableAt: asOf,
    }),
    featureObservation({
      featureId: 'NVDA_20d_median_realized_vol',
      kind: 'realized_volatility',
      value: '0.30',
      asOf,
      knowableAt: asOf,
    }),
    featureObservation({
      featureId: 'SOXX_breadth',
      kind: 'breadth',
      value: '0.30',
      asOf,
      knowableAt: asOf,
    }),
    featureObservation({
      featureId: 'NVDA_relative_volume',
      kind: 'relative_volume',
      value: '3.0',
      asOf,
      knowableAt: asOf,
    }),
  ]);
}

export function staleNvdaVolFeatureSet(): readonly CanonicalFeatureObservation[] {
  const staleAsOf = asUtcInstant('2026-11-03T05:00:00.000Z');
  return Object.freeze([
    featureObservation({
      featureId: 'NVDA_30m_realized_vol',
      kind: 'realized_volatility',
      value: '0.80',
      asOf: staleAsOf,
      knowableAt: staleAsOf,
      stale: true,
    }),
    ...triggeredSemiconductorFeatureSet().slice(1),
  ]);
}

export function futureNvdaVolFeatureSet(): readonly CanonicalFeatureObservation[] {
  const futureKnowable = asUtcInstant('2026-11-03T07:00:00.000Z');
  return Object.freeze([
    featureObservation({
      featureId: 'NVDA_30m_realized_vol',
      kind: 'realized_volatility',
      value: '0.80',
      asOf: FIXTURE_MONITOR_NOW,
      knowableAt: futureKnowable,
    }),
    ...triggeredSemiconductorFeatureSet().slice(1),
  ]);
}

export function missingBreadthFeatureSet(): readonly CanonicalFeatureObservation[] {
  return Object.freeze([
    featureObservation({
      featureId: 'NVDA_30m_realized_vol',
      kind: 'realized_volatility',
      value: '0.80',
      asOf: FIXTURE_MONITOR_NOW,
      knowableAt: FIXTURE_MONITOR_NOW,
    }),
    featureObservation({
      featureId: 'NVDA_20d_median_realized_vol',
      kind: 'realized_volatility',
      value: '0.30',
      asOf: FIXTURE_MONITOR_NOW,
      knowableAt: FIXTURE_MONITOR_NOW,
    }),
    featureObservation({
      featureId: 'SOXX_breadth',
      kind: 'breadth',
      value: '0',
      asOf: FIXTURE_MONITOR_NOW,
      knowableAt: FIXTURE_MONITOR_NOW,
      missing: true,
    }),
    featureObservation({
      featureId: 'NVDA_relative_volume',
      kind: 'relative_volume',
      value: '3.0',
      asOf: FIXTURE_MONITOR_NOW,
      knowableAt: FIXTURE_MONITOR_NOW,
    }),
  ]);
}
