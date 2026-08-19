import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EconomicAssetRegistry } from '../../economic-asset-registry/src/index.ts';
import { OracleIncidentControl } from './oracle/production/incident.ts';
import { OracleOnboardingRegistry, createOnboardingDraft, emptyOnboardingEvidence } from './oracle/production/onboarding.ts';
import {
  EconomicDataSourceCertificationRegistry,
  SANDBOX_CLASSES,
  aiCannotRestoreProvider,
  certificationDoesNotCreateProductiveContribution,
  certificationDoesNotFinalizeOracle,
  certificationDoesNotMintMoonRey,
  certificationNeverApprovesProduction,
  commercialEvidenceIsNeverFabricated,
  computeMissingContextSubject,
  defaultCertificationPolicy,
  emptyEvidenceStates,
  evaluateCertificationExpiry,
  evaluateRevalidation,
  feedSchemaFor,
  mapCertificationToEconomicAsset,
  projectCertificationMetadata,
  recommendProviderSuspension,
  refuseAiProviderRestore,
  runCertificationSuite,
  sandboxSubject,
} from './oracle/production/certification/index.ts';

const NOW = 1_700_000_000n;

function certify(classId: keyof typeof SANDBOX_CLASSES, scenario: Parameters<typeof sandboxSubject>[1] = 'VALID') {
  const spec = SANDBOX_CLASSES[classId];
  const subject =
    scenario === 'MISSING_CONTEXT' && classId === 'compute'
      ? computeMissingContextSubject(NOW)
      : sandboxSubject(classId, scenario, emptyEvidenceStates(), NOW);
  const schema =
    scenario === 'MISSING_CONTEXT'
      ? Object.freeze({ ...feedSchemaFor(spec), unit: 'compute_s' as const })
      : feedSchemaFor(spec);
  return runCertificationSuite(subject, schema);
}

function onboardedIncidents(providerId: string) {
  const created = createOnboardingDraft({
    providerId,
    legalEntityReference: null,
    controllerReference: `controller_${providerId}`,
    dataCategories: ['energy'],
    feeds: ['feed_energy_1'],
    authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
    signingKey: {
      schemaVersion: 1,
      keyId: `key_${providerId}`,
      keyVersion: 1,
      publicKeyHex: '11'.repeat(32),
      cryptoSuite: 'sunrey.oracle.software-dev',
      signerKind: 'SOFTWARE_DEVELOPMENT',
      rotatedFromKeyId: null,
      active: true,
    },
    cryptoSuite: 'sunrey.oracle.software-dev',
    infrastructureRegion: 'sandbox',
    sourceRelationships: [],
    onboardingEvidence: emptyOnboardingEvidence(),
    securityReviewStatus: 'NOT_REVIEWED',
    commercialAgreementEvidenceReference: null,
    status: 'TESTNET_ACTIVE',
  });
  if (!created.ok) {
    throw new Error(created.error.detail);
  }
  const onboarding = new OracleOnboardingRegistry();
  onboarding.put(created.value);
  return new OracleIncidentControl(onboarding);
}

