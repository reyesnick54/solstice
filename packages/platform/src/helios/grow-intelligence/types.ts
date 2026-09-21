import type { UtcInstant } from '@solstice/domain';
import type { LocalDateKey } from '../multi-asset/market-calendar/types.ts';
import type { GrowMoneyDto } from '../paper-grow/types.ts';
import type {
  GrowExecutionMode,
  GrowNotificationChannel,
  GrowNotificationEventType,
  GrowNotificationPriority,
  GrowReportDisclosureFlag,
  GrowReportType,
  GrowSummarizerMode,
} from './taxonomy.ts';

export type { GrowMoneyDto };

export type GrowIntelligencePositionFact = {
  readonly instrumentId: string;
  readonly displayName: string;
  readonly quantityUnits: string;
  readonly marketValue: GrowMoneyDto | null;
  readonly unrealized: GrowMoneyDto | null;
  readonly positionStatus: 'OPEN' | 'CLOSED' | 'PENDING';
  readonly isPaper: true;
};

export type GrowIntelligenceRegimeFact = {
  readonly scope: string;
  readonly dimension: string;
  readonly label: string;
  readonly confidenceBand: string;
  readonly asOf: UtcInstant;
};

export type GrowIntelligenceScheduledEventFact = {
  readonly eventId: string;
  readonly title: string;
  readonly domain: string;
  readonly scheduledTime: UtcInstant;
  readonly relevance: string;
};

export type GrowIntelligenceMonitoredMarketFact = {
  readonly instrumentId: string;
  readonly displayName: string;
  readonly reason: string;
};

export type GrowIntelligenceRiskInterventionFact = {
  readonly interventionId: string;
  readonly kind: string;
  readonly message: string;
  readonly occurredAt: UtcInstant;
};

export type GrowIntelligenceProviderLimitationFact = {
  readonly code: string;
  readonly message: string;
  readonly severity: 'INFO' | 'WARNING' | 'CRITICAL';
};

export type GrowIntelligenceStrategyStateChangeFact = {
  readonly changeId: string;
  readonly strategyRef: string;
  readonly priorState: string;
  readonly nextState: string;
  readonly reason: string;
  readonly changedAt: UtcInstant;
};

export type GrowIntelligenceTradeFact = {
  readonly tradeId: string;
  readonly instrumentId: string;
  readonly displayName: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: string;
  readonly notional: GrowMoneyDto;
  readonly isPaper: true;
  readonly occurredAt: UtcInstant;
  readonly settlementState: 'SETTLED' | 'UNSETTLED' | 'PENDING';
};

export type GrowIntelligenceRejectedOpportunityFact = {
  readonly opportunityId: string;
  readonly instrumentId: string;
  readonly displayName: string;
  readonly rejectionReason: string;
  readonly evaluatedAt: UtcInstant;
  readonly counterfactualProfitClaimPermitted: false;
};

export type GrowIntelligencePerformanceAttributionLine = {
  readonly source: string;
  readonly amount: GrowMoneyDto;
  readonly kind: 'REALIZED' | 'UNREALIZED' | 'FEE' | 'INCOME' | 'RESEARCH_COST';
  readonly excludesDeposits: true;
};

