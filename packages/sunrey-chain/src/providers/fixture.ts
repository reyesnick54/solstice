/**
 * Deterministic CI fixture for provider acceptance.
 * No live credentials. No fabricated contracts.
 */

import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { emptyEvidenceSlot, type RegulatedServiceProvider } from '../../../kernel/src/regulated/index.ts';
import { createDevelopmentHsmSimulator } from '../../../security/src/hsm-simulator.ts';
import { secretRef } from '../../../security/src/secrets.ts';
import { createLocalHarness } from '../infra/harness.ts';
import { emptyOnboardingEvidence, createOnboardingDraft } from '../oracle/production/index.ts';
import { SoftwareDevelopmentSigner } from '../oracle/production/index.ts';
import { defaultOracleSuiteId } from '../oracle/crypto.ts';
import { missingEvidence } from './evidence.ts';
import { runAllAcceptanceSuites } from './harness.ts';
import { ProviderAcceptanceCatalog } from './references.ts';
import type { ExternalProviderEvidenceRecord, ProviderDomain } from './types.ts';

export const PROVIDER_ACCEPTANCE_NOW_UTC = '2026-08-18T00:00:00.000Z';

export function sandboxRegulatedProvider(
  providerId: string,
  serviceClass: RegulatedServiceProvider['serviceClass'],
): RegulatedServiceProvider {
  return Object.freeze({
    providerId,
    serviceClass,
    jurisdiction: asJurisdiction('GB'),
    endpointConfigRef: 'config://sandbox',
    credentialRef: secretRef('simulation', `${providerId}-cred`),
    contractEvidence: emptyEvidenceSlot('contract', 'Missing partner agreement.'),
    licenseRegistrationEvidence: emptyEvidenceSlot('license', 'No license recorded.'),
    securityReviewEvidence: emptyEvidenceSlot('security', 'No security review recorded.'),
    dataProcessingPrivacyEvidence: emptyEvidenceSlot('privacy', 'No DPA recorded.'),
    supportedCapabilities: Object.freeze(['sandbox']),
    environment: 'SANDBOX',
    health: 'HEALTHY',
    activationEligibility: 'SANDBOX_ONLY',
    qualifiedOrApprovedClaim: false,
  });
}

export function missingEvidenceFor(providerId: string, domain: ProviderDomain): readonly ExternalProviderEvidenceRecord[] {
  return Object.freeze([
    missingEvidence(providerId, 'SERVICE_CONTRACT', domain),
    missingEvidence(providerId, 'LICENSE_REGISTRATION', domain),
    missingEvidence(providerId, 'DATA_LICENSE_AGREEMENT', domain),
    missingEvidence(providerId, 'HUMAN_APPROVAL', domain),
  ]);
}

export function createProviderAcceptanceFixture() {
  const infra = createLocalHarness('LOCAL');
  const catalog = new ProviderAcceptanceCatalog({ infrastructure: infra.registry });
  catalog.bindInfrastructure('CLOUD_INFRASTRUCTURE', infra.provider);
  catalog.bindHsm(createDevelopmentHsmSimulator());
  catalog.bindRegulated('IDENTITY_KYC', sandboxRegulatedProvider('kyc-sandbox', 'IDENTITY_KYC'));
  catalog.bindRegulated('BANKING_REFERENCE', sandboxRegulatedProvider('bank-reference', 'FIAT_BANKING_REFERENCE'));
  const signer = SoftwareDevelopmentSigner.fromLabel('oracle-local-simulator', defaultOracleSuiteId());
  if (signer.ok) {
    const draft = createOnboardingDraft({
      providerId: 'oracle-local-simulator',
      legalEntityReference: null,
      controllerReference: 'controller_oracle_local',
      dataCategories: ['energy'],
      feeds: ['feed_energy_production_sim'],
      authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
      signingKey: {
        schemaVersion: 1,
        keyId: 'key_oracle_local',
        keyVersion: 1,
        publicKeyHex: signer.value.publicKey().publicKeyHex,
        cryptoSuite: defaultOracleSuiteId(),
        signerKind: 'SOFTWARE_DEVELOPMENT',
        rotatedFromKeyId: null,
        active: true,
      },
      cryptoSuite: defaultOracleSuiteId(),
      infrastructureRegion: 'local',
      sourceRelationships: [],
      onboardingEvidence: emptyOnboardingEvidence(),
      securityReviewStatus: 'NOT_REVIEWED',
      commercialAgreementEvidenceReference: null,
    });
    if (draft.ok) {
      catalog.bindOracle(draft.value);
    }
  }
  const suites = runAllAcceptanceSuites();
  return Object.freeze({
    infra,
    catalog,
    suites,
    nowUtc: PROVIDER_ACCEPTANCE_NOW_UTC,
  });
}
