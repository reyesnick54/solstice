/**
 * HELIOS execution connectivity — extends canonical custody (not a second custody plane).
 */

export {
  HELIOS_EXEC08_ASSET_SEGREGATION,
  EXTERNAL_ACCOUNT_REPRESENTATION_MODELS,
  ASSET_AVAILABILITY_STATES,
  EXTERNAL_ACCOUNT_STATUSES,
  EXTERNAL_ACCOUNT_PERMISSIONS,
  BENEFICIAL_OWNER_BINDING_STATUSES,
  EXEC08_RECORD_TRUTH,
} from './taxonomy.ts';
export type {
  ExternalAccountRepresentationModel,
  AssetAvailabilityStateKind,
  ExternalAccountStatus,
  ExternalAccountPermission,
  BeneficialOwnerBindingStatus,
} from './taxonomy.ts';
export {
  asExternalCustodyAccountId,
  asBeneficialOwnerBindingId,
  asExternalDigitalPositionId,
  asExec08ReconciliationId,
} from './ids.ts';
export type {
  ExternalCustodyAccountId,
  BeneficialOwnerBindingId,
  ExternalDigitalPositionId,
  Exec08ReconciliationId,
} from './ids.ts';
export {
  assetAvailabilityFromParts,
  freezeAssetAvailabilityState,
  freezeBeneficialOwnerBinding,
  freezeExternalCustodyAccount,
  freezeExternalDigitalAssetPosition,
} from './types.ts';
export type {
  AssetAvailabilityState,
  BeneficialOwnerBinding,
  ExternalCustodyAccount,
  ExternalDigitalAssetPosition,
  LegalOwnerReference,
} from './types.ts';
export { reconcileCustodyProviderToLedger } from './reconciliation.ts';
export type {
  Exec08CustodyBreakKind,
  Exec08CustodyReconciliationBreak,
  Exec08CustodyReconciliationReport,
} from './reconciliation.ts';
export {
  HELIOS_EXEC08_ASSET_SEGREGATION_QUALIFIED,
  HELIOS_EXEC08_ASSET_SEGREGATION_BLOCKED,
  defaultExec08QualificationChecksPass,
  evaluateExec08AssetSegregationQualification,
} from './qualification.ts';
export type { Exec08QualificationChecks, Exec08QualificationResult } from './qualification.ts';

export * from './exec11/index.ts';
