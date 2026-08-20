import { isProviderDomain } from '../types.ts';
import { assertDomainSpecificScope } from './domain-scope.ts';
import { validateEndpointProfile } from './endpoint.ts';
import {
  authorizeBindingCredential,
  sandboxPlusProductionEligibleIsForbidden,
} from './environment.ts';
import { bindingContentHash } from './hash.ts';
import { consumeExternalEvidence, consumeOperatingScope } from './ports.ts';
import { rejectRawSecrets } from './secrets.ts';
import {
  BINDING_STATES,
  bindingErr,
  bindingOk,
  type BindingBlocker,
  type BindingEvaluation,
  type BindingEvaluationContext,
  type BindingResult,
  type ProductionBindingState,
  type ProductionProviderBinding,
} from './types.ts';
import { detectVersionDrift } from './versioning.ts';

const TERMINAL_STATES = Object.freeze(['SUSPENDED', 'EXPIRED', 'REVOKED'] as const);

export function sealProductionProviderBinding(
  draft: Omit<ProductionProviderBinding, 'contentHash' | 'productionConnectivityEnabled'>,
): BindingResult<ProductionProviderBinding> {
  if ((BINDING_STATES as readonly string[]).includes('LIVE') || draft.status === ('LIVE' as ProductionBindingState)) {
    return bindingErr('LIVE_STATE_FORBIDDEN', 'LIVE is not a binding state');
  }
  if (!isProviderDomain(draft.providerDomain)) {
    return bindingErr('PROVIDER_DOMAIN_MISMATCH', `unknown provider domain ${draft.providerDomain}`);
  }
  if (!draft.endpointProfileRef) {
    return bindingErr('ENDPOINT_PROFILE_REQUIRED', 'endpoint profile reference is required');
  }
  const secrets = rejectRawSecrets(draft);
  if (!secrets.ok) {
    return secrets;
  }
  const sealed: Omit<ProductionProviderBinding, 'contentHash'> = {
    ...draft,
    productionConnectivityEnabled: false,
  };
  return bindingOk(
    Object.freeze({
      ...sealed,
      contentHash: bindingContentHash(sealed),
    }),
  );
}

function deriveState(input: {
  readonly requested: ProductionBindingState;
  readonly engineeringBound: boolean;
  readonly evidenceOk: boolean;
  readonly evidencePresent: boolean;
  readonly scopeOk: boolean;
  readonly scopePresent: boolean;
  readonly acceptanceOk: boolean;
  readonly blockers: readonly BindingBlocker[];
}): ProductionBindingState {
  if ((TERMINAL_STATES as readonly string[]).includes(input.requested)) {
    return input.requested;
  }
  if (input.blockers.some((row) => row.code === 'EXPIRED_EXTERNAL_EVIDENCE' || row.code === 'REVOKED_EXTERNAL_EVIDENCE')) {
    return input.blockers.some((row) => row.code === 'REVOKED_EXTERNAL_EVIDENCE') ? 'REVOKED' : 'EXPIRED';
  }
  if (!input.engineeringBound) {
    return 'DRAFT';
  }
  if (!input.evidencePresent || !input.evidenceOk) {
    return 'EXTERNAL_EVIDENCE_REQUIRED';
  }
  if (!input.scopePresent || !input.scopeOk) {
    return 'OPERATING_SCOPE_REQUIRED';
  }
  if (!input.acceptanceOk) {
    return 'HUMAN_ACCEPTANCE_REQUIRED';
  }
  if (input.blockers.length > 0) {
    return 'ENGINEERING_BOUND';
  }
  return 'PRODUCTION_BINDING_CANDIDATE';
}

