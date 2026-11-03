export {
  SEC_FUNDAMENTAL_OBSERVATION_SCHEMA,
  SEC_FORMS,
  AMENDMENT_KINDS,
  type SecForm,
  type AmendmentKind,
  type FundamentalObservationProvenance,
  type AmendmentLineage,
  type CompanyFilingObservation,
  type FinancialStatementObservation,
  type FinancialFactObservation,
  type SegmentObservation,
  type GuidanceObservation,
  type CorporateActionObservation,
  type SecFundamentalObservation,
  type SecFundamentalObservationKind,
} from './types.ts';

export {
  runSecEdgarAsFiledDataflow,
  materializeSubmissionObservations,
  filterKnowableObservations,
  parseEdgarAcceptanceTimestamp,
  type SecEdgarSubmissionRecord,
  type SecEdgarFactRecord,
} from './edgar-dataflow.ts';

export { ingestSecFundamentalSubmissions, type SecFundamentalsIngestResult } from './ingest.ts';

export {
  SIMCORP_CIK,
  SIMCORP_ENTITY_ID,
  SIMCORP_TICKER,
  SIMCORP_SUBMISSION_TIMELINE,
  SIMCORP_Q2_2024_10Q,
  SIMCORP_Q2_2024_10Q_A,
  simcorpKnowableAt,
} from './fixtures/simcorp-timeline.ts';
