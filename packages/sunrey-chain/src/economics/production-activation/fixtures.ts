/**
 * Current-repository and test snapshots for the activation firewall.
 *
 * Current main does not invent production tokenomics. Parameters stay
 * UNCONFIGURED. Test-only configured parameters never become repository
 * defaults.
 *
 * Cross-package owners are consumed as version bindings and known
 * current posture. This file does not add new package dependencies.
 */

import { FIRST_MAINNET_RC_ID } from '../../release-candidate/mainnet/types.ts';
import { FIRST_ECONOMIC_RC_ID } from '../../release-candidate/economic/types.ts';
import { PRODUCTION_HANDOFF_TOOL_VERSION } from '../../production-handoff/types.ts';
import { PREGENESIS_TOOL_VERSION } from '../../pregenesis/types.ts';
import { LAUNCH_PLAN_DOMAIN } from '../../genesis-execution/hash.ts';
import { MONETARY_POLICY_VERSION_ID } from '../types.ts';
import { emptyBook, supplyReconciles } from '../supply.ts';
import { PRODUCTION_CONVERSION_POLICY_STATUS } from '../human-contribution-bridge/types.ts';
import { SOURCE_TAXONOMY_ID } from '../../productive/source-taxonomy/types.ts';
import { NORMALIZATION_CONSTITUTION_VERSION } from '../../units/constitution.ts';
import { DEVELOPMENT_ATTRIBUTION_POLICY_ID } from '../../productive/policy-governance/attribution/policy.ts';
import { PRODUCTION_VALUE_POLICY_STATUS } from '../../productive/policy-governance/value-function/types.ts';
import { PRODUCTION_CONVERSION_STATUS } from '../../productive/policy-governance/value-settlement/types.ts';
import { CERTIFICATION_POLICY_VERSION } from '../../oracle/production/certification/types.ts';
import {
  ECONOMIC_DATA_FABRIC_ID,
  ECONOMIC_DATA_FABRIC_VERSION,
} from '../../oracle/production/economic-data-fabric/types.ts';
import { buildCoverageReport } from '../../oracle/production/economic-data-fabric/coverage.ts';
import { encodeString, sha256Hex } from '../../validators/canonical.ts';

import { compatiblePair } from './bindings.ts';
import { currentLiveFlags } from './invariants.ts';
import {
  completeFixturePackageInput,
  productionParameterRecordsFromPackage,
} from './parameter-package/index.ts';
import { currentUnconfiguredParameters, unconfiguredParameter } from './parameters.ts';
import {
  BINDING_KEYS,
  PRODUCTION_PARAMETER_IDS,
  type ActivationEvidenceRecord,
  type BindingKey,
  type ProductionEconomicActivationSnapshot,
  type ProductionParameterId,
  type ProductionParameterRecord,
  type VersionBinding,
} from './types.ts';

function hashOf(value: string): string {
  return sha256Hex(encodeString(value));
}

function bind(key: BindingKey, versionId: string): VersionBinding {
  return Object.freeze({
    key,
    versionId,
    contentHash: hashOf(`${key}:${versionId}`),
  });
}

/** Bound HEC / HIN / EAR identifiers. Not an unbound "latest" reference. */
const HEC_VERIFICATION_POLICY = 'sunrey-human-contribution-verification-engineering-v1' as const;
const HEC_VALUATION_POLICY_STATUS = 'UNCONFIGURED' as const;
const HIN_POLICY_VERSION = 'hin-policy-v1' as const;
const HIN_CHAIN_ANCHOR_CAPABILITY = 'hin.on-chain-anchor.engineering.v1' as const;
const EAR_VERIFICATION_POLICY = 'sunrey-economic-asset-verification-engineering-v1' as const;

export const PRODUCTION_ECONOMIC_SOURCE_ID = 'sunrey.repository.constitution-bound.v1' as const;

