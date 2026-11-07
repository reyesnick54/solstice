/**
 * HELIOS MD10 observation envelopes — decentralized macro market references.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  CommodityReferenceKind,
  FxQuoteKind,
  HELIOS_MD10_CONSENSUS_SCHEMA,
  HELIOS_MD10_MACRO_MARKET_REFERENCE_SCHEMA,
  Md10ConsensusEstimator,
  Md10MacroDomain,
  RateObservationKind,
} from './taxonomy.ts';

export type RationalRate = {
  readonly numerator: bigint;
  readonly denominator: bigint;
};

export type MacroMarketObservationProvenance = {
  readonly observationId: string;
  readonly providerId: string;
  readonly venueId: string | null;
  readonly sourceTimestamp: UtcInstant;
  readonly retrievedAt: UtcInstant;
};

export type MacroFxObservation = {
  readonly schema: typeof HELIOS_MD10_MACRO_MARKET_REFERENCE_SCHEMA;
  readonly domain: 'fx';
  readonly kind: FxQuoteKind;
  readonly baseCurrency: string;
  readonly quoteCurrency: string;
  readonly tenor: string;
  readonly bid: RationalRate;
  readonly ask: RationalRate;
  readonly provenance: MacroMarketObservationProvenance;
  readonly observedAt: UtcInstant;
};

export type MacroRateObservation = {
  readonly schema: typeof HELIOS_MD10_MACRO_MARKET_REFERENCE_SCHEMA;
  readonly domain: 'rates';
  readonly kind: RateObservationKind;
  readonly currency: string;
  readonly jurisdiction: string;
  readonly tenorLabel: string;
  readonly tenorYears: number | null;
  readonly valueBps: number;
  readonly licensedSwapReference: boolean;
  readonly provenance: MacroMarketObservationProvenance;
  readonly observedAt: UtcInstant;
};

export type MacroCommodityObservation = {
  readonly schema: typeof HELIOS_MD10_MACRO_MARKET_REFERENCE_SCHEMA;
  readonly domain: 'commodity';
  readonly kind: CommodityReferenceKind;
  readonly commodityCode: string;
  readonly currency: string;
  readonly unit: string;
  readonly priceMinorUnits: bigint;
  readonly priceScale: number;
  readonly contractMonth: string | null;
  readonly venueId: string | null;
  readonly provenance: MacroMarketObservationProvenance;
  readonly observedAt: UtcInstant;
};

export type MacroMarketObservation = MacroFxObservation | MacroRateObservation | MacroCommodityObservation;

export type CommodityBasisLink = {
  readonly schema: typeof HELIOS_MD10_MACRO_MARKET_REFERENCE_SCHEMA;
  readonly linkId: string;
  readonly futuresObservationId: string;
  readonly physicalObservationId: string;
  readonly basisMinorUnits: bigint;
  readonly priceScale: number;
  readonly currency: string;
  readonly documentedAt: UtcInstant;
};

export type Md10Dispersion = {
  readonly spanMinorUnits: bigint;
  readonly priceScale: number;
  readonly sourceMidsUsed: number;
};

export type DecentralizedMarketConsensusState = {
  readonly schema: typeof HELIOS_MD10_CONSENSUS_SCHEMA;
  readonly consensusKey: string;
  readonly domain: Md10MacroDomain;
  readonly status: 'CONSOLIDATED' | 'INSUFFICIENT' | 'INCOMPATIBLE';
  readonly estimator: Md10ConsensusEstimator;
  readonly trimCount: number;
  readonly consolidatedBid: RationalRate | null;
  readonly consolidatedAsk: RationalRate | null;
  readonly consolidatedValueBps: number | null;
  readonly consolidatedPriceMinorUnits: bigint | null;
  readonly priceScale: number | null;
  readonly dispersion: Md10Dispersion | null;
  readonly sourceCount: number;
  readonly contributingObservationIds: readonly string[];
  /** Structural guarantee: MD10 never mints a single authoritative FX print. */
  readonly grantsSingleTruePrice: false;
  readonly evaluatedAt: UtcInstant;
};
