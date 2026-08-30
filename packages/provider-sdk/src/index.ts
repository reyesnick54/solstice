export {
  EXTERNAL_OBSERVATION_SCHEMA,
  NORMALIZATION_SCHEMA_VERSION,
  PROVIDER_CATEGORIES,
  AUTHORITY_CLASSES,
  FRESHNESS_STATUSES,
  VALIDATION_STATUSES,
  COMMERCIAL_USE_STATUSES,
  REDISTRIBUTION_STATUSES,
  CONFIDENCE_BASIS,
  type ProviderCategory,
  type AuthorityClass,
  type FreshnessStatus,
  type ValidationStatus,
  type CommercialUseStatus,
  type RedistributionStatus,
  type ConfidenceBasis,
  type ObservationSource,
  type ObservationTime,
  type ObservationConfidence,
  type ObservationQuality,
  type ObservationProvenance,
  type ObservationLicensing,
  type ExternalObservation,
  type ProviderResult,
} from './types.ts';

export {
  RAW_PAYLOAD_HASH_ALGORITHM,
  canonicalJsonStringify,
  hashRawPayload,
  hashRawJsonPayload,
  type RawPayloadHash,
} from './hash.ts';

export {
  assessFreshness,
  staleAfterFromPolicy,
  expiresAtFromPolicy,
  MARKET_PRICE_FRESHNESS_POLICY,
  MACRO_STATISTIC_FRESHNESS_POLICY,
  type FreshnessPolicy,
  type FreshnessAssessment,
} from './freshness.ts';

export {
  buildConfidence,
  validateConfidenceScore,
  assertValidConfidence,
  type ConfidenceInput,
} from './confidence.ts';

export {
  sanitizeSourceUrl,
  buildObservationSource,
  buildProvenance,
  provenanceDigestMaterial,
} from './provenance.ts';

export {
  requiredString,
  optionalString,
  validateTimestamp,
  validateOptionalTimestamp,
  validateFiniteNumber,
  validateNumericBounds,
  validateCurrencyCode,
  validateCountryCode,
  validateEnumValue,
  rejectUnexpectedNull,
  validateAssetIdentifier,
} from './validation.ts';

export {
  UNTRUSTED_INPUT_LIMITS,
  parseUntrustedJson,
  sanitizeUntrustedText,
  validateSafeUrl,
  type UntrustedPayloadRejectionCode,
  type UntrustedPayloadResult,
} from './untrusted.ts';

export {
  DEFAULT_DEDUPLICATION_POLICIES,
  buildDeduplicationKey,
  createInMemoryDeduplicationRegistry,
  isDuplicate,
  type DeduplicationKeyPart,
  type DeduplicationPolicy,
  type DeduplicationKey,
  type DeduplicationContext,
  type DeduplicationRegistry,
} from './deduplication.ts';

export {
  runNormalizationPipeline,
  type RawProviderResponse,
  type ProviderSchemaValidator,
  type ProviderParser,
  type DomainMapper,
  type ObservationAssembler,
  type NormalizationPipeline,
} from './pipeline.ts';

export {
  buildExternalObservation,
  validateExternalObservation,
  type BuildExternalObservationInput,
} from './observation.ts';

export {
  PROVIDER_DATA_QUALITY_EVENT_TYPES,
  createProviderDataQualityEvent,
  type ProviderDataQualityEventType,
  type ProviderDataQualityPayload,
  type ProviderDataQualityEvent,
  type ProviderDataInvalidV1,
  type ProviderDataStaleV1,
  type ProviderSchemaChangedV1,
  type ProviderDataOutlierV1,
  type ProviderPayloadDuplicateV1,
} from './events.ts';

export {
  EXTERNAL_OBSERVATION_EVIDENCE_KIND,
  toAgentEvidenceRef,
  bundleObservationEvidence,
  type ExternalObservationEvidenceRef,
  type AgentEvidenceBundle,
} from './agent-evidence.ts';