export function currentRepositoryBindings(): readonly VersionBinding[] {
  return Object.freeze([
    bind('sourceCommit', `${MONETARY_POLICY_VERSION_ID}:${PRODUCTION_ECONOMIC_SOURCE_ID}`),
    bind('mainnetRc', FIRST_MAINNET_RC_ID),
    bind('economicRc', FIRST_ECONOMIC_RC_ID),
    bind('pregenesisQualification', PREGENESIS_TOOL_VERSION),
    bind('productionHandoff', PRODUCTION_HANDOFF_TOOL_VERSION),
    bind('genesisPlan', LAUNCH_PLAN_DOMAIN),
    bind('monetaryConstitution', MONETARY_POLICY_VERSION_ID),
    bind('sunreyContributionVerificationPolicy', HEC_VERIFICATION_POLICY),
    bind('sunreyContributionValuationPolicy', HEC_VALUATION_POLICY_STATUS),
    bind('sunreySettlementConversionPolicy', PRODUCTION_CONVERSION_POLICY_STATUS),
    bind('moonreySourceTaxonomy', SOURCE_TAXONOMY_ID),
    bind('canonicalUnitConstitution', NORMALIZATION_CONSTITUTION_VERSION),
    bind('moonreyAttributionPolicy', DEVELOPMENT_ATTRIBUTION_POLICY_ID),
    bind('moonreyProductiveValuePolicy', PRODUCTION_VALUE_POLICY_STATUS),
    bind('moonreyGpuvConversionPolicy', PRODUCTION_CONVERSION_STATUS),
    bind('oracleCertificationPolicy', CERTIFICATION_POLICY_VERSION),
    bind('economicDataFabricVersion', `${ECONOMIC_DATA_FABRIC_ID}:${String(ECONOMIC_DATA_FABRIC_VERSION)}`),
    bind('hinPolicy', HIN_POLICY_VERSION),
    bind('hinChainAnchorCapability', HIN_CHAIN_ANCHOR_CAPABILITY),
    bind('economicAssetVerificationPolicy', EAR_VERIFICATION_POLICY),
  ]);
}

export function currentRepositorySnapshot(): ProductionEconomicActivationSnapshot {
  const coverage = buildCoverageReport();
  const sunreyBook = emptyBook('SUNREY_COIN', MONETARY_POLICY_VERSION_ID);
  const moonreyBook = emptyBook('MOONREY_COIN', MONETARY_POLICY_VERSION_ID);
  const semanticReviewRequired = coverage.productiveCategories
    .filter((row) => row.flags.semanticReviewRequired)
    .map((row) => row.productiveCategory);
  const unitExtensionRequired = coverage.productiveCategories
    .filter((row) => row.flags.unitExtensionRequired)
    .map((row) => row.productiveCategory);
  const missingProviderCoverage = [...coverage.productiveCategoryGaps];
  return Object.freeze({
    bindings: currentRepositoryBindings(),
    parameters: currentUnconfiguredParameters(),
    evidence: Object.freeze([]),
    hinGates: Object.freeze({
      privacyReview: false,
      legalAnalysis: false,
      jurisdictionPolicy: false,
      termsAgreements: false,
      requesterControls: false,
      humanAuthorization: false,
    }),
    hinChainAnchor: Object.freeze({
      consentAnchorPath: true,
      usageAnchorPath: true,
      revocationAnchorPath: true,
      finality: false,
      reconciliation: false,
      reorgHandling: false,
      privacyClassification: true,
    }),
    coverageGaps: Object.freeze({
      unitExtensionRequired: Object.freeze(unitExtensionRequired),
      semanticReviewRequired: Object.freeze(semanticReviewRequired),
      missingProviderCoverage: Object.freeze(missingProviderCoverage),
    }),
    policyBindings: Object.freeze([
      compatiblePair(
        'moonreyProductiveValuePolicy',
        PRODUCTION_VALUE_POLICY_STATUS,
        'moonreyGpuvConversionPolicy',
        PRODUCTION_CONVERSION_STATUS,
      ),
    ]),
    supply: Object.freeze({
      canonicalSupplyBook: true,
      sunreyReconciles: supplyReconciles(sunreyBook),
      moonreyReconciles: supplyReconciles(moonreyBook),
      hiddenPremint: false,
      faucetMigration: false,
      rehearsalBalanceMigration: false,
      automaticApplicationLedgerMigration: false,
      genesisAllocationAuthorized: false,
    }),
    oracleEvidence: Object.freeze({
      realProviderOnboarding: false,
      dataLicense: false,
      usageRight: false,
      securityReview: false,
      jurisdiction: false,
      sourceDiversity: false,
      quality: false,
      keyManagement: false,
      operationalMonitoring: false,
      sandboxProvider: true,
    }),
    externalSecurity: Object.freeze({
      assessmentProvided: false,
      openCriticalFindings: 0,
      openHighFindings: 0,
      retestEvidence: false,
      cryptographicReview: false,
      providerSecurity: false,
      hsmProvider: false,
    }),
    legalRegulatory: Object.freeze({
      counselOpinion: false,
      licenseOrRegistration: false,
      regulatoryApproval: false,
      partnerAgreement: false,
      jurisdictionOperatingApproval: false,
    }),
    humanAuthorizations: Object.freeze([]),
    liveFlags: currentLiveFlags(),
    moonreyLegacyV1Only: false,
    moonreyV2EngineeringReady: true,
    moonreyValuePolicyClass: 'ENGINEERING_SIMULATION_PARAMETERS',
    sunreyEngineeringReady: true,
    exchangeEngineeringReady: true,
    intendedProductionCategories: Object.freeze(coverage.productiveCategories.map((row) => row.productiveCategory)),
  });
}

