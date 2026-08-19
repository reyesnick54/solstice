import { sha256Canonical, verificationDecisionIdFor } from '../ids.ts';
import { scanForbiddenPayload } from '../invariants.ts';
import { PRODUCTIVE_ECONOMIC_CATEGORIES } from '../taxonomy.ts';
import type { EconomicAssetDescriptor } from '../types.ts';
import { classRuleFor } from './policy.ts';
import { collectChainAnchorCodes, collectLineageCodes, collectProvenanceCodes, collectStorageSensitivityCodes } from './provenance.ts';
import { requiresAdditionalEvidence, type EconomicAssetVerificationCode } from './rejections.ts';
import { collectRightsCodes } from './rights.ts';
import type {
  EconomicAssetVerificationDecision,
  EconomicAssetVerificationInput,
  EconomicAssetVerificationOutcome,
  EconomicAssetVerificationPolicy,
} from './types.ts';

const PRODUCTIVE_CATEGORIES = new Set<string>(PRODUCTIVE_ECONOMIC_CATEGORIES);
const JURISDICTION_RE = /^[A-Z]{2}(?:-[A-Z0-9]{1,8})?$/;

function rememberInto(codes: EconomicAssetVerificationCode[]): (code: EconomicAssetVerificationCode) => void {
  return (code) => {
    if (!codes.includes(code)) {
      codes.push(code);
    }
  };
}

function collectCodes(input: EconomicAssetVerificationInput): EconomicAssetVerificationCode[] {
  const { descriptor, policy, knownAssets } = input;
  const codes: EconomicAssetVerificationCode[] = [];
  const remember = rememberInto(codes);

  if (policy.productionActivated !== false) {
    remember('MINT_AUTHORITY_FORBIDDEN');
  }
  if (policy.state !== 'SIMULATION' && policy.state !== 'DEVELOPMENT') {
    remember('POLICY_NOT_ACTIVE');
  }

  const scanned = scanForbiddenPayload({
    sourceSystem: descriptor.sourceSystem,
    canonicalOwnerSystem: descriptor.canonicalOwnerSystem,
    jurisdiction: descriptor.jurisdiction,
  });
  if (!scanned.ok && scanned.error.code === 'RAW_SENSITIVE_DATA_FORBIDDEN') {
    remember('RAW_DATA_FORBIDDEN');
  }

  if (descriptor.issuanceEligible !== false || descriptor.automaticSunReyQuantity !== null || descriptor.automaticMoonReyQuantity !== null) {
    remember('MINT_AUTHORITY_FORBIDDEN');
  }
  if (descriptor.authorityBoundary.authorizesSettlement || descriptor.authorityBoundary.authorizesSunReyIssuance) {
    remember('SETTLEMENT_AUTHORITY_FORBIDDEN');
  }

  const rule = classRuleFor(policy, descriptor.assetClass);
  if (!rule || !rule.enabled || rule.failClosed) {
    remember('OTHER_CLASS_FAIL_CLOSED');
    remember('ASSET_CLASS_NOT_ELIGIBLE');
  }

  if (policy.jurisdictionRequirements.mustResolve) {
    if (!JURISDICTION_RE.test(descriptor.jurisdiction) || !policy.jurisdictionRequirements.allowedCodedJurisdictions.includes(descriptor.jurisdiction)) {
      remember('JURISDICTION_UNRESOLVED');
    }
  }

  if (rule) {
    collectRightsCodes(descriptor, policy, rule, remember);
    collectProvenanceCodes(descriptor, policy, rule, remember);
    collectStorageSensitivityCodes(descriptor, policy, rule, remember);
    collectLineageCodes(descriptor, knownAssets, policy, rule, remember);

    if (rule.requireVerifiedContributionClaim && (descriptor.qualityClass === 'VERIFIED' || descriptor.status === 'VERIFIED')) {
      if (descriptor.sourceClass !== 'HUMAN_CONTRIBUTION_REGISTRY' && descriptor.assetClass === 'HUMAN_CONTRIBUTION_RECORD') {
        remember('CONTRIBUTION_REFERENCE_REQUIRED');
      }
      if (!descriptor.provenanceDigest) {
        remember('CONTRIBUTION_FINGERPRINT_REQUIRED');
      }
    }

    if (rule.requireCurrentFreshness && descriptor.freshness === 'STALE') {
      remember('FRESHNESS_INSUFFICIENT');
    }
    if (rule.minimumConfidence && !rule.minimumConfidence.includes(descriptor.confidenceClass)) {
      remember('CONFIDENCE_INSUFFICIENT');
    }
    if (rule.minimumQuality && !rule.minimumQuality.includes(descriptor.qualityClass)) {
      remember('CONFIDENCE_INSUFFICIENT');
    }
    if (rule.requireProductiveCategory && !PRODUCTIVE_CATEGORIES.has(descriptor.economicCategory)) {
      remember('DOMAIN_MISMATCH');
    }
  }

  collectChainAnchorCodes(descriptor, policy, remember);
  return codes;
}

