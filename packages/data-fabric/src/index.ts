export { PERSONAL_DATA_CATEGORIES, isPersonalDataCategory } from './categories.ts';
export { PROVENANCE, asSyntheticLabel, rejectRealProvenance } from './provenance.ts';
export type { SyntheticLabel, RealLabel } from './provenance.ts';

export type { CategoryKeyProvider, KeyRef, SealedEnvelope } from './keys/provider.ts';
export { SimulatedLocalKeyProvider } from './keys/simulated-local.ts';

export type { CategoryStore, StoredEnvelope, VaultStorage } from './storage/interface.ts';
export { InMemoryVaultStorage } from './storage/memory.ts';

export {
  classifySyntheticWrite,
  rejectUnclassified,
} from './vault/record.ts';
export type { ClassifiedSyntheticRecord, ClassifiedAttributes } from './vault/record.ts';
export { SegmentedPersonalDataVault } from './vault/segmented-vault.ts';
export type { VaultWriteReceipt } from './vault/segmented-vault.ts';

export {
  ACCESS_REQUEST_FIELDS,
  parseAccessRequest,
} from './purpose/access-request.ts';
export type { AccessRequest, AccessRequestField, AccessRequestRejection } from './purpose/access-request.ts';
export { PurposeFirewall } from './purpose/firewall.ts';
export type { PurposeAuthorization, FirewallDenial } from './purpose/firewall.ts';

export { ConsentLedger } from './consent/ledger.ts';
export type {
  ConsentRecord,
  ConsentGrantInput,
  IdentityExposureLevel,
} from './consent/types.ts';
export { IDENTITY_EXPOSURE_LEVELS, CONSENT_STATUSES } from './consent/types.ts';

export { CleanRoom, MIN_COHORT_SIZE } from './clean-room/engine.ts';
export type { AuthorizedAggregate, CleanRoomQuery, CleanRoomJob } from './clean-room/engine.ts';
export { PrivacyBudgetLedger, DEFAULT_PRIVACY_BUDGET_UNITS } from './clean-room/budget.ts';
export { HashIntegerNoiseMechanism } from './clean-room/differential-privacy.ts';
export type { DifferentialPrivacyMechanism } from './clean-room/differential-privacy.ts';

export { ModelRegistry, registerDataValuationModel, DATA_VALUATION_MODEL_ID } from './valuation/registry.ts';
export { indicativeCompensation } from './valuation/model.ts';
export type { IndicativeCompensation } from './valuation/model.ts';

export { generateSyntheticPopulation, syntheticSubjectRefs } from './synthetic/generator.ts';
export { PersonalDataFabric } from './fabric.ts';