export function configuredParameter(
  id: ProductionParameterId,
  value: string,
): ProductionParameterRecord {
  const records = productionParameterRecordsFromPackage(
    completeFixturePackageInput({ [id]: value }),
  );
  const found = records.find((row) => row.id === id);
  if (!found) {
    throw new TypeError(`fixture adapter did not produce ${id}`);
  }
  return found;
}

export function allConfiguredParameters(
  overrides: Partial<Record<ProductionParameterId, string>> = {},
): readonly ProductionParameterRecord[] {
  const byId = new Map(
    productionParameterRecordsFromPackage(completeFixturePackageInput(overrides)).map((row) => [row.id, row]),
  );
  return Object.freeze(PRODUCTION_PARAMETER_IDS.map((id) => byId.get(id) ?? unconfiguredParameter(id)));
}

export function simulationConversionParameter(id: ProductionParameterId): ProductionParameterRecord {
  return Object.freeze({
    id,
    status: 'CONFIGURED',
    sourceClass: 'ENGINEERING_SIMULATION_PARAMETERS',
    versionId: 'simulation.v1',
    valueHash: hashOf(`simulation:${id}`),
    governed: true,
    infrastructureMetadataOnly: false,
  });
}

function evidence(input: {
  readonly requirementId: string;
  readonly evidenceClass: ActivationEvidenceRecord['evidenceClass'];
  readonly fixture?: boolean;
  readonly fixtureKind?: string | null;
  readonly actorKind?: ActivationEvidenceRecord['actorKind'];
  readonly actorId?: string | null;
}): ActivationEvidenceRecord {
  return Object.freeze({
    evidenceId: `ev.${input.requirementId}`,
    requirementId: input.requirementId,
    evidenceClass: input.evidenceClass,
    description: input.requirementId,
    fixture: input.fixture === true,
    fixtureKind: input.fixtureKind ?? null,
    actorKind: input.actorKind ?? null,
    actorId: input.actorId ?? null,
    reference: null,
    contentHash: hashOf(input.requirementId),
  });
}

