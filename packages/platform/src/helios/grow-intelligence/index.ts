/**
 * HELIOS Multi-Asset M27 — Grow Intelligence, Morning Brief, Evening Recap,
 * and provider-neutral notification event framework.
 */

export {
  HELIOS_GROW_INTELLIGENCE_SCHEMA,
  HELIOS_GROW_INTELLIGENCE_AUTHORITY,
  GROW_REPORT_TYPES,
  GROW_NOTIFICATION_EVENT_TYPES,
  GROW_NOTIFICATION_CHANNELS,
  GROW_NOTIFICATION_PRIORITIES,
  GROW_SUMMARIZER_MODES,
  GROW_EXECUTION_MODES,
  GROW_REPORT_DISCLOSURE_FLAGS,
  GROW_NOTIFICATION_PRIORITY_BY_TYPE,
  HELIOS_MULTI_ASSET_M27,
  type GrowReportType,
  type GrowNotificationEventType,
  type GrowNotificationChannel,
  type GrowNotificationPriority,
  type GrowSummarizerMode,
  type GrowExecutionMode,
  type GrowReportDisclosureFlag,
} from './taxonomy.ts';

export type {
  GrowIntelligencePositionFact,
  GrowIntelligenceRegimeFact,
  GrowIntelligenceScheduledEventFact,
  GrowIntelligenceMonitoredMarketFact,
  GrowIntelligenceRiskInterventionFact,
  GrowIntelligenceProviderLimitationFact,
  GrowIntelligenceStrategyStateChangeFact,
  GrowIntelligenceTradeFact,
  GrowIntelligenceRejectedOpportunityFact,
  GrowIntelligencePerformanceAttributionLine,
  GrowIntelligenceFactsSnapshot,
  StructuredMorningBriefArtifact,
  StructuredEveningRecapArtifact,
  GrowIntelligenceNarrativeSection,
  GrowIntelligenceReport,
  GrowNotificationPreferences,
  GrowNotificationEvent,
  GrowNotificationDeliveryRecord,
  GrowNotificationDeliveryAdapter,
  GrowIntelligenceSummarizerPort,
  GrowIntelligenceStoreSnapshot,
  GrowIntelligenceFactsPort,
} from './types.ts';

export { hashGrowIntelligenceFacts } from './facts-hash.ts';
export { buildStructuredMorningBrief } from './morning-brief.ts';
export { buildStructuredEveningRecap } from './evening-recap.ts';
export {
  buildDeterministicNarrative,
  buildDeterministicMorningNarrative,
  buildDeterministicEveningNarrative,
  summarizeReportSections,
  buildReportSummary,
} from './narrative.ts';
export {
  DEFAULT_GROW_NOTIFICATION_PREFERENCES,
  createGrowNotificationEvent,
  GrowNotificationService,
  isWithinQuietHours,
} from './notifications.ts';
export {
  DEFAULT_MORNING_BRIEF_MINUTES,
  DEFAULT_EVENING_RECAP_MINUTES,
  evaluateReportSchedule,
  resolveNowMinutes,
  resolveReportingDate,
  type GrowReportScheduleDecision,
} from './scheduler.ts';
export { InMemoryGrowIntelligenceStore } from './store.ts';
export { GrowIntelligenceService, type GrowIntelligenceServiceOptions } from './service.ts';
export {
  createFixtureFactsPort,
  fixtureGrowIntelligenceFacts,
  type GrowIntelligenceScenario,
} from './fixtures.ts';
export {
  HELIOS_MULTI_ASSET_M27_GROW_INTELLIGENCE_QUALIFIED,
  HELIOS_MULTI_ASSET_M27_GROW_INTELLIGENCE_BLOCKED,
  evaluateGrowIntelligenceQualification,
  type GrowIntelligenceQualificationChecks,
  type GrowIntelligenceQualificationResult,
} from './qualification.ts';
