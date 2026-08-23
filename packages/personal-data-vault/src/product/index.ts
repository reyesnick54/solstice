export {
  CATEGORY_REGISTRY_VERSION,
  DEFAULT_CATEGORY_REGISTRY,
  VAULT_CATEGORY_REGISTRY,
  VAULT_PURPOSES,
  VaultCategoryRegistry,
  type CategoryAvailability,
  type VaultCategoryId,
  type VaultCategoryRecord,
  type VaultPurpose,
} from './category-registry.ts';
export {
  HIGHLY_SENSITIVE_CLASSIFICATIONS,
  PRODUCT_CLASSIFICATIONS,
  classificationFromLegacySensitivity,
  isHighlySensitiveClassification,
  isProductClassification,
  type ProductClassification,
} from './classification.ts';
export {
  CORRECTION_KINDS,
  correctionKindFor,
  userMayOverwrite,
  type VaultCorrectionRequest,
} from './correction.ts';
export {
  CANONICAL_PERSONAL_DATA_FABRIC,
  PHASE_H_DATA_ARCHITECTURE_AUDIT,
} from './fabric.ts';
export { newVaultCorrectionId, newVaultExportJobId } from './ids.ts';
export {
  DATA_KINDS,
  VERIFICATION_STATES,
  kindFromProvenance,
  verificationFromKind,
  type DataKind,
  type VerificationState,
} from './kinds.ts';
export { FORBIDDEN_PAYLOAD_KEYS, findForbiddenPayloadField } from './minimization.ts';
export { SUNREY_DOES_NOT_OWN_USER_DATA, ownershipForSubject, type VaultOwnership } from './ownership.ts';
export {
  VAULT_PERSONAS_ARE_SIMULATION_ONLY,
  VAULT_PERSONA_IDS,
  VAULT_PERSONA_SEEDS,
  vaultPersonaSeed,
  type VaultPersonaId,
} from './personas.ts';
export { enhanceProvenance, type RecordProvenance } from './provenance.ts';
export {
  defaultRecordMetadata,
  projectVaultDataRecord,
  type VaultDataRecord,
  type VaultRecordMetadata,
} from './record.ts';
export { RETENTION_POLICIES, retentionPolicyById, type ProductRetentionPolicy } from './retention.ts';
export {
  PersonalDataVaultProduct,
  type ClientVaultHome,
  type ClientVaultRecord,
  type PersonalDataVaultProductOptions,
  type ProductVaultFailure,
  type ProductVaultSnapshot,
  type VaultExportJob,
} from './service.ts';
