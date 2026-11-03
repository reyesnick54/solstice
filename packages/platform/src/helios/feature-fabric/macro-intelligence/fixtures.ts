import { asUtcInstant, type UtcInstant } from '../../../../../domain/src/time.ts';
import type { MacroSeriesReadingInput } from './types.ts';

const ENTITLEMENT = Object.freeze({
  entitlementClass: 'provider_feed_delayed' as const,
  sourceProvider: 'fred',
  commercialUseStatus: 'permitted' as const,
});

function baseReading(overrides: Partial<MacroSeriesReadingInput> & Pick<MacroSeriesReadingInput, 'observationRef'>): MacroSeriesReadingInput {
  return Object.freeze({
    seriesKey: overrides.seriesKey ?? 'cpi',
    periodEnd: overrides.periodEnd ?? asUtcInstant('2026-01-31T23:59:59.000Z'),
    valueMinor: overrides.valueMinor ?? 323_400n,
    scheduledReleaseTime: overrides.scheduledReleaseTime ?? null,
    actualPublicationTime: overrides.actualPublicationTime ?? overrides.knowableAt ?? asUtcInstant('2026-02-12T13:30:00.000Z'),
    providerAvailabilityTime: overrides.providerAvailabilityTime ?? overrides.knowableAt ?? asUtcInstant('2026-02-12T13:31:00.000Z'),
    sunreyArrivalTime: overrides.sunreyArrivalTime ?? overrides.knowableAt ?? asUtcInstant('2026-02-12T13:32:00.000Z'),
    knowableAt: overrides.knowableAt ?? asUtcInstant('2026-02-12T13:32:00.000Z'),
    revisionSequence: overrides.revisionSequence ?? 0,
    revisionChainId: overrides.revisionChainId ?? 'chain.cpi.2026-01',
    observationRef: overrides.observationRef,
    evidenceRef: overrides.evidenceRef ?? `evidence://${overrides.observationRef}`,
    source: overrides.source ?? Object.freeze({ providerId: 'fred', seriesId: 'CPIAUCSL', capability: 'macroeconomic_indicators' }),
    entitlement: overrides.entitlement ?? ENTITLEMENT,
    releaseType: overrides.releaseType,
  });
}

export function januaryCpiInitialReleaseFixture(): MacroSeriesReadingInput {
  return baseReading({
    observationRef: 'obs.cpi.2026-01.v0',
    seriesKey: 'cpi',
    periodEnd: asUtcInstant('2026-01-31T23:59:59.000Z'),
    valueMinor: 323_000n,
    knowableAt: asUtcInstant('2026-02-12T13:32:00.000Z'),
    revisionSequence: 0,
  });
}

export function januaryCpiMarchRevisionFixture(): MacroSeriesReadingInput {
  return baseReading({
    observationRef: 'obs.cpi.2026-01.v1',
    seriesKey: 'cpi',
    periodEnd: asUtcInstant('2026-01-31T23:59:59.000Z'),
    valueMinor: 323_500n,
    knowableAt: asUtcInstant('2026-03-28T14:00:00.000Z'),
    revisionSequence: 1,
  });
}

export function delayedCpiReleaseFixture(): MacroSeriesReadingInput {
  return baseReading({
    observationRef: 'obs.cpi.delayed',
    knowableAt: asUtcInstant('2026-02-12T15:45:00.000Z'),
    providerAvailabilityTime: asUtcInstant('2026-02-12T15:40:00.000Z'),
    sunreyArrivalTime: asUtcInstant('2026-02-12T15:45:00.000Z'),
  });
}

export function unemploymentSeriesFixture(at: UtcInstant, valueMinor: bigint, ref: string): MacroSeriesReadingInput {
  return baseReading({
    observationRef: ref,
    seriesKey: 'unemployment',
    periodEnd: asUtcInstant('2026-01-31T23:59:59.000Z'),
    valueMinor,
    knowableAt: at,
    revisionChainId: 'chain.unrate.2026-01',
    source: Object.freeze({ providerId: 'fred', seriesId: 'UNRATE', capability: 'macroeconomic_indicators' }),
  });
}

export function treasuryYieldsFixture(at: UtcInstant): readonly MacroSeriesReadingInput[] {
  return Object.freeze([
    baseReading({
      observationRef: 'obs.y2',
      seriesKey: 'treasury_yield_2y',
      valueMinor: 412n,
      knowableAt: at,
      revisionChainId: 'chain.dgs2',
      source: Object.freeze({ providerId: 'fred', seriesId: 'DGS2', capability: 'treasury_yields' }),
    }),
    baseReading({
      observationRef: 'obs.y10',
      seriesKey: 'treasury_yield_10y',
      valueMinor: 450n,
      knowableAt: at,
      revisionChainId: 'chain.dgs10',
      source: Object.freeze({ providerId: 'fred', seriesId: 'DGS10', capability: 'treasury_yields' }),
    }),
  ]);
}

export function policyRateFixture(at: UtcInstant, valueMinor: bigint, ref: string): MacroSeriesReadingInput {
  return baseReading({
    observationRef: ref,
    seriesKey: 'policy_rate',
    valueMinor,
    knowableAt: at,
    revisionChainId: `chain.fedfunds.${ref}`,
    source: Object.freeze({ providerId: 'fred', seriesId: 'FEDFUNDS', capability: 'macroeconomic_indicators' }),
  });
}

export function conflictingCpiOfficialFixture(): MacroSeriesReadingInput {
  return baseReading({
    observationRef: 'obs.cpi.bls.conflict',
    periodEnd: asUtcInstant('2026-01-31T23:59:59.000Z'),
    knowableAt: asUtcInstant('2026-02-12T13:35:00.000Z'),
    revisionSequence: 0,
    source: Object.freeze({ providerId: 'bls', seriesId: 'CPI', capability: 'macroeconomic_indicators' }),
    revisionChainId: 'chain.cpi.2026-01.bls',
  });
}

export function staleCpiFixture(): MacroSeriesReadingInput {
  return baseReading({
    observationRef: 'obs.cpi.stale',
    knowableAt: asUtcInstant('2025-01-01T00:00:00.000Z'),
    periodEnd: asUtcInstant('2025-12-31T23:59:59.000Z'),
  });
}

export function scheduledCpiPlaceholderFixture(scheduled: UtcInstant): MacroSeriesReadingInput {
  return baseReading({
    observationRef: 'obs.cpi.scheduled',
    scheduledReleaseTime: scheduled,
    actualPublicationTime: null,
    knowableAt: scheduled,
    revisionSequence: 0,
  });
}
