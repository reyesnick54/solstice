import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  ClaimDisclosureService,
  WAVE7_DATA_EXPOSURE_AUDIT,
  assertNoRawPayload,
  createUnavailableSelectiveDisclosureProvider,
  credentialValidAssertion,
  denyOverbroadFieldRequest,
} from '../packages/personal-data-vault/src/disclosure/index.ts';
import { isCommitmentOnlyPayload, scanForForbiddenBlockPayload } from '../packages/sunrey-chain/src/evidence-commitments/privacy.ts';
import {
  PrivacyBudgetLedger,
  createSimulationCleanRoomComputationProvider,
  createUnavailableTeeComputationProvider,
  evaluateDifferentialPrivacyApplicability,
} from '../packages/clean-room/src/privacy/index.ts';
import {
  createFixtureVerifiableCredentialVerifier,
  createUnavailableVerifiableCredentialVerifier,
  sampleSimulationCredential,
} from '../packages/identity/src/verifiable-credentials/index.ts';
import { createUnavailableZKProofProvider } from '../packages/security/src/zk-proof/index.ts';
import { assertLogPayloadSafe, redactLogRecord, safeLogLine } from '../packages/security/src/safe-logging.ts';
import { redactRecord } from '../services/api/src/logging.ts';

const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');
const SUBJECT = 'subj_commitment_abc123';
const PURPOSE = 'purpose:CORE_ACCOUNT_SERVICE';
const EVIDENCE = 'e'.repeat(64);

