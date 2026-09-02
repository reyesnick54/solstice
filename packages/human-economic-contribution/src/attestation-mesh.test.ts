import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import {
  ATTESTATION_SOURCE_CLASS_WEIGHTS,
  HUMAN_CONTRIBUTION_ATTESTATION_VERIFICATION_POLICY,
  HUMAN_PROVIDER_CATALOG_AUDIT,
  HumanContributionAttestationMesh,
  analyzeAttestationIndependence,
  attestationMeshAuthorizesSunReyIssuance,
  attestationMeshCreatesMoney,
  attestationMeshCreatesPeve,
  auditSummary,
  buildAttestationMeshIcPromotion,
  buildHumanEconomicClaimPromotion,
  classAttestationRequirementFor,
  copiedSourceLineageDetected,
  detectFraudSignals,
  isSelfAttestationSource,
  selfAttestationCannotSoleVerify,
  verifyCredential,
  verifyHumanContribution,
} from './attestation-mesh/index.ts';
import {
  fixtureAuthorizedDataAttestation,
  fixtureComputationReceiptAttestation,
  fixtureCopiedLineageAttestations,
  fixtureDuplicateReceiptAttestations,
  fixtureEducationCredentialAttestation,
  fixtureForgedAttestation,
  fixtureMeshInput,
  fixturePublicationAuthorMismatchAttestation,
  fixtureResearchPublisherAttestation,
  fixtureResearchRegistryAttestation,
  fixtureRevokedCredentialCheck,
  fixtureSelfAttestation,
  fixtureSignedWorkReceiptAttestation,
  fixtureStaleAttestation,
  fixtureValidCredentialCheck,
  fixtureWorkEmployerAttestation,
  fixtureWrongPersonAttestation,
  MESH_FIXTURE_SUBJECT,
} from './attestation-mesh/fixtures.ts';

