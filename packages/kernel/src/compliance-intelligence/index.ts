/**
 * Wave 4 Prompt 15 — compliance intelligence public exports.
 */

export {
  COMPLIANCE_EVIDENCE_SCHEMA,
  COMPLIANCE_DECISION_SCHEMA,
  COMPLIANCE_SUBJECT_TYPES,
  COMPLIANCE_EVIDENCE_CLASSIFICATIONS,
  COMPLIANCE_MATCH_TYPES,
  PEP_RELATIONSHIP_TYPES,
  VERIFICATION_STATUSES,
  DEFAULT_RESCREEN_CONFIG,
} from './types.ts';
export type {
  ComplianceSubjectType,
  ComplianceEvidenceClassification,
  ComplianceMatchType,
  PepRelationshipType,
  VerificationStatus,
  ComplianceSubject,
  ComplianceMatchDimensions,
  ComplianceEvidenceSource,
  ComplianceEvidenceTime,
  ComplianceEvidenceQuality,
  ComplianceEvidenceProvenance,
  PepEvidenceDetails,
  ComplianceEvidence,
  ComplianceDecision,
  ComplianceScreeningQuery,
  ComplianceScreeningResult,
  ProviderDisagreementRecord,
  ComplianceRescreenConfig,
} from './types.ts';

export {
  complianceSeparationProof,
  assertEvidenceNotDecision,
  evidenceCannotRejectTransaction,
  evidenceCannotFreezeAccount,
} from './separation.ts';

export {
  normalizeComplianceName,
  normalizeAliasList,
  tokenOverlapScore,
  isExactNameMatch,
  isFuzzyNameMatch,
} from './name-normalization.ts';

export {
  buildComplianceCatalogIndex,
  COMPLIANCE_CATALOG_ID,
  COMPLIANCE_EXPECTED_PROVIDER_COUNT,
  type ComplianceAuthorityClass,
  type ComplianceCatalogProviderEntry,
  type ComplianceCatalogIndex,
} from './catalog-types.ts';

export {
  COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES,
  COMPLIANCE_INTELLIGENCE_CATALOG_PROVIDER_IDS,
  type ComplianceIntelligenceCatalogProviderId,
} from './catalog-entries.ts';

export {
  COMPLIANCE_CACHE_CAPABILITIES,
  complianceCachePolicy,
  type ComplianceCacheCapability,
  type ComplianceCachePolicy,
} from './cache-policies.ts';

export {
  privacySafeSubjectRef,
  privacySafeEvidenceLogRef,
  sanitizeComplianceLogPayload,
  assertNoSensitiveDataInLog,
} from './privacy.ts';

export {
  COMPLIANCE_INTELLIGENCE_CAPABILITIES,
  providerSupportsClassification,
  type ComplianceIntelligenceCapability,
  type ComplianceIntelligenceProviderHealth,
  type ComplianceIntelligenceProvider,
} from './provider.ts';

export { loadComplianceIntelligenceCatalog, createComplianceIntelligenceAdapterFactory } from './registry.ts';

export {
  ComplianceScreeningEvidenceService,
  createComplianceScreeningEvidenceService,
  createComplianceIntelligenceSandbox,
  type ComplianceScreeningEvidenceServiceOptions,
} from './service.ts';

export {
  bridgeEvidenceToKernel,
  kernelEscalationFromEvidenceFacts,
  evidenceGrantsExecutionAuthority,
  agentMayBypassKernel,
  exchangeMayBypassKernel,
  blockchainConsensusDependsOnProvider,
  type EvidenceKernelBridgeResult,
} from './bridge.ts';

export { buildComplianceAgentEvidence, evidenceToAgentItem, type ComplianceAgentEvidence } from './agent-evidence.ts';

export { buildExchangeComplianceContext, type ExchangeComplianceEvidenceContext } from './exchange-integration.ts';

export { COMPLIANCE_INTELLIGENCE_REFRESH_SCHEDULES } from './refresh-schedules.ts';

export {
  createWave4ComplianceFixtureProviders,
  createAllComplianceIntelligenceAdapters,
  createOpenSanctionsAdapter,
  createInterpolRedNoticesAdapter,
  OpenSanctionsAdapter,
  InterpolRedNoticesAdapter,
} from './adapters/index.ts';

import { asUtcInstant } from '../../../domain/src/time.ts';

export function complianceIntelligenceNow() {
  return asUtcInstant(new Date().toISOString());
}