function outcomeOf(codes: readonly EconomicAssetVerificationCode[]): EconomicAssetVerificationOutcome {
  if (codes.length === 0) {
    return 'VERIFIED';
  }
  if (codes.every((code) => requiresAdditionalEvidence(code))) {
    return 'REQUIRES_ADDITIONAL_EVIDENCE';
  }
  return 'REJECTED';
}

function qualityOf(descriptor: EconomicAssetDescriptor, decision: EconomicAssetVerificationOutcome): EconomicAssetDescriptor['qualityClass'] {
  if (decision === 'VERIFIED') {
    return descriptor.qualityClass === 'AUTHORITATIVE' ? 'AUTHORITATIVE' : 'VERIFIED';
  }
  return descriptor.qualityClass;
}

function canonicalDecisionMaterial(input: EconomicAssetVerificationInput, codes: readonly EconomicAssetVerificationCode[]): string {
  return [
    input.descriptor.assetId,
    input.descriptor.assetClass,
    input.descriptor.contentCommitment,
    input.descriptor.provenanceDigest,
    input.descriptor.lineageRoot,
    input.policy.policyId,
    input.policy.policyVersion,
    input.evaluatedAt,
    [...codes].sort().join(','),
  ].join('\n');
}

export function decideVerification(input: EconomicAssetVerificationInput): EconomicAssetVerificationDecision {
  const codes = Object.freeze(collectCodes(input));
  const decision = outcomeOf(codes);
  const digestMaterial = canonicalDecisionMaterial(input, codes);
  const decisionDigest = sha256Canonical(digestMaterial);
  return Object.freeze({
    decisionId: verificationDecisionIdFor(digestMaterial),
    assetId: input.descriptor.assetId,
    assetClass: input.descriptor.assetClass,
    verificationPolicyId: input.policy.policyId,
    verificationPolicyVersion: input.policy.policyVersion,
    decision,
    evaluatedEvidenceRefs: Object.freeze([input.descriptor.contentCommitment]),
    evaluatedRightsRefs: Object.freeze([
      input.descriptor.rightsPolicyRef,
      ...input.descriptor.consentRefs,
      ...input.descriptor.purposeRefs,
      ...input.descriptor.licenseRefs,
      ...input.descriptor.usageRestrictionRefs,
    ]),
    evaluatedProvenanceRefs: Object.freeze([
      input.descriptor.canonicalSourceRef,
      input.descriptor.provenanceDigest,
      input.descriptor.sourceSystem,
    ]),
    evaluatedLineageRefs: input.descriptor.lineage,
    qualityClass: qualityOf(input.descriptor, decision),
    confidenceClass: input.descriptor.confidenceClass,
    freshnessState: input.descriptor.freshness,
    decisionCodes: codes,
    decisionDigest,
    evaluatedAt: input.evaluatedAt,
    containsRawSensitiveData: false,
    authorizesValuation: false,
    authorizesSettlement: false,
    authorizesSunReyIssuance: false,
    authorizesMoonReyIssuance: false,
    authorizesExecution: false,
  });
}

export class EconomicAssetVerificationEngine {
  private readonly policy: EconomicAssetVerificationPolicy;

  constructor(policy: EconomicAssetVerificationPolicy) {
    this.policy = policy;
  }

  evaluate(
    input: Omit<EconomicAssetVerificationInput, 'policy'> & { readonly policy?: EconomicAssetVerificationPolicy },
  ): EconomicAssetVerificationDecision {
    return decideVerification({
      descriptor: input.descriptor,
      knownAssets: input.knownAssets,
      evaluatedAt: input.evaluatedAt,
      policy: input.policy ?? this.policy,
    });
  }
}
