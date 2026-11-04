/**
 * Domain-specific trust policy helpers — FX, markets, weather, resources.
 */

import type { ExternalObservation } from '../types.ts';
import type { ExternalDataTrustEngine } from './engine.ts';
import type { CanonicalTrustResult, TrustObservationContext } from './types.ts';

type FxObservationData = {
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly rate: string;
  readonly asOf: string;
  readonly sourceProvider: string;
};

type FxCanonicalValue = {
  readonly rate: string;
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly asOf: string;
  readonly sourceProvider: string;
};

export type FxTrustInput = {
  readonly observations: readonly ExternalObservation<FxObservationData>[];
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly providerRisk?: Readonly<Record<string, { readonly state?: string; readonly quarantined?: boolean }>>;
};

export function buildFxTrustContexts(
  input: FxTrustInput,
): readonly TrustObservationContext<FxObservationData>[] {
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
): CanonicalTrustResult<FxCanonicalValue> {
  const contexts = buildFxTrustContexts(input);
  return engine.assess<FxObservationData, FxCanonicalValue>({
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

type MarketObservationData = {
  readonly symbol: string;
  readonly priceMinor: bigint;
  readonly currency: string;
  readonly asOf: string;
  readonly sourceProvider: string;
  readonly exchange?: string | null;
};

type MarketCanonicalValue = {
  readonly priceMinor: string;
  readonly currency: string;
  readonly symbol: string;
  readonly asOf: string;
  readonly sourceProvider: string;
};

export type MarketTrustInput = {
  readonly observations: readonly ExternalObservation<MarketObservationData>[];
  readonly assetId: string;
  readonly providerRisk?: Readonly<Record<string, { readonly state?: string; readonly quarantined?: boolean }>>;
};

export function buildMarketTrustContexts(
  input: MarketTrustInput,
): readonly TrustObservationContext<MarketObservationData>[] {
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
): CanonicalTrustResult<MarketCanonicalValue> {
  const contexts = buildMarketTrustContexts(input);
  return engine.assess<MarketObservationData, MarketCanonicalValue>({
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

type ResourceEnergyObservationData = {
  readonly value: number;
  readonly unit: string;
  readonly geography?: string;
  readonly measurementKind?: string;
  readonly resourceType?: string;
};

type ResourceEnergyCanonicalValue = {
  readonly value: number;
  readonly unit: string;
};

export type ResourceEnergyTrustInput = {
  readonly observations: readonly ExternalObservation<ResourceEnergyObservationData>[];
  readonly semanticKey: string;
  readonly unit: string;
  readonly policyProfile: 'ENERGY' | 'RESOURCE';
  readonly providerRisk?: Readonly<Record<string, { readonly state?: string; readonly quarantined?: boolean }>>;
};

export function assessResourceEnergyTrust(
  engine: ExternalDataTrustEngine,
  input: ResourceEnergyTrustInput,
): CanonicalTrustResult<ResourceEnergyCanonicalValue> {
  const contexts: TrustObservationContext<ResourceEnergyObservationData>[] = input.observations.map(
    (observation) => {
    const risk = input.providerRisk?.[observation.providerId];
    return Object.freeze({
      observation,
      semanticKey: input.semanticKey,
      unit: observation.data.unit,
      numericValue: observation.data.value,
      providerRiskState: mapRiskState(risk?.state),
      quarantined: risk?.quarantined ?? false,
    });
    },
  );
  return engine.assess<ResourceEnergyObservationData, ResourceEnergyCanonicalValue>({
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

type TrustProviderRiskState = NonNullable<TrustObservationContext['providerRiskState']> | null;

function mapRiskState(state?: string): TrustProviderRiskState {
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
