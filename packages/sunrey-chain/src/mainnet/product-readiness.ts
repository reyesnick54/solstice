/**
 * Separate production-readiness checklists for regulated products.
 *
 * Software implementation is never sufficient. Development fixtures
 * are not production feeds, partners, or licenses.
 */

import type {
  ChecklistItem,
  CustodyReadinessSlot,
  EvidenceState,
  ExchangeReadinessSlot,
  InteropReadinessSlot,
  OracleReadinessSlot,
  PrivacyReadinessSlot,
} from './types.ts';

function item(
  id: string,
  description: string,
  status: EvidenceState,
  softwareOnly: boolean,
  notes: string,
): ChecklistItem {
  return Object.freeze({ id, description, status, softwareOnly, notes });
}

export function exchangeReadiness(): ExchangeReadinessSlot {
  const items = Object.freeze([
    item('EX-CUSTODY', 'Custody readiness for Exchange production', 'EXTERNAL_VERIFICATION_REQUIRED', true, 'Software custody is not licensed custody.'),
    item('EX-SURVEILLANCE', 'Market surveillance readiness', 'EXTERNAL_VERIFICATION_REQUIRED', true, 'Simulation detectors are not a licensed market-abuse program.'),
    item('EX-LISTING', 'Listing governance', 'EXTERNAL_VERIFICATION_REQUIRED', true, 'Engineering listing workflow is not a market approval.'),
    item('EX-TRAVEL-RULE', 'Travel Rule architecture', 'EXTERNAL_VERIFICATION_REQUIRED', true, 'Simulation Travel Rule is not a production VASP obligation.'),
    item('EX-LICENSE', 'Licensing or registration evidence', 'NOT_PROVIDED', false, 'No exchange license is recorded.'),
    item('EX-LEGAL', 'Market and legal approvals', 'NOT_PROVIDED', false, 'No market/legal approval is recorded.'),
    item('EX-STAFFING', 'Operational staffing', 'NOT_PROVIDED', false, 'No production staffing evidence is recorded.'),
    item('EX-SECURITY', 'Security review of Exchange production', 'NOT_PROVIDED', false, 'No independent Exchange audit is recorded.'),
  ]);
  return Object.freeze({
    custodyReady: 'EXTERNAL_VERIFICATION_REQUIRED',
    marketSurveillanceReady: 'EXTERNAL_VERIFICATION_REQUIRED',
    listingGovernanceReady: 'EXTERNAL_VERIFICATION_REQUIRED',
    travelRuleArchitectureReady: 'EXTERNAL_VERIFICATION_REQUIRED',
    licensingOrRegistration: 'NOT_PROVIDED',
    marketLegalApprovals: 'NOT_PROVIDED',
    operationalStaffing: 'NOT_PROVIDED',
    securityReview: 'NOT_PROVIDED',
    softwareImplementationSufficient: false,
    items,
  });
}

