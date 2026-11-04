export {
  EXTERNAL_EARNINGS_OBSERVATION_SCHEMA,
  type ExternalEarningsProviderRef,
  type ExternalEarningsObservationEnvelope,
} from './types.ts';

export { mapSecGuidanceToExternalEarningsEnvelope } from './sec-guidance-bridge.ts';

export * from './taxonomy.ts';
export * from './ports.ts';
export * from './identity.ts';
export * from './session-timing.ts';
export * from './dedupe.ts';
export * from './ingest.ts';
export * from './sec-edgar-adapter.ts';
export type {
  EarningsExternalObservation,
  EarningsFiscalIdentity,
  EarningsEventTimeBundle,
  EarningsObservationProvenance,
  IngestEarningsObservationInput,
  IngestEarningsObservationResult,
} from './types.ts';
export {
  ADVERSARIAL_ENTITY_ID,
  ADVERSARIAL_EVENT_KEY,
  ADVERSARIAL_FISCAL,
  ADVERSARIAL_EARNINGS_TIMELINE,
  CALENDAR_INITIAL_SCHEDULE,
  CALENDAR_RESCHEDULE,
  IR_EARLY_RELEASE,
  IR_DUPLICATE_RELEASE,
  SEC_8K_RELEASE,
  SEC_8K_AMENDMENT,
} from './fixtures/adversarial-timeline.ts';