export type GrowIntelligenceFactsSnapshot = {
  readonly customerId: string;
  readonly subjectId: string;
  readonly reportingDate: LocalDateKey;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly timeZone: string;
  readonly executionMode: GrowExecutionMode;
  readonly environment: 'simulation';
  readonly growCapital: GrowMoneyDto;
  readonly availableCash: GrowMoneyDto;
  readonly withdrawableCash: GrowMoneyDto;
  readonly deployedCapital: GrowMoneyDto;
  readonly unsettledCash: GrowMoneyDto;
  readonly activePositions: readonly GrowIntelligencePositionFact[];
  readonly marketRegimes: readonly GrowIntelligenceRegimeFact[];
  readonly scheduledMarketEvents: readonly GrowIntelligenceScheduledEventFact[];
  readonly monitoredMarkets: readonly GrowIntelligenceMonitoredMarketFact[];
  readonly riskState: string;
  readonly riskInterventions: readonly GrowIntelligenceRiskInterventionFact[];
  readonly providerLimitations: readonly GrowIntelligenceProviderLimitationFact[];
  readonly dataLimitations: readonly GrowIntelligenceProviderLimitationFact[];
  readonly strategyStateChanges: readonly GrowIntelligenceStrategyStateChangeFact[];
  readonly startingPortfolioValue: GrowMoneyDto | null;
  readonly endingPortfolioValue: GrowMoneyDto | null;
  readonly realizedPnl: GrowMoneyDto | null;
  readonly unrealizedPnl: GrowMoneyDto | null;
  readonly fees: GrowMoneyDto | null;
  readonly tradesOpened: readonly GrowIntelligenceTradeFact[];
  readonly tradesClosed: readonly GrowIntelligenceTradeFact[];
  readonly opportunitiesEvaluated: number;
  readonly opportunitiesRejected: readonly GrowIntelligenceRejectedOpportunityFact[];
  readonly principalDepositsExcluded: GrowMoneyDto;
  readonly withdrawals: GrowMoneyDto;
  readonly performanceAttribution: readonly GrowIntelligencePerformanceAttributionLine[];
  readonly growPaused: boolean;
  readonly providerDegraded: boolean;
  readonly reconciliationProblem: boolean;
  readonly customerActionRequired: boolean;
  readonly factsHash: string;
  readonly assembledAt: UtcInstant;
};

export type StructuredMorningBriefArtifact = {
  readonly schema: 'sunrey.helios.grow.morning-brief.v1';
  readonly reportId: string;
  readonly customerId: string;
  readonly subjectId: string;
  readonly reportingDate: LocalDateKey;
  readonly timeZone: string;
  readonly executionMode: GrowExecutionMode;
  readonly environment: 'simulation';
  readonly growCapital: GrowMoneyDto;
  readonly availableCash: GrowMoneyDto;
  readonly activePositions: readonly GrowIntelligencePositionFact[];
  readonly marketRegimes: readonly GrowIntelligenceRegimeFact[];
  readonly scheduledMarketEvents: readonly GrowIntelligenceScheduledEventFact[];
  readonly monitoredMarkets: readonly GrowIntelligenceMonitoredMarketFact[];
  readonly riskState: string;
  readonly providerLimitations: readonly GrowIntelligenceProviderLimitationFact[];
  readonly dataLimitations: readonly GrowIntelligenceProviderLimitationFact[];
  readonly strategyStateChanges: readonly GrowIntelligenceStrategyStateChangeFact[];
  readonly disclosures: readonly GrowReportDisclosureFlag[];
  readonly factsHash: string;
  readonly generatedAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
  readonly noGuaranteedOutcomes: true;
};

export type StructuredEveningRecapArtifact = {
  readonly schema: 'sunrey.helios.grow.evening-recap.v1';
  readonly reportId: string;
  readonly customerId: string;
  readonly subjectId: string;
  readonly reportingDate: LocalDateKey;
  readonly timeZone: string;
  readonly executionMode: GrowExecutionMode;
  readonly environment: 'simulation';
  readonly startingPortfolioValue: GrowMoneyDto;
  readonly endingPortfolioValue: GrowMoneyDto;
  readonly realizedPnl: GrowMoneyDto;
  readonly unrealizedPnl: GrowMoneyDto;
  readonly fees: GrowMoneyDto;
  readonly tradesOpened: readonly GrowIntelligenceTradeFact[];
  readonly tradesClosed: readonly GrowIntelligenceTradeFact[];
  readonly opportunitiesEvaluated: number;
  readonly opportunitiesRejected: readonly GrowIntelligenceRejectedOpportunityFact[];
  readonly riskInterventions: readonly GrowIntelligenceRiskInterventionFact[];
  readonly availableCash: GrowMoneyDto;
  readonly deployedCapital: GrowMoneyDto;
  readonly withdrawableCash: GrowMoneyDto;
  readonly unsettledCash: GrowMoneyDto;
  readonly performanceAttribution: readonly GrowIntelligencePerformanceAttributionLine[];
  readonly principalDepositsExcluded: GrowMoneyDto;
  readonly withdrawals: GrowMoneyDto;
  readonly depositsAreNotPerformance: true;
  readonly disclosures: readonly GrowReportDisclosureFlag[];
  readonly factsHash: string;
  readonly generatedAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
  readonly rejectedOpportunityNotCounterfactual: true;
};