export function evaluateProductionProviderBinding(
  binding: ProductionProviderBinding,
  context: BindingEvaluationContext,
): BindingEvaluation {
  const blockers: BindingBlocker[] = [];
  if (binding.productionConnectivityEnabled !== false) {
    blockers.push({
      code: 'CONNECTIVITY_CANNOT_BE_ENABLED',
      detail: 'productionConnectivityEnabled must remain false',
    });
  }
  const secrets = rejectRawSecrets(binding);
  if (!secrets.ok) {
    blockers.push({ code: secrets.error.code, detail: secrets.error.message });
  }
  if (sandboxPlusProductionEligibleIsForbidden(context.sandboxFlag, context.productionEligibleFlag)) {
    blockers.push({
      code: 'SANDBOX_AND_PRODUCTION_ELIGIBLE_FORBIDDEN',
      detail: 'sandbox=true cannot silently satisfy productionEligible=true',
    });
  }

  const endpoint = context.endpointProfiles[binding.endpointProfileRef];
  const endpointCheck = validateEndpointProfile(endpoint);
  if (!endpointCheck.ok) {
    blockers.push({ code: endpointCheck.error.code, detail: endpointCheck.error.message });
  } else if (endpointCheck.value.environmentClass !== binding.environmentClass) {
    blockers.push({
      code: 'ENDPOINT_PROFILE_INVALID',
      detail: 'endpoint environment class must match the binding environment class',
    });
  }

  const credential = context.credentials[binding.credentialDescriptorRef];
  let credentialReady = false;
  if (!credential) {
    blockers.push({ code: 'CREDENTIAL_PROVIDER_MISMATCH', detail: 'credential descriptor is not bound' });
  } else {
    const operation = binding.allowedOperations[0];
    if (!operation) {
      blockers.push({ code: 'CREDENTIAL_PROVIDER_MISMATCH', detail: 'binding must declare allowed operations' });
    } else {
      const authorized = authorizeBindingCredential({
        binding,
        credential,
        nowUtc: context.nowUtc,
        operation,
      });
      if (!authorized.ok) {
        blockers.push({ code: authorized.error.code, detail: authorized.error.message });
      } else {
        credentialReady = true;
      }
    }
  }

  const evidencePresent = binding.externalEvidenceRefs.length > 0;
  const evidenceCheck = evidencePresent
    ? consumeExternalEvidence({ binding, evidence: context.evidence, nowUtc: context.nowUtc })
    : bindingErr('EXPIRED_EXTERNAL_EVIDENCE', 'external evidence references are required');
  if (!evidenceCheck.ok) {
    blockers.push({ code: evidenceCheck.error.code, detail: evidenceCheck.error.message });
  }

  const scopePresent = binding.operatingScopeRefs.length > 0;
  const scopeCheck = scopePresent
    ? consumeOperatingScope({
        binding,
        operatingScope: context.operatingScope,
        jurisdictions: context.requestedJurisdictions,
        dataClasses: context.requestedDataClasses,
        operations: context.requestedOperations,
        productDomain: context.requestedProductDomain,
      })
    : bindingErr('OPERATING_SCOPE_MISMATCH', 'operating scope references are required');
  if (!scopeCheck.ok) {
    blockers.push({ code: scopeCheck.error.code, detail: scopeCheck.error.message });
  }

  const acceptanceOk = Boolean(context.acceptance?.productionEligible && context.acceptance.providerId === binding.providerId);
  if (!acceptanceOk) {
    blockers.push({
      code: 'PROVIDER_ACCEPTANCE_REQUIRED',
      detail: 'Chunk 82 production eligibility is required before PRODUCTION_BINDING_CANDIDATE',
    });
  }

  const drift = detectVersionDrift(binding.versionPins, context.observedVersionPins);
  if (!drift.ok) {
    blockers.push({ code: drift.error.code, detail: drift.error.message });
  }

  const domainScope = assertDomainSpecificScope(binding);
  if (!domainScope.ok) {
    blockers.push({ code: domainScope.error.code, detail: domainScope.error.message });
  }

  const engineeringBound = Boolean(
    binding.endpointProfileRef &&
      binding.credentialDescriptorRef &&
      binding.runtimeProfileRef &&
      binding.conformanceReportRef &&
      endpointCheck.ok &&
      credentialReady,
  );
  const conformanceReady = Boolean(binding.conformanceReportRef) && drift.ok;
  const state = deriveState({
    requested: binding.status,
    engineeringBound,
    evidenceOk: evidenceCheck.ok,
    evidencePresent,
    scopeOk: scopeCheck.ok,
    scopePresent,
    acceptanceOk,
    blockers,
  });
  const candidate =
    state === 'PRODUCTION_BINDING_CANDIDATE' &&
    blockers.length === 0 &&
    engineeringBound &&
    evidenceCheck.ok &&
    scopeCheck.ok &&
    acceptanceOk &&
    conformanceReady;

  return Object.freeze({
    bindingId: binding.bindingId,
    providerId: binding.providerId,
    providerDomain: binding.providerDomain,
    state: candidate ? 'PRODUCTION_BINDING_CANDIDATE' : state === 'PRODUCTION_BINDING_CANDIDATE' ? 'ENGINEERING_BOUND' : state,
    blockers: Object.freeze(blockers),
    engineeringBound,
    externalEvidenceChecked: evidencePresent,
    operatingScopeChecked: scopePresent,
    acceptanceSatisfied: acceptanceOk,
    credentialReady,
    endpointReady: endpointCheck.ok,
    conformanceReady,
    productionBindingCandidate: candidate,
    sandboxCredentialUsedForProduction: false,
    rawSecretPresent: false,
    productionConnectivityEnabled: false,
    realProviderCalled: false,
    contentHash: binding.contentHash,
  });
}