describe('Wave 6 — Human Contribution Attestation Mesh', () => {
  const mesh = new HumanContributionAttestationMesh();

  it('audits configured human provider inventory from repository catalogs', () => {
    const summary = auditSummary();
    assert.ok(summary.total >= 20);
    assert.ok(summary.implemented >= 15);
    assert.ok(summary.awaitingMasterList >= 8);
    const pubmed = HUMAN_PROVIDER_CATALOG_AUDIT.find((row) => row.providerId === 'pubmed-ncbi');
    assert.ok(pubmed);
    assert.equal(pubmed?.integrationState, 'awaiting_master_list');
    const clinicalTrials = HUMAN_PROVIDER_CATALOG_AUDIT.find((row) => row.providerId === 'clinicaltrials-gov');
    assert.ok(clinicalTrials);
    assert.equal(clinicalTrials?.integrationState, 'implemented_fixture');
  });

  it('does not treat all attestation source classes equally', () => {
    assert.equal(ATTESTATION_SOURCE_CLASS_WEIGHTS.GOVERNMENT, 'AUTHORITATIVE');
    assert.equal(ATTESTATION_SOURCE_CLASS_WEIGHTS.USER_SELF_ATTESTATION, 'WEAK');
    assert.equal(ATTESTATION_SOURCE_CLASS_WEIGHTS.PEER_ATTESTATION, 'MODERATE');
    assert.equal(isSelfAttestationSource('USER_SELF_ATTESTATION'), true);
    assert.equal(selfAttestationCannotSoleVerify('USER_SELF_ATTESTATION'), true);
  });

  it('1. verifies research contribution with publication attestation', () => {
    const evaluation = mesh.verify(
      fixtureMeshInput('RESEARCH_PARTICIPATION', [
        fixtureResearchPublisherAttestation(),
        fixtureResearchRegistryAttestation(),
      ]),
    );
    assert.equal(evaluation.receipt.result, 'VERIFIED');
    assert.equal(evaluation.receipt.grantsMonetaryAuthority, false);
    assert.equal(evaluation.receipt.createsPeve, false);
    assert.equal(evaluation.receipt.authorizesSunReyIssuance, false);
    assert.ok(evaluation.receipt.explanationCodes.includes('CLASS_POLICY_SATISFIED'));
  });

  it('2. verifies education credential with issuer verification', () => {
    const evaluation = verifyHumanContribution(fixtureMeshInput('EDUCATION_SKILL_ATTESTATION', [fixtureEducationCredentialAttestation()]), {
      credentialChecks: [fixtureValidCredentialCheck()],
    });
    assert.equal(evaluation.receipt.result, 'VERIFIED');
    assert.ok(evaluation.receipt.explanationCodes.includes('INDEPENDENT_EVIDENCE_SATISFIED'));
  });

  it('3. verifies work contribution with employer and signed receipt', () => {
    const evaluation = mesh.verify(
      fixtureMeshInput('PROFESSIONAL_EXPERTISE', [
        fixtureWorkEmployerAttestation(),
        fixtureSignedWorkReceiptAttestation(),
      ]),
    );
    assert.equal(evaluation.receipt.result, 'VERIFIED');
  });

  it('4. verifies computation contribution with signed receipt', () => {
    const evaluation = mesh.verify(
      fixtureMeshInput('MODEL_TRAINING_PARTICIPATION', [
        fixtureComputationReceiptAttestation(),
        fixtureAuthorizedDataAttestation('hin-data-provider', 'DATA_USAGE'),
      ]),
    );
    assert.equal(evaluation.receipt.result, 'VERIFIED');
  });

  it('5. rejects self-attestation only for research', () => {
    const evaluation = mesh.verify(fixtureMeshInput('RESEARCH_PARTICIPATION', [fixtureSelfAttestation()]));
    assert.equal(evaluation.receipt.result, 'INSUFFICIENT_EVIDENCE');
    assert.ok(evaluation.receipt.explanationCodes.includes('SELF_ATTESTATION_ONLY'));
    assert.equal(HUMAN_CONTRIBUTION_ATTESTATION_VERIFICATION_POLICY.selfAttestation.maySoleVerify, false);
  });

  it('6. deduplicates copied source lineage to one independent confirmation', () => {
    const attestations = fixtureCopiedLineageAttestations();
    assert.equal(attestations.length, 3);
    assert.equal(copiedSourceLineageDetected(attestations), true);
    const independence = analyzeAttestationIndependence(attestations);
    assert.equal(independence.rawAttestationCount, 3);
    assert.equal(independence.independentLineageRootCount, 1);
    const evaluation = mesh.verify(fixtureMeshInput('RESEARCH_PARTICIPATION', attestations));
    assert.equal(evaluation.receipt.independentLineageRootCount, 1);
    assert.ok(evaluation.receipt.explanationCodes.includes('COPIED_SOURCE_LINEAGE'));
  });

  it('7. rejects forged attestation', () => {
    const evaluation = mesh.verify(fixtureMeshInput('RESEARCH_PARTICIPATION', [fixtureForgedAttestation()]));
    assert.equal(evaluation.receipt.result, 'INVALID');
    assert.ok(evaluation.receipt.explanationCodes.includes('FORGED_ATTESTATION'));
  });

  it('8. rejects revoked credential', () => {
    const evaluation = verifyHumanContribution(fixtureMeshInput('EDUCATION_SKILL_ATTESTATION', [fixtureEducationCredentialAttestation()]), {
      credentialChecks: [fixtureRevokedCredentialCheck()],
    });
    assert.notEqual(evaluation.receipt.result, 'VERIFIED');
    assert.ok(evaluation.receipt.explanationCodes.includes('CREDENTIAL_REVOKED'));
  });

  it('9. rejects wrong person / contribution mismatch', () => {
    const evaluation = mesh.verify(fixtureMeshInput('RESEARCH_PARTICIPATION', [fixtureWrongPersonAttestation()]));
    assert.equal(evaluation.receipt.result, 'INVALID');
    assert.ok(evaluation.receipt.explanationCodes.includes('CONTRIBUTION_CLAIMED_BY_MULTIPLE_IDENTITIES'));
  });

  it('10. rejects duplicate signed receipt across actors', () => {
    const [left, right] = fixtureDuplicateReceiptAttestations();
    const signals = detectFraudSignals({
      attestations: [left, right],
      expectedSubjectRef: String(left.subjectPseudonymousRef),
      expectedContributionEventRef: String(left.contributionEventRef),
      evaluatedAt: left.issuedAt,
    });
    assert.ok(signals.some((signal) => signal.kind === 'RECEIPT_REUSED_BY_MULTIPLE_ACTORS'));
    const evaluation = verifyHumanContribution(
      fixtureMeshInput('HUMAN_SERVICE_DELIVERY', [left]),
      {
        fraudContext: {
          receiptActorMap: new Map([[String(left.evidenceReferences[0]), String(right.subjectPseudonymousRef)]]),
        },
      },
    );
    assert.equal(evaluation.receipt.result, 'INVALID');
    assert.ok(evaluation.receipt.explanationCodes.includes('DUPLICATE_RECEIPT') || evaluation.receipt.explanationCodes.includes('RECEIPT_REUSED_BY_MULTIPLE_ACTORS'));
  });

  it('11. returns insufficient evidence when independent attestations missing', () => {
    const evaluation = mesh.verify(fixtureMeshInput('RESEARCH_PARTICIPATION', []));
    assert.equal(evaluation.receipt.result, 'INSUFFICIENT_EVIDENCE');
  });

  it('12. flags stale evidence', () => {
    const evaluation = mesh.verify(
      fixtureMeshInput('RESEARCH_PARTICIPATION', [fixtureStaleAttestation()]),
      {},
    );
    assert.equal(evaluation.receipt.result, 'STALE');
    assert.ok(evaluation.receipt.explanationCodes.includes('EVIDENCE_STALE'));
  });

  it('13. requires manual review for publication author mismatch', () => {
    const evaluation = verifyHumanContribution(
      fixtureMeshInput('RESEARCH_PARTICIPATION', [fixturePublicationAuthorMismatchAttestation()]),
      {
        fraudContext: {
          expectedPublicationAuthors: ['issuer:expected-author'],
        },
      },
    );
    assert.equal(evaluation.receipt.result, 'MANUAL_REVIEW_REQUIRED');
    assert.ok(evaluation.receipt.explanationCodes.includes('PUBLICATION_AUTHOR_MISMATCH'));
  });

  it('14. promotes verified receipt toward IC and human economic claim without monetary authority', () => {
    const evaluation = mesh.verify(
      fixtureMeshInput('RESEARCH_PARTICIPATION', [
        fixtureResearchPublisherAttestation(),
        fixtureResearchRegistryAttestation(),
      ]),
    );
    const promotion = buildAttestationMeshIcPromotion(evaluation.receipt);
    assert.equal(promotion.eligibleForVerifiedFact, true);
    assert.equal(promotion.grantsMonetaryAuthority, false);
    assert.equal(attestationMeshCreatesMoney(), false);
    assert.equal(attestationMeshCreatesPeve(), false);
    assert.equal(attestationMeshAuthorizesSunReyIssuance(), false);

    const claim = buildHumanEconomicClaimPromotion(evaluation.receipt, 'fact_test_001');
    assert.ok(claim);
    assert.equal(claim?.verificationStatus, 'VERIFIED');
    assert.equal(claim?.grantsMonetaryAuthority, false);
    assert.equal(claim?.createsPeve, false);
  });

  it('15. applies contribution-class-specific policies', () => {
    const research = classAttestationRequirementFor('RESEARCH_PARTICIPATION');
    assert.ok(research?.requiresPublicationIdentifier);
    assert.ok(research?.requiresAuthorRelationship);
    const education = classAttestationRequirementFor('EDUCATION_SKILL_ATTESTATION');
    assert.ok(education?.requiresCredentialVerification);
    const computation = classAttestationRequirementFor('MODEL_TRAINING_PARTICIPATION');
    assert.ok(computation?.requiresSignedReceipt);
    assert.ok(computation?.requiresConsent);
  });

  it('16. verifies credential lifecycle states', () => {
    const valid = verifyCredential(fixtureValidCredentialCheck());
    assert.equal(valid.lifecycleState, 'CREDENTIAL_VALID');
    assert.equal(valid.valid, true);
    const revoked = verifyCredential(fixtureRevokedCredentialCheck());
    assert.equal(revoked.lifecycleState, 'CREDENTIAL_REVOKED');
    assert.equal(revoked.valid, false);
  });

  it('17. enforces pseudonymous subject on attestations', () => {
    assert.match(String(MESH_FIXTURE_SUBJECT), /^subj_[a-f0-9]+$/);
    const evaluation = mesh.verify(fixtureMeshInput('RESEARCH_PARTICIPATION', [fixtureResearchPublisherAttestation()]));
    assert.equal(evaluation.receipt.humanActorRef, MESH_FIXTURE_SUBJECT);
  });
});

describe('Wave 6 — attestation mesh authority boundaries', () => {
  it('attestation objects carry zero monetary authority', () => {
    const attestation = fixtureResearchPublisherAttestation();
    assert.equal(attestation.grantsMonetaryAuthority, false);
    assert.equal(attestation.grantsExecutionAuthority, false);
    assert.equal(attestation.createsPeve, false);
    assert.equal(attestation.authorizesSunReyIssuance, false);
  });
});