export function custodyReadiness(): CustodyReadinessSlot {
  const items = Object.freeze([
    item('CU-HSM', 'Real HSM or custody provider', 'NOT_PROVIDED', false, 'Simulation HSM does not satisfy real-provider evidence.'),
    item('CU-CEREMONY', 'Custody key ceremony', 'EXTERNAL_VERIFICATION_REQUIRED', true, 'Simulation rehearsal is process readiness only.'),
    item('CU-SEGREGATION', 'Asset and account segregation', 'EXTERNAL_VERIFICATION_REQUIRED', true, 'Software segregation is not a licensed custody control.'),
    item('CU-RECON', 'Reconciliation against the canonical ledger', 'EXTERNAL_VERIFICATION_REQUIRED', true, 'Engineering reconciliation is not a production control attestation.'),
    item('CU-WITHDRAWAL', 'Withdrawal approval', 'NOT_PROVIDED', false, 'Production custody withdrawals remain disabled.'),
    item('CU-DR', 'Custody disaster recovery', 'EXTERNAL_VERIFICATION_REQUIRED', true, 'Engineering DR is not a contractual recovery commitment.'),
    item('CU-SECURITY', 'Custody security review', 'NOT_PROVIDED', false, 'No independent custody audit is recorded.'),
    item('CU-LEGAL', 'Legal, licensing, and partner evidence', 'NOT_PROVIDED', false, 'Software custody is not a licensed custody business.'),
  ]);
  return Object.freeze({
    realHsmOrProvider: 'NOT_PROVIDED',
    keyCeremony: 'EXTERNAL_VERIFICATION_REQUIRED',
    segregation: 'EXTERNAL_VERIFICATION_REQUIRED',
    reconciliation: 'EXTERNAL_VERIFICATION_REQUIRED',
    withdrawalApproval: 'NOT_PROVIDED',
    disasterRecovery: 'EXTERNAL_VERIFICATION_REQUIRED',
    securityReview: 'NOT_PROVIDED',
    legalLicensingPartner: 'NOT_PROVIDED',
    simulationHsmSatisfiesRealProvider: false,
    items,
  });
}

export function oracleReadiness(): OracleReadinessSlot {
  const items = Object.freeze([
    item('OR-TECHNICAL', 'Technical oracle implementation', 'ENGINEERING_VERIFIED', true, 'Chunk 68 collector, adapters, and provenance are implemented. Not a production feed.'),
    item('OR-CONFIGURED', 'Provider configured', 'ENGINEERING_VERIFIED', true, 'Simulation providers can be onboarded. Configuration is not a production agreement.'),
    item('OR-AGREEMENT', 'Provider agreement evidence', 'NOT_PROVIDED', false, 'No production data-license or commercial agreement is recorded as confirmed.'),
    item('OR-ELIGIBLE', 'Production eligible', 'NOT_PROVIDED', false, 'Technical implementation and configuration do not make a feed production eligible.'),
    item('OR-DIVERSITY', 'Source diversity', 'NOT_PROVIDED', false, 'No production source-diversity evidence is recorded.'),
    item('OR-QUALITY', 'Data quality controls', 'EXTERNAL_VERIFICATION_REQUIRED', true, 'Simulation quality checks are not a production SLA.'),
    item('OR-MONITOR', 'Operational monitoring', 'EXTERNAL_VERIFICATION_REQUIRED', true, 'Engineering monitors are not a production operations contract.'),
    item('OR-KEYS', 'Oracle key management', 'EXTERNAL_VERIFICATION_REQUIRED', true, 'Development keys cannot become production keys.'),
    item('OR-JURISDICTION', 'Jurisdiction constraints', 'NOT_PROVIDED', false, 'No jurisdictional oracle approval is recorded.'),
    item('OR-SECURITY', 'Oracle security review', 'NOT_PROVIDED', false, 'No independent oracle review is recorded.'),
  ]);
  return Object.freeze({
    technicalImplementation: 'ENGINEERING_VERIFIED',
    providerConfigured: 'ENGINEERING_VERIFIED',
    providerAgreementEvidence: 'NOT_PROVIDED',
    productionEligible: 'NOT_PROVIDED',
    realProviderAgreements: 'NOT_PROVIDED',
    sourceDiversity: 'NOT_PROVIDED',
    dataQuality: 'EXTERNAL_VERIFICATION_REQUIRED',
    operationalMonitoring: 'EXTERNAL_VERIFICATION_REQUIRED',
    keyManagement: 'EXTERNAL_VERIFICATION_REQUIRED',
    jurisdictionConstraints: 'NOT_PROVIDED',
    securityReview: 'NOT_PROVIDED',
    developmentFixturesAreProductionFeeds: false,
    items,
  });
}

