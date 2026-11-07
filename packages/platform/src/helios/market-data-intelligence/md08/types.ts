import type { UtcInstant } from '@solstice/domain';
import type { OrderBookSnapshot } from '../../market-observation/types.ts';
import type {
  HELIOS_MD08_DERIVATIVES_AUTHORITY,
  HELIOS_MD08_DERIVATIVES_SCHEMA,
  MD08_DERIVED_IV_LABEL,
  Md08ExerciseStyle,
  Md08OptionRight,
  Md08ProvenanceKind,
  Md08TermStructureShape,
} from './taxonomy.ts';
import type { Md03FeedCoordinatorSnapshot } from '../md03/types.ts';
import type { RollState } from '../../multi-asset/futures/types.ts';
import type { MarketSessionStatus } from '../../market-observation/types.ts';

export type Md08Provenance = {
  readonly kind: Md08ProvenanceKind;
  readonly sourceId: string;
  readonly observationRef: string | null;
  readonly modelId: string | null;
  readonly notExchangeObserved: boolean;
};

export type Md08SettlementObservation = {
  readonly schema: typeof HELIOS_MD08_DERIVATIVES_SCHEMA;
  readonly settlementId: string;
  readonly instrumentId: string;
  readonly settlementMinor: bigint;
  readonly settlementDate: string;
  readonly asOf: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly provenance: Md08Provenance;
  readonly grantsExecutionAuthority: false;
};

export type Md08OpenInterestObservation = {
  readonly schema: typeof HELIOS_MD08_DERIVATIVES_SCHEMA;
  readonly instrumentId: string;
  readonly openInterestContracts: bigint;
  readonly asOf: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly provenance: Md08Provenance;
  readonly grantsExecutionAuthority: false;
};

export type Md08DerivativeTradeObservation = {
  readonly tradeId: string;
  readonly priceMinor: bigint;
  readonly quantity: bigint;
  readonly tradedAt: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly provenance: Md08Provenance;
};

export type Md08FuturesLifecycle = {
  readonly expiry: UtcInstant;
  readonly lastTradeDate: UtcInstant;
  readonly firstNoticeDate: UtcInstant | null;
  readonly deliveryDate: UtcInstant | null;
  readonly rollState: RollState;
  readonly contractMultiplierMinor: bigint;
  readonly multiplierScale: number;
};

export type Md08FuturesContractState = {
  readonly schema: typeof HELIOS_MD08_DERIVATIVES_SCHEMA;
  readonly authority: typeof HELIOS_MD08_DERIVATIVES_AUTHORITY;
  readonly instrumentId: string;
  readonly rootSymbol: string;
  readonly book: OrderBookSnapshot | null;
  readonly trades: readonly Md08DerivativeTradeObservation[];
  readonly settlement: Md08SettlementObservation | null;
  readonly openInterest: Md08OpenInterestObservation | null;
  readonly sessionVolume: bigint | null;
  readonly sessionState: MarketSessionStatus;
  readonly lifecycle: Md08FuturesLifecycle;
  readonly evaluatedAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type Md08OptionQuote = {
  readonly bidMinor: bigint | null;
  readonly askMinor: bigint | null;
  readonly lastTradeMinor: bigint | null;
  readonly bidProvenance: Md08Provenance;
  readonly askProvenance: Md08Provenance;
};

export type Md08DerivedImpliedVolatility = {
  readonly midIvBps: number | null;
  readonly bidIvBps: number | null;
  readonly askIvBps: number | null;
  readonly provenance: Md08Provenance;
  readonly label: typeof MD08_DERIVED_IV_LABEL;
};

export type Md08ResearchGreeks = {
  readonly deltaBps: number | null;
  readonly gammaBps: number | null;
  readonly vegaBps: number | null;
  readonly thetaBps: number | null;
  readonly provenance: Md08Provenance;
  readonly researchOnly: true;
};

export type Md08OptionContractState = {
  readonly schema: typeof HELIOS_MD08_DERIVATIVES_SCHEMA;
  readonly authority: typeof HELIOS_MD08_DERIVATIVES_AUTHORITY;
  readonly instrumentId: string;
  readonly underlyingInstrumentId: string;
  readonly right: Md08OptionRight;
  readonly strikeMinor: bigint;
  readonly expiry: UtcInstant;
  readonly exerciseStyle: Md08ExerciseStyle;
  readonly quote: Md08OptionQuote;
  readonly volumeContracts: bigint | null;
  readonly openInterest: Md08OpenInterestObservation | null;
  readonly exchangeImpliedVolBps: number | null;
  readonly exchangeIvProvenance: Md08Provenance | null;
  readonly derivedImpliedVolatility: Md08DerivedImpliedVolatility | null;
  readonly researchGreeks: Md08ResearchGreeks | null;
  readonly evaluatedAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type Md08FuturesCurvePoint = {
  readonly instrumentId: string;
  readonly expiry: UtcInstant;
  readonly settlementOrMidMinor: bigint;
  readonly provenance: Md08Provenance;
};

export type Md08CalendarSpreadObservation = {
  readonly frontInstrumentId: string;
  readonly backInstrumentId: string;
  readonly spreadMinor: bigint;
  readonly provenance: Md08Provenance;
};

export type Md08TermStructure = {
  readonly rootSymbol: string;
  readonly curve: readonly Md08FuturesCurvePoint[];
  readonly calendarSpread: Md08CalendarSpreadObservation | null;
  readonly shape: Md08TermStructureShape;
  readonly provenance: Md08Provenance;
};

export type Md08FeedTransportSnapshot = Md03FeedCoordinatorSnapshot<unknown>;

export type DerivativeMarketState = {
  readonly schema: typeof HELIOS_MD08_DERIVATIVES_SCHEMA;
  readonly authority: typeof HELIOS_MD08_DERIVATIVES_AUTHORITY;
  readonly snapshotId: string;
  readonly evaluatedAt: UtcInstant;
  readonly futures: readonly Md08FuturesContractState[];
  readonly options: readonly Md08OptionContractState[];
  readonly termStructures: readonly Md08TermStructure[];
  readonly feedTransport: Md08FeedTransportSnapshot | null;
  readonly grantsExecutionAuthority: false;
};
