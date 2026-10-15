export {
  HELIOS_AAF09_SCHEMA,
  HELIOS_AAF09_AUTHORITY,
  CRYPTO_OBSERVATION_KINDS,
  CRYPTO_SOURCE_CLASSES,
  SOURCE_HEALTH_STATES,
  AAF09_FEATURE_IDS,
  type CryptoObservationKind,
  type CryptoSourceClass,
  type SourceHealthState,
  type CryptoVenueRef,
  type NormalizedCryptoMarketObservation,
  type IngestCryptoObservationResult,
  type MultiSourceDisagreementReport,
} from './types.ts';

export {
  AAF09_INSTRUMENTS,
  resolveAaf09Instrument,
  instrumentsShareBaseButDifferQuote,
  assertDistinctInstrumentPair,
  type Aaf09InstrumentDefinition,
} from './instruments.ts';

export {
  sourceClassForProvider,
  sourceFamilyFor,
  venueIdForKraken,
  isVenueSource,
  isReferenceAggregate,
} from './taxonomy.ts';

export {
  AAF09_PRICE_SCALE,
  decimalStringToMinorUnits,
  computeSpreadMinorUnits,
  buildNormalizedObservation,
  hashPayload,
} from './normalization.ts';

export {
  detectCrossedMarket,
  detectSequenceGap,
  detectStaleFeed,
  applyValidationHealth,
  type ValidationIssue,
} from './validation.ts';

export { classifyWitness, countIndependentWitnesses, sharedUpstreamBlocksIndependence } from './lineage.ts';

export { createAaf09ObservationStore, type Aaf09ObservationStore, type Aaf09ObservationStoreSnapshot } from './store.ts';

export { assessMultiSourceDisagreement, buildTrustContexts } from './multi-source.ts';

export { createKrakenVenueAdapter, krakenHarnessNow, type KrakenVenueAdapterOptions } from './adapters/kraken-venue.ts';
export {
  createCoingeckoReferenceAdapter,
  type CoingeckoReferenceAdapterOptions,
} from './adapters/coingecko-reference.ts';
export type { CryptoVenueMarketDataAdapter, CryptoReferenceAdapter } from './adapters/types.ts';

export { Aaf09ExternalCryptoObservationFabric, type Aaf09ExternalCryptoFabricOptions } from './fabric.ts';

export {
  AAF09_FEATURE_DEFINITIONS,
  computeAaf09Features,
  venueDislocationBps,
  type Aaf09FeatureSnapshot,
} from './features.ts';

export { replayAaf09Snapshot, type Aaf09ReplayResult } from './replay.ts';

export {
  HELIOS_AAF09_EXTERNAL_CRYPTO_DATA_QUALIFIED,
  HELIOS_AAF09_EXTERNAL_CRYPTO_DATA_BLOCKED,
  evaluateAaf09Qualification,
  type Aaf09QualificationChecks,
  type Aaf09QualificationResult,
} from './qualification.ts';