export function interopReadiness(): InteropReadinessSlot {
  const items = Object.freeze([
    item('IO-VERIFIER', 'Implemented external-chain verifier', 'ENGINEERING_VERIFIED', true, 'Development verifier exists. Production interop remains separately controlled.'),
    item('IO-SECURITY', 'Interop security review', 'NOT_PROVIDED', false, 'No independent interop audit is recorded.'),
    item('IO-CONSERVATION', 'Economic conservation analysis', 'EXTERNAL_VERIFICATION_REQUIRED', true, 'Engineering conservation checks are not a legal opinion.'),
    item('IO-RELAYER', 'Operational relayers', 'NOT_PROVIDED', false, 'No production relayer staffing is recorded.'),
    item('IO-INCIDENT', 'Incident procedures', 'EXTERNAL_VERIFICATION_REQUIRED', true, 'Engineering incident playbooks are not a production duty roster.'),
    item('IO-LEGAL', 'Legal and compliance review where applicable', 'NOT_PROVIDED', false, 'No interop legal review is recorded. No wrapped fiat.'),
  ]);
  return Object.freeze({
    externalChainVerifierImplemented: true,
    securityReview: 'NOT_PROVIDED',
    economicConservationAnalysis: 'EXTERNAL_VERIFICATION_REQUIRED',
    operationalRelayers: 'NOT_PROVIDED',
    incidentProcedures: 'EXTERNAL_VERIFICATION_REQUIRED',
    legalComplianceReview: 'NOT_PROVIDED',
    wrappedFiat: false,
    separatelyControlled: true,
    items,
  });
}

export function privacyReadiness(): PrivacyReadinessSlot {
  const items = Object.freeze([
    item('PR-PDV', 'Personal Data Vault', 'ENGINEERING_VERIFIED', true, 'Simulation PDV exists. Not a production privacy program.'),
    item('PR-CONSENT', 'Consent ledger', 'ENGINEERING_VERIFIED', true, 'Simulation consent exists. Not a jurisdictional legal basis.'),
    item('PR-CLEAN-ROOM', 'Clean Room', 'ENGINEERING_VERIFIED', true, 'Simulation Clean Room exists. Not a production data-sharing approval.'),
    item('PR-RESIDENCY', 'Data residency', 'NOT_PROVIDED', false, 'No production residency attestation is recorded.'),
    item('PR-RETENTION', 'Retention', 'EXTERNAL_VERIFICATION_REQUIRED', true, 'Engineering retention labels are not a legal schedule.'),
    item('PR-DELETION', 'Deletion', 'EXTERNAL_VERIFICATION_REQUIRED', true, 'Engineering deletion paths are not a certified erasure program.'),
    item('PR-JURISDICTION', 'Jurisdictional privacy analysis', 'NOT_PROVIDED', false, 'No counsel privacy analysis is recorded.'),
    item('PR-SECURITY', 'Privacy security assessment', 'NOT_PROVIDED', false, 'No independent privacy assessment is recorded.'),
    item('PR-LEGAL', 'Human and legal review', 'NOT_PROVIDED', false, 'Human/legal review remains incomplete.'),
  ]);
  return Object.freeze({
    personalDataVault: 'ENGINEERING_VERIFIED',
    consent: 'ENGINEERING_VERIFIED',
    cleanRoom: 'ENGINEERING_VERIFIED',
    dataResidency: 'NOT_PROVIDED',
    retention: 'EXTERNAL_VERIFICATION_REQUIRED',
    deletion: 'EXTERNAL_VERIFICATION_REQUIRED',
    jurisdictionalPrivacyAnalysis: 'NOT_PROVIDED',
    securityAssessment: 'NOT_PROVIDED',
    humanLegalReview: 'NOT_PROVIDED',
    items,
  });
}

export function developmentOracleFixturesAreProductionFeeds(): false {
  return false;
}

export function softwareExchangeIsLicensedExchange(): false {
  return false;
}

export function softwareCustodyIsLicensedCustody(): false {
  return false;
}
