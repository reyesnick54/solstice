/**
 * Domain-specific trust policy helpers — FX, markets, weather, resources.
 */

import type { ExternalObservation } from '../types.ts';
import type { ExternalDataTrustEngine } from './engine.ts';
import type { CanonicalTrustResult, TrustObservationContext } from './types.ts';

export type FxTrustInput = {
  readonly observations: readonly ExternalObservation<{
    readonly baseCurrency: string;
    readonly quoteCurrency: string;
    readonly rate: string;
    readonly asOf: string;
    readonly sourceProvider: string;
  }>[];
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly providerRisk?: Readonly<Record<string, { readonly state?: string; readonly quarantined?: boolean }>>;
};

export function buildFxTrustContexts(input: FxTrustInput): readonly TrustObservationContext[] {
  const semanticKey = `${input.baseCurrency}/${input.quoteCurrency}`;
  return Object.freeze(
    input.observations
      .filter(
        (o) =>
          o.data.baseCurrency === input.baseCurrency && o.data.quoteCurrency === input.quoteCurrency,
      )
      .map((observation) => {
        const risk = input.providerRisk?.[observation.providerId];
        const numericValue = parseFloat(observation.data.rate);
        return Object.freeze({
          observation,
          semanticKey,
          unit: input.quoteCurrency,
          numericValue: Number.isFinite(numericValue) ? numericValue : null,
          providerRiskState: mapRiskState(risk?.state),
          quarantined: risk?.quarantined ?? false,
        });
      }),
  );
}

export function assessFxReferenceTrust(
  engine: ExternalDataTrustEngine,
  input: FxTrustInput,
): CanonicalTrustResult<{ readonly rate: string; readonly baseCurrency: string; readonly quoteCurrency: string; readonly asOf: string; readonly sourceProvider: string }> {
  const contexts = buildFxTrustContexts(input);
  return engine.assess({
    contexts,
    policyProfile: 'FX_REFERENCE',
    semanticKey: `${input.baseCurrency}/${input.quoteCurrency}`,
    unit: input.quoteCurrency,
    mapCanonicalValue: (eligible, numericValue) => {
      if (numericValue === null) return null;
      const selected = eligible.find((c) => c.numericValue === numericValue) ?? eligible[0];
      if (!selected) return null;
      return Object.freeze({
        rate: numericValue.toFixed(6),
        baseCurrency: input.baseCurrency,
        quoteCurrency: input.quoteCurrency,
        asOf: selected.observation.data.asOf,
        sourceProvider: selected.observation.providerId,
      });
    },
  });
}

export type MarketTrustInput = {
  readonly observations: readonly ExternalObservation<{
    readonly symbol: string;
    readonly priceMinor: bigint;
    readonly currency: string;
    readonly asOf: string;
    readonly sourceProvider: string;
    readonly exchange?: string | null;
  }>[];
  readonly assetId: string;
  readonly providerRisk?: Readonly<Record<string, { readonly state?: string; readonly quarantined?: boolean }>>;
};

export function buildMarketTrustContexts(input: MarketTrustInput): readonly TrustObservationContext[] {
  return Object.freeze(
    input.observations
      .filter((o) => o.data.symbol === input.assetId || inferAssetId(o) === input.assetId)
      .map((observation) => {
        const risk = input.providerRisk?.[observation.providerId];
        const numericValue = Number(observation.data.priceMinor) / 100;
        return Object.freeze({
          observation,
          semanticKey: input.assetId,
          unit: observation.data.currency,
          numericValue: Number.isFinite(numericValue) ? numericValue : null,
          providerRiskState: mapRiskState(risk?.state),
          quarantined: risk?.quarantined ?? false,
        });
      }),
  );
}

function inferAssetId(observation: ExternalObservation<{ readonly symbol: string }>): string {
  return observation.data.symbol;
}

export function assessMarketReferenceTrust(
  engine: ExternalDataTrustEngine,
  input: MarketTrustInput,
): CanonicalTrustResult<{ readonly priceMinor: string; readonly currency: string; readonly symbol: string; readonly asOf: string; readonly sourceProvider: string }> {
  const contexts = buildMarketTrustContexts(input);
  return engine.assess({
    contexts,
    policyProfile: 'MARKET_REFERENCE',
    semanticKey: input.assetId,
    unit: contexts[0]?.unit ?? null,
    mapCanonicalValue: (eligible, numericValue) => {
      if (numericValue === null) return null;
      const selected = eligible.find((c) => c.numericValue === numericValue) ?? eligible[0];
      if (!selected) return null;
      const priceMinor = BigInt(Math.round(numericValue * 100));
      return Object.freeze({
        priceMinor: priceMinor.toString(),
        currency: selected.observation.data.currency,
        symbol: selected.observation.data.symbol,
        asOf: selected.observation.data.asOf,
        sourceProvider: selected.observation.providerId,
      });
    },
  });
}

export type ResourceEnergyTrustInput = {
  readonly observations: readonly ExternalObservation<{
    readonly value: number;
    readonly unit: string;
    readonly geography?: string;
    readonly measurementKind?: string;
    readonly resourceType?: string;
  }>[];
  readonly semanticKey: string;
  readonly unit: string;
  readonly policyProfile: 'ENERGY' | 'RESOURCE';
  readonly providerRisk?: Readonly<Record<string, { readonly state?: string; readonly quarantined?: boolean }>>;
};

export function assessResourceEnergyTrust(
  engine: ExternalDataTrustEngine,
  input: ResourceEnergyTrustInput,
): CanonicalTrustResult<{ readonly value: number; readonly unit: string }> {
  const contexts: TrustObservationContext[] = input.observations.map((observation) => {
    const risk = input.providerRisk?.[observation.providerId];
    return Object.freeze({
      observation,
      semanticKey: input.semanticKey,
      unit: observation.data.unit,
      numericValue: observation.data.value,
      providerRiskState: mapRiskState(risk?.state),
      quarantined: risk?.quarantined ?? false,
    });
  });
  return engine.assess({
    contexts: Object.freeze(contexts),
    policyProfile: input.policyProfile,
    semanticKey: input.semanticKey,
    unit: input.unit,
    mapCanonicalValue: (eligible, numericValue) => {
      if (numericValue === null) return null;
      return Object.freeze({ value: numericValue, unit: input.unit });
    },
  });
}

function mapRiskState(
  state?: string,
): TrustObservationContext['providerRiskState'] {
  switch (state) {
    case 'NORMAL':
      return 'NORMAL';
    case 'DEGRADED':
      return 'DEGRADED';
    case 'SUSPICIOUS':
      return 'SUSPICIOUS';
    case 'COMPROMISED_SUSPECTED':
      return 'COMPROMISED_SUSPECTED';
    case 'DISABLED':
      return 'DISABLED';
    default:
      return null;
  }
}
