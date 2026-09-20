import type { UtcInstant } from '@solstice/domain';
import type {
  InstrumentKind,
  MarketCalendarReasonCode,
  MarketState,
  MarketCalendarRollState,
  SessionMode,
  SettlementType,
  TradabilityOutcome,
  VenueSignalKind,
} from './taxonomy.ts';

export type LocalTimeOfDay = {
  readonly hour: number;
  readonly minute: number;
};

export type LocalDateKey = `${number}-${string}-${string}`;

export type SessionWindow = {
  readonly start: LocalTimeOfDay;
  readonly end: LocalTimeOfDay;
};

export type MaintenanceWindow = {
  readonly start: LocalTimeOfDay;
  readonly end: LocalTimeOfDay;
  readonly weekdays?: readonly number[];
};

export type MarketHoliday = {
  readonly date: LocalDateKey;
  readonly name: string;
  readonly closed?: boolean;
  readonly earlyClose?: LocalTimeOfDay;
};

export type MarketCalendarDefinition = {
  readonly calendarId: string;
  readonly displayName: string;
  readonly timeZone: string;
  readonly sessionMode: SessionMode;
  readonly regularSession: SessionWindow | null;
  readonly preMarketSession: SessionWindow | null;
  readonly postMarketSession: SessionWindow | null;
  readonly weekendDays: readonly number[];
  readonly holidays: readonly MarketHoliday[];
  readonly maintenanceWindows: readonly MaintenanceWindow[];
  readonly fxWeekdayOpen?: SessionWindow;
};

export type VenueSignal = {
  readonly kind: VenueSignalKind;
  readonly authoritative: boolean;
  readonly message: string;
  readonly observedAt: UtcInstant;
};

export type MarketSessionSnapshot = {
  readonly calendarId: string;
  readonly at: UtcInstant;
  readonly timeZone: string;
  readonly localDate: LocalDateKey;
  readonly localTimeMinutes: number;
  readonly state: MarketState;
  readonly reasonCode: MarketCalendarReasonCode;
  readonly regularSession: SessionWindow | null;
  readonly preMarketSession: SessionWindow | null;
  readonly postMarketSession: SessionWindow | null;
  readonly earlyClose: LocalTimeOfDay | null;
  readonly maintenanceActive: boolean;
  readonly venueSignals: readonly VenueSignal[];
};

export type FuturesContractDefinition = {
  readonly contractId: string;
  readonly rootSymbol: string;
  readonly contractMonth: string;
  readonly underlying: string;
  readonly multiplier: number;
  readonly settlementType: SettlementType;
  readonly expirationDate: LocalDateKey;
  readonly lastTradeDate: LocalDateKey;
  readonly firstNoticeDate: LocalDateKey | null;
  readonly calendarId: string;
  readonly rollWindowDays: number;
  readonly rollApproachDays: number;
};

export type FuturesContractSnapshot = {
  readonly contract: FuturesContractDefinition;
  readonly at: UtcInstant;
  readonly daysToExpiration: number;
  readonly daysToLastTrade: number;
  readonly rollState: MarketCalendarRollState;
  readonly expired: boolean;
  readonly newExposureAllowed: boolean;
};

export type ContinuousSeriesDefinition = {
  readonly seriesId: string;
  readonly rootSymbol: string;
  readonly displayName: string;
  readonly underlying: string;
  readonly rollMethod: 'FRONT_MONTH';
  readonly executable: false;
};

export type InstrumentMarketBinding = {
  readonly instrumentId: string;
  readonly kind: InstrumentKind;
  readonly calendarId: string | null;
  readonly contractId: string | null;
  readonly continuousSeriesId: string | null;
  readonly rootSymbol: string | null;
};

export type TradabilityAssessment = {
  readonly instrumentId: string;
  readonly at: UtcInstant;
  readonly outcome: TradabilityOutcome;
  readonly marketState: MarketState;
  readonly rollState: MarketCalendarRollState | null;
  readonly resolvedContractId: string | null;
  readonly continuousSeries: boolean;
  readonly executable: boolean;
  readonly reasonCodes: readonly MarketCalendarReasonCode[];
};

export type MarketCalendarRegistry = {
  readonly getCalendar: (calendarId: string) => MarketCalendarDefinition | null;
  readonly getContract: (contractId: string) => FuturesContractDefinition | null;
  readonly getContinuousSeries: (seriesId: string) => ContinuousSeriesDefinition | null;
  readonly getInstrumentBinding: (instrumentId: string) => InstrumentMarketBinding | null;
  readonly listContractsForRoot: (rootSymbol: string) => readonly FuturesContractDefinition[];
};