const REQUIRED_EXTERNAL = [
  'SHARED.EXTERNAL_SECURITY',
  'SHARED.LEGAL_EVIDENCE',
  'SHARED.REGULATORY_EVIDENCE',
  'SHARED.PARTNER_EVIDENCE',
  'ORACLE.PROVIDER_EVIDENCE',
  'ORACLE.LICENSE_EVIDENCE',
  'HIN.PRIVACY_REVIEW',
  'HIN.LEGAL_REVIEW',
] as const;

export function candidateReadySnapshot(): ProductionEconomicActivationSnapshot {
  const current = currentRepositorySnapshot();
  return Object.freeze({
    ...current,
    parameters: allConfiguredParameters(),
    moonreyLegacyV1Only: false,
    moonreyV2EngineeringReady: true,
    moonreyValuePolicyClass: 'GOVERNED_PRODUCTION_PARAMETER',
    hinGates: Object.freeze({
      privacyReview: true,
      legalAnalysis: true,
      jurisdictionPolicy: true,
      termsAgreements: true,
      requesterControls: true,
      humanAuthorization: true,
    }),
    hinChainAnchor: Object.freeze({
      consentAnchorPath: true,
      usageAnchorPath: true,
      revocationAnchorPath: true,
      finality: true,
      reconciliation: true,
      reorgHandling: true,
      privacyClassification: true,
    }),
    coverageGaps: Object.freeze({
      unitExtensionRequired: Object.freeze([]),
      semanticReviewRequired: Object.freeze([]),
      missingProviderCoverage: Object.freeze([]),
    }),
    intendedProductionCategories: Object.freeze(['ENERGY']),
    oracleEvidence: Object.freeze({
      realProviderOnboarding: true,
      dataLicense: true,
      usageRight: true,
      securityReview: true,
      jurisdiction: true,
      sourceDiversity: true,
      quality: true,
      keyManagement: true,
      operationalMonitoring: true,
      sandboxProvider: false,
    }),
    externalSecurity: Object.freeze({
      assessmentProvided: true,
      openCriticalFindings: 0,
      openHighFindings: 0,
      retestEvidence: true,
      cryptographicReview: true,
      providerSecurity: true,
      hsmProvider: true,
    }),
    legalRegulatory: Object.freeze({
      counselOpinion: true,
      licenseOrRegistration: true,
      regulatoryApproval: true,
      partnerAgreement: true,
      jurisdictionOperatingApproval: true,
    }),
    supply: Object.freeze({
      ...current.supply,
      genesisAllocationAuthorized: true,
    }),
    humanAuthorizations: Object.freeze([
      humanSlot('PROTOCOL_AUTHORITY'),
      humanSlot('SECURITY_AUTHORITY'),
      humanSlot('RELEASE_AUTHORITY'),
      humanSlot('LEGAL_AUTHORITY'),
    ]),
    evidence: Object.freeze(REQUIRED_EXTERNAL.map((requirementId) => evidence({ requirementId, evidenceClass: 'EXTERNAL' }))),
  });
}

export function humanSlot(role: string, actorKind: 'HUMAN' | 'AI' | 'S3M' | 'GROK' | 'AGENT' = 'HUMAN') {
  return Object.freeze({
    role,
    actorKind,
    actorId: actorKind === 'HUMAN' ? `human.${role.toLowerCase()}` : `${actorKind.toLowerCase()}.${role.toLowerCase()}`,
    accepted: true,
    fixtureSignature: false,
  });
}

export function withSnapshot(
  base: ProductionEconomicActivationSnapshot,
  overlay: Partial<ProductionEconomicActivationSnapshot>,
): ProductionEconomicActivationSnapshot {
  return Object.freeze({ ...base, ...overlay });
}

export function withUnconfigured(id: ProductionParameterId): ProductionEconomicActivationSnapshot {
  const parameters = allConfiguredParameters().map((row) => (row.id === id ? unconfiguredParameter(id) : row));
  return withSnapshot(candidateReadySnapshot(), { parameters: Object.freeze(parameters) });
}

export function bindingKeysComplete(): boolean {
  return BINDING_KEYS.every((key) => currentRepositoryBindings().some((row) => row.key === key));
}