export type GrowIntelligenceNarrativeSection = {
  readonly heading: string;
  readonly body: string;
  readonly factRefs: readonly string[];
};

export type GrowIntelligenceReport = {
  readonly reportId: string;
  readonly reportType: GrowReportType;
  readonly customerId: string;
  readonly subjectId: string;
  readonly reportingDate: LocalDateKey;
  readonly structured:
    | StructuredMorningBriefArtifact
    | StructuredEveningRecapArtifact;
  readonly narrativeSections: readonly GrowIntelligenceNarrativeSection[];
  readonly summary: string;
  readonly summarizerMode: GrowSummarizerMode;
  readonly summarizerAvailable: boolean;
  readonly factsHash: string;
  readonly generatedAt: UtcInstant;
  readonly serverOwned: true;
};

export type GrowNotificationPreferences = {
  readonly timeZone: string;
  readonly morningBriefEnabled: boolean;
  readonly eveningRecapEnabled: boolean;
  readonly materialPositionEventsEnabled: boolean;
  readonly riskEventsEnabled: boolean;
  readonly operationalEventsEnabled: boolean;
  readonly pushEnabled: boolean;
  readonly emailEnabled: boolean;
  readonly smsEnabled: boolean;
  readonly quietHoursStartMinutes: number | null;
  readonly quietHoursEndMinutes: number | null;
};

export type GrowNotificationEvent = {
  readonly eventId: string;
  readonly type: GrowNotificationEventType;
  readonly occurredAt: UtcInstant;
  readonly customerId: string;
  readonly subjectId: string;
  readonly resourceId: string;
  readonly reportId: string | null;
  readonly summary: string;
  readonly userTitle: string;
  readonly userBody: string;
  readonly priority: GrowNotificationPriority;
  readonly channelHints: readonly GrowNotificationChannel[];
  readonly deduplicationKey: string;
  readonly autoNotify: boolean;
  readonly environment: 'simulation';
  readonly externalProviderRequired: true;
  readonly deliveryAdapterAvailable: boolean;
};

export type GrowNotificationDeliveryRecord = {
  readonly deliveryId: string;
  readonly eventId: string;
  readonly customerId: string;
  readonly deduplicationKey: string;
  readonly channel: GrowNotificationChannel;
  readonly deliveredAt: UtcInstant;
  readonly adapterKind: 'IN_APP' | 'EXTERNAL_PENDING';
};

export type GrowNotificationDeliveryAdapter = {
  readonly adapterAvailable: boolean;
  readonly supportedChannels: readonly GrowNotificationChannel[];
  deliver(event: GrowNotificationEvent, channel: GrowNotificationChannel): GrowNotificationDeliveryRecord | null;
};

export type GrowIntelligenceSummarizerPort = {
  readonly available: boolean;
  summarize(input: {
    readonly reportType: GrowReportType;
    readonly structured: StructuredMorningBriefArtifact | StructuredEveningRecapArtifact;
    readonly factsHash: string;
  }): Promise<readonly GrowIntelligenceNarrativeSection[]> | readonly GrowIntelligenceNarrativeSection[];
};

export type GrowIntelligenceStoreSnapshot = {
  readonly reports: readonly GrowIntelligenceReport[];
  readonly events: readonly GrowNotificationEvent[];
  readonly deliveries: readonly GrowNotificationDeliveryRecord[];
  readonly preferences: Readonly<Record<string, GrowNotificationPreferences>>;
  readonly deliveredKeys: readonly string[];
};

export type GrowIntelligenceFactsPort = {
  assembleFacts(input: {
    readonly customerId: string;
    readonly subjectId: string;
    readonly reportingDate: LocalDateKey;
    readonly periodStart: UtcInstant;
    readonly periodEnd: UtcInstant;
    readonly timeZone: string;
    readonly now: UtcInstant;
  }): GrowIntelligenceFactsSnapshot;
};
