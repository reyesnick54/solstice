import type { Exec14ProviderState } from './taxonomy.ts';

export type ProviderProductionEvidence = Readonly<{
  readonly providerId: string;
  readonly providerKind: 'BROKER' | 'CUSTODY';
  readonly conformancePassed: boolean;
  readonly brokerConformancePassed: boolean;
  readonly custodyConformancePassed: boolean;
  readonly commercialAgreementRef: string | null;
  readonly accountEvidenceRef: string | null;
  readonly credentialConfigured: boolean;
  readonly credentialRef: string | null;
  readonly entitlementsEvidenceRef: string | null;
  readonly legalComplianceApprovalRef: string | null;
  readonly operationalAcceptanceRef: string | null;
  readonly externalConnectivityVerified: boolean;
  readonly secretValuePresent: false;
  readonly credentialNeverLogged: true;
  readonly credentialEnvironmentSeparated: true;
  readonly credentialMinimallyScoped: true;
  readonly credentialRotatable: true;
}>;

export type ProviderProductionEvidenceDecision = Readonly<{
  readonly providerId: string;
  readonly providerKind: ProviderProductionEvidence['providerKind'];
  readonly state: Exec14ProviderState;
  readonly productionActivationPossible: false;
  readonly blockers: readonly string[];
}>;

function refMissing(value: string | null): boolean {
  return value === null || value.trim().length === 0;
}

/**
 * Decide provider state from evidence. Conformance success alone never yields production activation.
 */
export function decideProviderProductionState(evidence: ProviderProductionEvidence): ProviderProductionEvidenceDecision {
  const blockers: string[] = [];
  let state: Exec14ProviderState = 'REGISTERED';

  if (!evidence.providerId.trim()) {
    blockers.push('provider_id missing');
  }
  if (evidence.secretValuePresent !== false) {
    blockers.push('secret values must not be present in evidence records');
  }

  const kindConformance =
    evidence.providerKind === 'BROKER' ? evidence.brokerConformancePassed : evidence.custodyConformancePassed;

  if (!evidence.conformancePassed || !kindConformance) {
    blockers.push('conformance_suite_not_passed');
    return Object.freeze({
      providerId: evidence.providerId,
      providerKind: evidence.providerKind,
      state: 'REGISTERED',
      productionActivationPossible: false,
      blockers: Object.freeze(blockers),
    });
  }

  state = 'FIXTURE_QUALIFIED';
  state = 'SANDBOX_QUALIFIED';

  const readonlyLiveReady =
    evidence.credentialConfigured &&
    !refMissing(evidence.credentialRef) &&
    !refMissing(evidence.commercialAgreementRef) &&
    !refMissing(evidence.entitlementsEvidenceRef);

  if (readonlyLiveReady && evidence.externalConnectivityVerified) {
    state = 'READ_ONLY_LIVE_QUALIFIED';
  } else if (readonlyLiveReady) {
    blockers.push('readonly_live: external connectivity not verified');
  }

  if (evidence.providerKind === 'BROKER' && evidence.brokerConformancePassed) {
    state = 'ORDER_ENTRY_CONFORMANCE_PASSED';
  }

  const humanGates = [
    ['commercial_agreement', evidence.commercialAgreementRef],
    ['account', evidence.accountEvidenceRef],
    ['legal_compliance_approval', evidence.legalComplianceApprovalRef],
    ['operational_acceptance', evidence.operationalAcceptanceRef],
  ] as const;

  for (const [label, ref] of humanGates) {
    if (refMissing(ref)) {
      blockers.push(`${label} missing`);
    }
  }
  if (!evidence.credentialConfigured) {
    blockers.push('credentials not configured');
  }

  if (blockers.length > 0) {
    state = 'EXTERNAL_APPROVAL_REQUIRED';
  }

  state = 'PRODUCTION_DISABLED';

  return Object.freeze({
    providerId: evidence.providerId,
    providerKind: evidence.providerKind,
    state,
    productionActivationPossible: false,
    blockers: Object.freeze(blockers),
  });
}

export function fixtureSandboxProviderEvidence(
  providerId: string,
  providerKind: ProviderProductionEvidence['providerKind'],
): ProviderProductionEvidence {
  return Object.freeze({
    providerId,
    providerKind,
    conformancePassed: true,
    brokerConformancePassed: providerKind === 'BROKER',
    custodyConformancePassed: providerKind === 'CUSTODY',
    commercialAgreementRef: 'fixture:agreement/catalog-only',
    accountEvidenceRef: 'fixture:account/sandbox',
    credentialConfigured: false,
    credentialRef: 'secretref:fixture/exec14/sandbox',
    entitlementsEvidenceRef: 'fixture:entitlement/paper',
    legalComplianceApprovalRef: null,
    operationalAcceptanceRef: null,
    externalConnectivityVerified: false,
    secretValuePresent: false,
    credentialNeverLogged: true,
    credentialEnvironmentSeparated: true,
    credentialMinimallyScoped: true,
    credentialRotatable: true,
  });
}