describe('CHUNK-128 economic data provider certification', () => {
  it('1. certifies a valid energy sandbox source as TESTNET_ADMISSIBLE', () => {
    const result = certify('energy');
    assert.equal(result.record.status, 'TESTNET_ADMISSIBLE');
    assert.equal(result.record.schemaResults.verdict, 'PASS');
    assert.equal(result.record.unitResults.verdict, 'PASS');
    assert.equal(result.record.technicalResults.taxonomy.verdict, 'PASS');
    assert.equal(result.record.productionAuthorized, false);
    assert.equal(result.report.testnetAdmissible, true);
    assert.equal(result.report.productionCandidate, false);
  });

  it('2. certifies a valid compute sandbox source', () => {
    const result = certify('compute');
    assert.equal(result.record.status, 'TESTNET_ADMISSIBLE');
    assert.equal(result.record.unitResults.verdict, 'PASS');
    assert.equal(result.record.sourceCategory, 'compute');
  });

  it('3. certifies a valid manufacturing sandbox source', () => {
    const result = certify('manufacturing');
    assert.equal(result.record.status, 'TESTNET_ADMISSIBLE');
    assert.equal(result.record.unit, 'units_produced');
  });

  it('4. certifies a valid logistics sandbox source', () => {
    const result = certify('logistics');
    assert.equal(result.record.status, 'TESTNET_ADMISSIBLE');
    assert.equal(result.record.productiveCategory, 'LOGISTICS_TRANSPORTATION');
  });

  it('5. fails schema mismatch', () => {
    const result = certify('energy', 'SCHEMA_MISMATCH');
    assert.equal(result.record.status, 'CONFORMANCE_FAILED');
    assert.equal(result.record.schemaResults.verdict, 'FAIL');
  });

  it('6. fails unit mismatch', () => {
    const result = certify('energy', 'UNIT_MISMATCH');
    assert.equal(result.record.status, 'CONFORMANCE_FAILED');
    assert.equal(result.record.unitResults.unitKnown, true);
    assert.ok(result.record.schemaResults.verdict === 'FAIL' || result.record.unitResults.verdict === 'FAIL');
  });

  it('7. fails semantic mismatch', () => {
    const result = certify('energy', 'SEMANTIC_MISMATCH');
    assert.equal(result.record.status, 'CONFORMANCE_FAILED');
    assert.equal(result.record.technicalResults.taxonomy.verdict, 'FAIL');
  });

  it('8. fails missing compute context', () => {
    const result = certify('compute', 'MISSING_CONTEXT');
    assert.equal(result.record.status, 'CONFORMANCE_FAILED');
    assert.equal(result.record.unitResults.contextSatisfied, false);
  });

  it('9. fails stale data', () => {
    const result = certify('energy', 'STALE');
    assert.equal(result.record.status, 'CONFORMANCE_FAILED');
    assert.equal(result.record.freshnessResults.stale, true);
  });

  it('10. fails oversized response', () => {
    const result = certify('energy', 'OVERSIZED');
    assert.equal(result.record.status, 'CONFORMANCE_FAILED');
    assert.equal(result.record.schemaResults.responseBounded, false);
  });

  it('11. fails authentication failure', () => {
    const result = certify('energy', 'AUTH_FAILURE');
    assert.equal(result.record.status, 'CONFORMANCE_FAILED');
    assert.equal(result.record.schemaResults.authenticationOk, false);
  });

  it('12. fails SSRF', () => {
    const result = certify('energy', 'SSRF');
    assert.equal(result.record.status, 'CONFORMANCE_FAILED');
    assert.equal(result.record.securityResults.ssrfPolicyOk, false);
  });

  it('13. fails same-controller fake quorum', () => {
    const result = certify('energy', 'SAME_CONTROLLER');
    assert.equal(result.record.status, 'CONFORMANCE_FAILED');
    assert.equal(result.record.independenceResults.fakeQuorum, true);
  });

  it('14. keeps missing commercial evidence unconfirmed', () => {
    const result = certify('energy');
    assert.equal(result.record.commercialEvidenceState, 'NOT_PROVIDED');
    assert.equal(result.record.commercialEvidenceFabricated, false);
    assert.ok(result.report.missingEvidence.includes('commercial agreement'));
  });

  it('15. keeps missing data license unconfirmed', () => {
    const result = certify('compute');
    assert.equal(result.record.dataLicenseState, 'NOT_PROVIDED');
    assert.ok(result.report.missingEvidence.includes('data license'));
  });

  it('16. keeps missing usage rights unconfirmed', () => {
    const result = certify('manufacturing');
    assert.equal(result.record.usageRightsState, 'NOT_PROVIDED');
    assert.ok(result.report.missingEvidence.includes('usage rights'));
  });

  it('17. allows TESTNET_ADMISSIBLE with missing production evidence', () => {
    const result = certify('logistics');
    assert.equal(result.record.status, 'TESTNET_ADMISSIBLE');
    assert.equal(result.report.testnetAdmissible, true);
    assert.equal(result.record.commercialEvidenceState, 'NOT_PROVIDED');
  });

  it('18. blocks PRODUCTION_CANDIDATE when commercial/legal evidence is absent', () => {
    const result = certify('energy');
    assert.notEqual(result.record.status, 'PRODUCTION_CANDIDATE');
    assert.equal(result.report.productionCandidate, false);
    assert.equal(result.record.productionAuthorized, false);
    assert.ok(result.report.missingEvidence.length >= 3);
  });

  it('19. expires certification after elapsed period or material change', () => {
    const subject = sandboxSubject('energy', 'VALID');
    const expired = {
      ...subject,
      prior: {
        certificationId: 'cert_old',
        schemaId: subject.schemaId,
        schemaVersion: subject.schemaVersion,
        unit: subject.unit,
        endpointUrl: subject.connector.endpointUrl,
        authenticationClass: subject.connector.authenticationClass,
        connectorRuntimeMajorVersion: 1,
        securityPolicyVersion: defaultCertificationPolicy().securityPolicyVersion,
        controllerId: subject.controllerId,
        createdAtUnix: NOW - 10_000_000n,
        expiresAtUnix: NOW - 1n,
        requiredFields: ['identifier', 'numericValue', 'unit', 'sourceTimestampUnix'],
      },
    };
    const reasons = evaluateCertificationExpiry(expired, defaultCertificationPolicy());
    assert.ok(reasons.includes('ELAPSED_PERIOD'));
    const unitChanged = evaluateCertificationExpiry(
      { ...expired, unit: 'MWh', prior: { ...expired.prior!, unit: 'kWh' } },
      defaultCertificationPolicy(),
    );
    assert.ok(unitChanged.includes('UNIT_CHANGE'));
  });

  it('20. requires revalidation after schema drift', () => {
    const first = certify('energy');
    const drifted = sandboxSubject('energy', 'SCHEMA_MISMATCH');
    const decision = evaluateRevalidation(drifted, defaultCertificationPolicy(), first.record);
    assert.equal(decision.required, true);
    assert.ok(decision.triggers.includes('SCHEMA_DRIFT'));
    assert.ok(decision.nextStatus === 'REVALIDATION_REQUIRED' || decision.nextStatus === 'SUSPENDED');
    const result = runCertificationSuite(drifted, feedSchemaFor(SANDBOX_CLASSES.energy), defaultCertificationPolicy(), first.record);
    assert.ok(result.record.status === 'CONFORMANCE_FAILED' || result.record.status === 'REVALIDATION_REQUIRED');
  });

  it('21. certification failure can require provider suspension', () => {
    const incidents = onboardedIncidents('sandbox_energy');
    const recommended = recommendProviderSuspension(incidents, {
      incidentId: 'cert-susp-1',
      providerId: 'sandbox_energy',
      evidenceRef: firstEvidence(),
      atUnix: NOW,
    });
    assert.equal(recommended.ok, true);
    if (recommended.ok) {
      assert.equal(recommended.value.recommended, true);
    }
  });

  it('22. AI cannot restore a provider', () => {
    assert.equal(aiCannotRestoreProvider(), false);
    const incidents = onboardedIncidents('sandbox_restore');
    const suspended = recommendProviderSuspension(incidents, {
      incidentId: 'cert-susp-2',
      providerId: 'sandbox_restore',
      evidenceRef: 'cert-ev',
      atUnix: NOW,
    });
    assert.equal(suspended.ok, true);
    const ai = refuseAiProviderRestore(incidents, {
      incidentId: 'cert-ai-1',
      providerId: 'sandbox_restore',
      evidenceRef: 'cert-ev',
      atUnix: NOW + 1n,
    });
    assert.equal(ai.ok, false);
    if (!ai.ok) {
      assert.equal(ai.error.code, 'AI_CANNOT_RESTORE_PROVIDER');
    }
  });

  it('23. certification does not finalize an oracle fact', () => {
    const result = certify('energy');
    assert.equal(certificationDoesNotFinalizeOracle(), false);
    assert.equal(result.record.finalizesOracleFact, false);
    assert.equal(result.report.certificationFinalizesOracle, false);
  });

  it('24. certification does not create a productive contribution', () => {
    const result = certify('manufacturing');
    assert.equal(certificationDoesNotCreateProductiveContribution(), false);
    assert.equal(result.record.createsProductiveContribution, false);
  });

  it('25. certification does not mint MoonRey', () => {
    const result = certify('logistics');
    assert.equal(certificationDoesNotMintMoonRey(), false);
    assert.equal(result.record.mintsMoonRey, false);
    assert.equal(certificationNeverApprovesProduction(), false);
    assert.equal(commercialEvidenceIsNeverFabricated(), false);
  });

  it('fails adversarial fixtures: float, leak, redirect, reused ids', () => {
    assert.equal(certify('energy', 'FLOAT_VALUE').record.status, 'CONFORMANCE_FAILED');
    assert.equal(certify('energy', 'CREDENTIAL_LEAK').record.provenanceResults.verdict, 'FAIL');
    assert.equal(certify('energy', 'FORBIDDEN_REDIRECT').record.securityResults.redirectPolicyOk, false);
    const reused = certify('energy', 'REUSED_OBSERVATION_ID');
    assert.ok(reused.record.reliabilityResults.conflictBps > 0);
  });

  it('keeps historical certifications immutable when a new result supersedes', () => {
    const registry = new EconomicDataSourceCertificationRegistry();
    const first = certify('energy');
    const stored = registry.put(first.record);
    assert.equal(stored.ok, true);
    const mutated = registry.put(first.record);
    assert.equal(mutated.ok, false);
    const second = runCertificationSuite(
      sandboxSubject('energy', 'STALE', emptyEvidenceStates(), NOW + 60n),
      feedSchemaFor(SANDBOX_CLASSES.energy),
    );
    const next = registry.put(second.record);
    assert.equal(next.ok, true);
    const historical = registry.history(first.record.providerId, first.record.sourceId, first.record.feedId);
    assert.equal(historical.length, 2);
    assert.equal(historical[0]!.status, 'TESTNET_ADMISSIBLE');
    assert.equal(historical[0]!.certificationId, first.record.certificationId);
    assert.equal(registry.current(first.record.providerId, first.record.sourceId, first.record.feedId)?.certificationId, second.record.certificationId);
  });

  it('projects certification metadata to the Economic Asset Registry without raw responses', () => {
    const result = certify('energy');
    const mapped = mapCertificationToEconomicAsset(result.record);
    assert.equal(mapped.ok, true);
    if (mapped.ok) {
      assert.equal(JSON.stringify(mapped.value).includes(SANDBOX_CLASSES.energy.value), false);
    }
    const assets = new EconomicAssetRegistry();
    const projected = projectCertificationMetadata(assets, result.record);
    assert.equal(projected.ok, true);
  });

  it('does not assign PRODUCTION_CANDIDATE quality from sandbox metrics alone', () => {
    const result = certify('compute');
    assert.notEqual(result.record.qualityClass, 'PRODUCTION_CANDIDATE');
    assert.ok(result.record.qualityClass === 'ENGINEERING' || result.record.qualityClass === 'TESTNET');
    assert.equal(result.record.reliabilityResults.productionSlaClaimed, false);
    assert.equal(result.record.securityResults.independentAuditClaimed, false);
  });
});

function firstEvidence(): string {
  return 'certification.sandbox.evidence';
}
