export type CustodyCandidateEvidenceBundle = {
  readonly providerAcceptanceRef: string;
  readonly contractEvidenceRef: string;
  readonly securityAssessmentRef: string;
  readonly HsmAttestationEvidenceRef: string;
  readonly keyManagementEvidenceRef: string;
  readonly licenseRegistrationEvidenceRef: string;
  readonly jurisdictionEvidenceRef: string;
  readonly businessContinuityEvidenceRef: string;
  readonly softwareAttestationIsHardware: false;
  readonly productionAuthorized: false;
};

export function fixtureEvidenceBundle(): CustodyCandidateEvidenceBundle {
  return Object.freeze({
    providerAcceptanceRef: 'evidence://fixture/provider-acceptance',
    contractEvidenceRef: 'evidence://fixture/contract',
    securityAssessmentRef: 'evidence://fixture/security-assessment',
    HsmAttestationEvidenceRef: 'evidence://fixture/hsm-attestation-software',
    keyManagementEvidenceRef: 'evidence://fixture/key-management',
    licenseRegistrationEvidenceRef: 'evidence://fixture/license',
    jurisdictionEvidenceRef: 'evidence://fixture/jurisdiction',
    businessContinuityEvidenceRef: 'evidence://fixture/bcp',
    softwareAttestationIsHardware: false,
    productionAuthorized: false,
  });
}
