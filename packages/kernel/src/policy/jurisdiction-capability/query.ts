import type { CapabilityQueryOutcome, JurisdictionCapabilityState } from './taxonomy.ts';
import { JURISDICTION_CAPABILITY_POLICY_VERSION } from './taxonomy.ts';
import type { JurisdictionCapabilityRegistry } from './registry.ts';
import { resolveHeliosJurisdiction } from './resolve.ts';
import type { CanPerformInput, CanPerformResult } from './types.ts';

function mapStatusToOutcome(
  status: JurisdictionCapabilityState,
  environment: 'simulation' | 'live',
): CapabilityQueryOutcome {
  switch (status) {
    case 'APPROVED_FOR_PRODUCTION':
      return environment === 'live' ? 'ALLOWED' : 'RESTRICTED';
    case 'APPROVED_FOR_TEST':
      return environment === 'simulation' ? 'ALLOWED' : 'DENIED';
    case 'SANDBOX_ONLY':
      return environment === 'simulation' ? 'RESTRICTED' : 'DENIED';
    case 'RESTRICTED':
      return 'RESTRICTED';
    case 'PARTNER_DEPENDENT':
      return 'REVIEW_REQUIRED';
    case 'LEGAL_REVIEW_REQUIRED':
    case 'RESEARCH_REQUIRED':
      return 'REVIEW_REQUIRED';
    case 'UNMAPPED':
      return 'UNKNOWN';
    case 'DISABLED':
    case 'SUSPENDED':
    case 'REVOKED':
      return 'DENIED';
    default:
      return 'UNKNOWN';
  }
}

function unknownResult(input: CanPerformInput, reasonCodes: readonly string[]): CanPerformResult {
  return Object.freeze({
    outcome: 'UNKNOWN',
    jurisdictionId: null,
    resolvedOverlayId: null,
    legalEntityId: input.legalEntityId,
    policyVersion: JURISDICTION_CAPABILITY_POLICY_VERSION,
    capabilityId: null,
    capabilityStatus: null,
    reasonCodes: Object.freeze([...reasonCodes]),
    evidenceRefs: Object.freeze(['src-no-live-license']),
    requiredControls: Object.freeze(['LEGAL_REVIEW_REQUIRED']),
    requiredApprovalClass: 'COMPLIANCE_REVIEW',
    reportingObligationRefs: Object.freeze([]),
    providerDependency: null,
    restrictions: Object.freeze([]),
    evaluatedAt: input.at,
  });
}

/**
 * Deterministic jurisdiction capability query. UNKNOWN never becomes ALLOWED.
 */
export function canPerform(
  registry: JurisdictionCapabilityRegistry,
  input: CanPerformInput,
): CanPerformResult {
  if (!input.legalEntityId || input.legalEntityId.trim().length === 0) {
    return unknownResult(input, ['LEGAL_ENTITY_REQUIRED']);
  }

  const resolved = resolveHeliosJurisdiction({
    jurisdiction: input.jurisdiction,
    ...(input.memberState ? { memberState: input.memberState } : {}),
    ...(input.stateOverlay ? { stateOverlay: input.stateOverlay } : {}),
  });

  if (!resolved.frameworkJurisdictionId) {
    return unknownResult(input, [resolved.reasonCode, 'JURISDICTION_UNMAPPED']);
  }

  const pack = registry.getPack(resolved.frameworkJurisdictionId);
  if (!pack) {
    return unknownResult(input, ['JURISDICTION_PACK_MISSING']);
  }

  const capability = registry.findCapability({
    jurisdictionId: resolved.frameworkJurisdictionId,
    legalEntityId: input.legalEntityId,
    action: input.action,
    customerClass: input.customerClass,
    environment: input.environment,
    overlayId: resolved.overlayId,
    at: input.at,
  });

  if (!capability) {
    const baseCapability = registry.findCapability({
      jurisdictionId: resolved.frameworkJurisdictionId,
      legalEntityId: input.legalEntityId,
      action: input.action,
      customerClass: input.customerClass,
      environment: input.environment,
      overlayId: null,
      at: input.at,
    });
    if (!baseCapability) {
      return Object.freeze({
        outcome: 'UNKNOWN',
        jurisdictionId: resolved.frameworkJurisdictionId,
        resolvedOverlayId: resolved.overlayId,
        legalEntityId: input.legalEntityId,
        policyVersion: registry.activeVersion(resolved.frameworkJurisdictionId) ?? pack.packVersion,
        capabilityId: null,
        capabilityStatus: 'UNMAPPED',
        reasonCodes: Object.freeze(['CAPABILITY_UNMAPPED', resolved.reasonCode]),
        evidenceRefs: Object.freeze([pack.sourceReference]),
        requiredControls: Object.freeze(['LEGAL_REVIEW_REQUIRED']),
        requiredApprovalClass: 'COMPLIANCE_REVIEW',
        reportingObligationRefs: Object.freeze([]),
        providerDependency: 'UNKNOWN',
        restrictions: Object.freeze([]),
        evaluatedAt: input.at,
      });
    }
    return finishResult(baseCapability, resolved, input, registry);
  }

  return finishResult(capability, resolved, input, registry);
}

function finishResult(
  capability: NonNullable<ReturnType<JurisdictionCapabilityRegistry['findCapability']>>,
  resolved: ReturnType<typeof resolveHeliosJurisdiction>,
  input: CanPerformInput,
  registry: JurisdictionCapabilityRegistry,
): CanPerformResult {
  const outcome = mapStatusToOutcome(capability.status, input.environment);
  const reasonCodes = [...capability.reasonCodes];
  if (resolved.overlayId) reasonCodes.push(resolved.reasonCode);
  if (outcome === 'DENIED' && capability.status === 'SANDBOX_ONLY' && input.environment === 'live') {
    reasonCodes.push('SANDBOX_ONLY_NOT_PRODUCTION');
  }

  return Object.freeze({
    outcome,
    jurisdictionId: capability.jurisdictionId,
    resolvedOverlayId: resolved.overlayId,
    legalEntityId: input.legalEntityId,
    policyVersion: registry.activeVersion(capability.jurisdictionId) ?? capability.policyVersion,
    capabilityId: capability.capabilityId,
    capabilityStatus: capability.status,
    reasonCodes: Object.freeze(reasonCodes),
    evidenceRefs: Object.freeze([...capability.evidenceRefs]),
    requiredControls: Object.freeze([...capability.requiredControls]),
    requiredApprovalClass: capability.requiredApprovalClass,
    reportingObligationRefs: Object.freeze([...capability.reportingObligationRefs]),
    providerDependency: capability.providerDependency,
    restrictions: Object.freeze([...capability.restrictions]),
    evaluatedAt: input.at,
  });
}

export function jurisdictionCapabilityEnabled(result: CanPerformResult): boolean {
  return result.outcome === 'ALLOWED';
}