describe('Wave 7 — privacy-preserving data access', () => {
  const service = new ClaimDisclosureService({
    selectiveDisclosure: createUnavailableSelectiveDisclosureProvider(),
  });

  it('1. issues minimal credential assertion without raw transcript', () => {
    const result = service.issueMinimalAssertion({
      subjectCommitment: SUBJECT,
      purposeId: PURPOSE,
      boundPurposeId: PURPOSE,
      verificationPurpose: 'credentialStatus',
      evidenceCommitmentHash: EVIDENCE,
      evaluatedAt: NOW,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.assertionType, 'CredentialValid');
    assert.equal(result.value.satisfied, true);
    assert.deepEqual(result.value.disclosedFields, ['credentialStatus']);
    assert.equal(result.value.rawDataIncluded, false);
    assertNoRawPayload(result.value);
  });

  it('2. denies overbroad field request for credential verification', () => {
    const denied = denyOverbroadFieldRequest({
      purpose: 'credentialStatus',
      requestedFields: ['credentialStatus', 'transcript', 'dateOfBirth'],
    });
    assert.equal(denied.ok, false);
    if (denied.ok) return;
    assert.equal(denied.error.code, 'OVERBROAD_FIELD_REQUEST');

    const minimized = service.issueMinimalAssertion({
      subjectCommitment: SUBJECT,
      purposeId: PURPOSE,
      boundPurposeId: PURPOSE,
      verificationPurpose: 'credentialStatus',
      requestedFields: ['transcript'],
      evidenceCommitmentHash: EVIDENCE,
      evaluatedAt: NOW,
    });
    assert.equal(minimized.ok, false);
  });

  it('3. keeps raw data absent from chain commitment payloads', () => {
    const safe = {
      schemaVersion: 'v1',
      commitmentHash: EVIDENCE,
      evidenceId: 'ev-1',
      evidenceType: 'KERNEL_DECISION',
    };
    assert.equal(isCommitmentOnlyPayload(safe), true);
    const violations = scanForForbiddenBlockPayload({
      healthRecord: { diagnosis: 'secret' },
    });
    assert.ok(violations.length > 0);
    assert.equal(isCommitmentOnlyPayload(safe), true);
    const raw = isCommitmentOnlyPayload({ dateOfBirth: '1990-01-01' });
    assert.equal(raw, false);
  });

  it('4. redacts tokens, health, and financial fields from structured logs', () => {
    const redacted = redactLogRecord({
      authorization: 'Bearer secret-token',
      healthRecord: { diagnosis: 'x' },
      accountNumber: '123456789',
      route: '/api/v1/data',
    });
    assert.equal(redacted.authorization, '[REDACTED]');
    assert.equal(redacted.healthRecord, '[REDACTED]');
    assert.equal(redacted.accountNumber, '[REDACTED]');
    assert.equal(redacted.route, '/api/v1/data');

    const apiRedacted = redactRecord({
      password: 'secret',
      hinData: 'raw-hin',
      message: 'ok',
    });
    assert.equal(apiRedacted.password, '[REDACTED]');
    assert.equal(apiRedacted.hinData, '[REDACTED]');

    const line = safeLogLine({ token: 'eyJabc.def.ghi', status: 200 });
    assert.equal(line.includes('eyJ'), false);
    assert.throws(() => assertLogPayloadSafe({ privateKey: 'deadbeef' }));
  });

  it('5. exposes selective disclosure interface as INTERFACE_ONLY', async () => {
    const provider = createUnavailableSelectiveDisclosureProvider();
    assert.equal(provider.capability, 'INTERFACE_ONLY');
    const result = await provider.disclose({
      credentialCommitmentHash: EVIDENCE,
      purposeId: PURPOSE,
      requestedClaims: ['credentialStatus'],
    });
    assert.equal(result.ok, false);
  });

  it('6. fails credential proof verification on invalid fixture VC', async () => {
    const verifier = createFixtureVerifiableCredentialVerifier();
    const bad = await verifier.verify({
      credential: (() => {
        const { proof: _proof, ...credential } = sampleSimulationCredential();
        return credential;
      })(),
      purposeId: PURPOSE,
      requiredClaims: ['credentialStatus'],
    });
    assert.equal(bad.ok, false);
    if (bad.ok) return;
    assert.equal(bad.error.code, 'CREDENTIAL_PROOF_FAILED');

    const unavailable = createUnavailableVerifiableCredentialVerifier();
    const blocked = await unavailable.verify({
      credential: sampleSimulationCredential(),
      purposeId: PURPOSE,
      requiredClaims: ['credentialStatus'],
    });
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.equal(blocked.error.code, 'VC_ADAPTER_UNAVAILABLE');
  });

  it('7. refuses wrong-purpose disclosure', () => {
    const result = service.issueMinimalAssertion({
      subjectCommitment: SUBJECT,
      purposeId: 'purpose:OTHER',
      boundPurposeId: PURPOSE,
      verificationPurpose: 'credentialStatus',
      evidenceCommitmentHash: EVIDENCE,
      evaluatedAt: NOW,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, 'PURPOSE_MISMATCH');
  });

  it('8. routes aggregate analytics toward DP path but not monetary exactness', () => {
    const aggregate = evaluateDifferentialPrivacyApplicability({
      queryClass: 'population_statistics',
      datasetId: 'hin:cohort-alpha',
      purposeId: 'purpose:RESEARCH_AGGREGATE',
    });
    assert.equal(aggregate.dpApplicable, true);

    const monetary = evaluateDifferentialPrivacyApplicability({
      queryClass: 'blockchain_balances',
      datasetId: 'ledger:account-1',
      purposeId: PURPOSE,
    });
    assert.equal(monetary.dpApplicable, false);
    assert.match(monetary.reason, /exactness required/);
  });

  it('9. exhausts privacy budget when query limit reached', () => {
    const ledger = new PrivacyBudgetLedger();
    const base = {
      budgetId: 'budget-1',
      datasetId: 'dataset:hin-cohort',
      purposeId: 'purpose:RESEARCH_AGGREGATE',
      queryClass: 'population_statistics',
      analystRef: 'analyst:sim',
      serviceRef: 'service:clean-room',
      queryLimit: 1,
      policyVersion: 'privacy-budget-v1',
      now: NOW,
    };
    const first = ledger.consume(base);
    assert.equal(first.ok, true);
    const second = ledger.consume(base);
    assert.equal(second.ok, false);
    if (second.ok) return;
    assert.equal(second.error.code, 'PRIVACY_BUDGET_EXHAUSTED');
    if (!first.ok) return;
    assert.equal(first.value.epsilonConsumed, null);
    assert.equal(first.value.differentialPrivacy, 'DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED');
  });

  it('10. keeps deleted source record verifiable via historical commitment', () => {
    const result = service.issueMinimalAssertion({
      subjectCommitment: SUBJECT,
      purposeId: PURPOSE,
      boundPurposeId: PURPOSE,
      verificationPurpose: 'contributionVerified',
      evidenceCommitmentHash: EVIDENCE,
      evaluatedAt: NOW,
      sourceDeleted: true,
      commitmentStillVerifiable: true,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.satisfied, true);
    assert.ok(result.value.disclosedFields.includes('commitmentVerifiable'));
    assert.equal(result.value.rawDataIncluded, false);
  });

  it('11. prefers computation-in-place over dataset copy', async () => {
    const cleanRoom = createSimulationCleanRoomComputationProvider();
    assert.equal(cleanRoom.capability, 'PARTIAL');
    const result = await cleanRoom.execute({
      venue: 'SECURE_CLEAN_ROOM',
      purposeId: PURPOSE,
      computationId: 'cmp:aggregate-1',
      inputCommitmentHashes: [EVIDENCE],
      outputClass: 'AGGREGATE_STATISTIC',
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.rawDatasetCopied, false);
    assert.ok(result.value.resultCommitmentHash.startsWith('cmp:'));

    const tee = createUnavailableTeeComputationProvider();
    assert.equal(tee.capability, 'INTERFACE_ONLY');
    const teeResult = await tee.execute({
      venue: 'TRUSTED_EXECUTION_ENVIRONMENT',
      purposeId: PURPOSE,
      computationId: 'cmp:tee-1',
      inputCommitmentHashes: [EVIDENCE],
      outputClass: 'BOOLEAN_ATTESTATION',
    });
    assert.equal(teeResult.ok, false);
  });

  it('12. ZK proof provider remains INTERFACE_ONLY', async () => {
    const zk = createUnavailableZKProofProvider();
    assert.equal(zk.capability, 'INTERFACE_ONLY');
    const proof = await zk.prove({
      proofKind: 'THRESHOLD',
      purposeId: PURPOSE,
      subjectCommitment: SUBJECT,
      statementCommitment: EVIDENCE,
    });
    assert.equal(proof.ok, false);
  });

  it('13. data exposure audit catalog covers required surfaces', () => {
    const surfaces = new Set(WAVE7_DATA_EXPOSURE_AUDIT.map((entry) => entry.surface));
    for (const required of [
      'API_RESPONSE',
      'BFF_ADAPTER',
      'DATABASE_QUERY',
      'FEDERATED_QUERY',
      'GRAPH_QUERY',
      'STRUCTURED_LOG',
      'EVIDENCE_OBJECT',
      'USAGE_RECEIPT',
      'POLICY_INPUT',
    ]) {
      assert.ok(surfaces.has(required as (typeof WAVE7_DATA_EXPOSURE_AUDIT)[number]['surface']), `missing audit surface ${required}`);
    }
  });

  it('14. credential assertion factory never embeds raw credential payload', () => {
    const assertion = credentialValidAssertion({
      subjectCommitment: SUBJECT,
      purposeId: PURPOSE,
      evidenceCommitmentHash: EVIDENCE,
      credentialStatus: 'VALID',
      evaluatedAt: NOW,
    });
    assert.equal(JSON.stringify(assertion).includes('transcript'), false);
    assert.equal(assertion.rawDataIncluded, false);
  });
});
