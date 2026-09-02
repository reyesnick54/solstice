import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../../../domain/src/time.ts';
import {
  newConsentGrantId,
  newPurposeAuthorizationId,
  newRightsGrantId,
  newRightsRevocationId,
} from '../rights/ids.ts';
import { scopeCommitmentFromLabels, subjectCommitment } from '../rights/commitments.ts';
import type { ConsentGrant, RightsGrant, RightsRevocation } from '../rights/types.ts';
import {
  buildAuthorizedComputationParticipation,
  buildAuthorizedDatasetContribution,
  buildOffChainRecordReference,
  contributionCommitment,
  isRawDataContribution,
  minimumNecessaryProofSufficient,
} from './contribution.ts';
import {
  attachUsageReceiptCommitment,
  buildHumanEconomyConsentGrant,
  humanEconomyPurposeAuthorization,
  renewHumanEconomyConsent,
} from './consent.ts';
import {
  humanDataUsageReceiptCommitment,
  humanEconomyConsentCommitment,
  serializedCommitmentExcludesSensitiveFields,
} from './commitments.ts';
import {
  assessCommitmentEntropy,
  handleOffChainRecordDeletion,
  historicalCommitmentRemainsValidAfterDeletion,
  offChainRecordAvailableForFutureUse,
} from './deletion-boundary.ts';
import {
  buildHistoricalAuthorizationProof,
  evaluateHumanEconomyRights,
} from './evaluation.ts';
import { domainsWithIngestBlocked, HIN_DOMAIN_AUDIT } from './hin-audit.ts';
import {
  agentCannotBecomeDatasetMonetization,
  researchCannotBecomeMonetary,
} from './purpose-controls.ts';
import { UNCONFIGURED_SELECTIVE_DISCLOSURE_BOUNDARY, selectiveDisclosureAvailable } from './selective-disclosure.ts';
import {
  buildHumanDataUsageReceipt,
  usageReceiptExcludesRawPayload,
} from './usage-receipt.ts';
import type { MinimumNecessaryProof } from './types.ts';

const NOW = asUtcInstant('2026-09-02T10:00:00.000Z');
const PAST = asUtcInstant('2025-01-01T00:00:00.000Z');
const FUTURE = asUtcInstant('2027-01-01T00:00:00.000Z');
const LATER = asUtcInstant('2026-09-02T11:00:00.000Z');
const EXECUTION = asUtcInstant('2026-09-02T09:00:00.000Z');

const PURPOSE_VERIFICATION = humanEconomyPurposeAuthorization('CONTRIBUTION_VERIFICATION', 1);
const PURPOSE_RESEARCH = humanEconomyPurposeAuthorization('RESEARCH_USE', 1);
const PURPOSE_MONETARY = humanEconomyPurposeAuthorization('MONETARY_PROPOSAL', 1);
const PURPOSE_AGENT = humanEconomyPurposeAuthorization('PERSONAL_AGENT_USE', 1);

function baseRightsGrant(): RightsGrant {
  return Object.freeze({
    schemaVersion: 1,
    rightsGrantId: newRightsGrantId('human-wave6'),
    economyKind: 'HUMAN',
    subjectCommitment: subjectCommitment('subj_wave6', 'US'),
    controllerRef: 'controller:hin',
    dataScopeCommitment: scopeCommitmentFromLabels(['contribution-metadata']),
    evidenceScopeCommitment: scopeCommitmentFromLabels(['verification-bundle']),
    permittedPurposes: [
      PURPOSE_VERIFICATION.purposeId,
      PURPOSE_RESEARCH.purposeId,
      PURPOSE_AGENT.purposeId,
      PURPOSE_MONETARY.purposeId,
    ],
    prohibitedPurposes: [],
    jurisdiction: 'US',
    effectiveFrom: PAST,
    effectiveUntil: FUTURE,
    revocationRef: null,
    delegation: Object.freeze({ delegable: false, maxSubdelegates: 0, notes: null }),
    issuerRef: 'issuer:consent-ledger',
    authorizationRef: 'auth:wave6',
    authorizesMonetaryIssuance: false,
    authorizesEconomicValuation: false,
  });
}

function baseConsentGrant(purposeId = PURPOSE_VERIFICATION.purposeId): ConsentGrant {
  return Object.freeze({
    schemaVersion: 1,
    consentGrantId: newConsentGrantId('consent-wave6'),
    rightsGrantId: baseRightsGrant().rightsGrantId,
    authorizerRef: 'subject:wave6',
    contributionCategory: 'INFORMATION_RIGHT_CONTRIBUTION',
    dataCategoryCommitment: scopeCommitmentFromLabels(['hin-descriptor']),
    purposeId,
    scopeCommitment: scopeCommitmentFromLabels(['verify-only', 'credential-proof']),
    effectiveFrom: PAST,
    effectiveUntil: FUTURE,
    revocationRef: null,
    proofRef: 'offchain:consent-receipt-hash-only',
    authorizesMonetaryIssuance: false,
    authorizesEconomicValuation: false,
  });
}

function activeHumanConsent(purposeCode: 'CONTRIBUTION_VERIFICATION' | 'RESEARCH_USE' | 'PERSONAL_AGENT_USE' = 'CONTRIBUTION_VERIFICATION') {
  const purpose = humanEconomyPurposeAuthorization(purposeCode, 1);
  return buildHumanEconomyConsentGrant(`consent-${purposeCode}`, {
    baseConsentGrant: baseConsentGrant(purpose.purposeId),
    purposeCode,
    consentVersion: 1,
    recipientSystemRef: 'service:hin-verification',
    scopeLabels: ['verify-only', 'credential-proof'],
  });
}

describe('Wave 6 Human Economy privacy, rights, and consent', () => {
  it('audits HIN data paths without activating sensitive ingestion', () => {
    assert.ok(HIN_DOMAIN_AUDIT.length >= 14);
    const blocked = domainsWithIngestBlocked();
    assert.ok(blocked.some((entry) => entry.domain === 'health'));
    assert.ok(blocked.some((entry) => entry.domain === 'DNA'));
    assert.ok(blocked.some((entry) => entry.domain === 'location'));
  });

  it('denies wrong purpose', () => {
    const consent = activeHumanConsent('CONTRIBUTION_VERIFICATION');
    const result = evaluateHumanEconomyRights({
      humanConsent: consent,
      rightsGrant: baseRightsGrant(),
      requestedPurpose: 'MONETARY_PROPOSAL',
      authorizedPurpose: 'CONTRIBUTION_VERIFICATION',
      scopeLabels: ['verify-only'],
      recipientSystemRef: 'service:hin-verification',
      at: NOW,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    assert.equal(result.decision, 'DENY');
    if (result.decision === 'DENY') {
      assert.equal(result.reasonCode, 'PURPOSE_IMPLIED_NOT_PERMITTED');
    }
  });

  it('denies expired consent', () => {
    const expiredBase = Object.freeze({
      ...baseConsentGrant(),
      effectiveUntil: PAST,
    });
    const consent = buildHumanEconomyConsentGrant('expired', {
      baseConsentGrant: expiredBase,
      purposeCode: 'CONTRIBUTION_VERIFICATION',
      consentVersion: 1,
      recipientSystemRef: 'service:hin-verification',
      scopeLabels: ['verify-only'],
      lifecycleState: 'EXPIRED',
    });
    const result = evaluateHumanEconomyRights({
      humanConsent: consent,
      rightsGrant: baseRightsGrant(),
      requestedPurpose: 'CONTRIBUTION_VERIFICATION',
      authorizedPurpose: 'CONTRIBUTION_VERIFICATION',
      scopeLabels: ['verify-only'],
      recipientSystemRef: 'service:hin-verification',
      at: NOW,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    assert.equal(result.decision, 'DENY');
    if (result.decision === 'DENY') {
      assert.equal(result.reasonCode, 'CONSENT_EXPIRED');
    }
  });

  it('denies revoked consent for future use', () => {
    const consent = activeHumanConsent();
    const revocation: RightsRevocation = Object.freeze({
      schemaVersion: 1,
      revocationId: newRightsRevocationId('revoke-wave6'),
      targetGrantId: consent.baseConsentGrant.consentGrantId,
      targetKind: 'CONSENT_GRANT',
      revokedAt: NOW,
      reason: 'subject withdrew',
      effectiveForFutureUse: true,
      preservesHistoricalProof: true,
    });
    const revokedConsent = Object.freeze({
      ...consent,
      lifecycleState: 'REVOKED' as const,
    });
    const result = evaluateHumanEconomyRights({
      humanConsent: revokedConsent,
      rightsGrant: baseRightsGrant(),
      requestedPurpose: 'CONTRIBUTION_VERIFICATION',
      authorizedPurpose: 'CONTRIBUTION_VERIFICATION',
      scopeLabels: ['verify-only'],
      recipientSystemRef: 'service:hin-verification',
      at: LATER,
      revocations: [revocation],
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    assert.equal(result.decision, 'DENY');
    if (result.decision === 'DENY') {
      assert.equal(result.reasonCode, 'CONSENT_REVOKED');
    }
  });

  it('denies scope mismatch', () => {
    const consent = activeHumanConsent();
    const result = evaluateHumanEconomyRights({
      humanConsent: consent,
      rightsGrant: baseRightsGrant(),
      requestedPurpose: 'CONTRIBUTION_VERIFICATION',
      authorizedPurpose: 'CONTRIBUTION_VERIFICATION',
      scopeLabels: ['full-medical-record'],
      recipientSystemRef: 'service:hin-verification',
      at: NOW,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    assert.equal(result.decision, 'DENY');
    if (result.decision === 'DENY') {
      assert.equal(result.reasonCode, 'SCOPE_MISMATCH');
    }
  });

  it('denies missing consent', () => {
    const result = evaluateHumanEconomyRights({
      humanConsent: null,
      rightsGrant: baseRightsGrant(),
      requestedPurpose: 'CONTRIBUTION_VERIFICATION',
      authorizedPurpose: 'CONTRIBUTION_VERIFICATION',
      scopeLabels: ['verify-only'],
      recipientSystemRef: 'service:hin-verification',
      at: NOW,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    assert.equal(result.decision, 'DENY');
    if (result.decision === 'DENY') {
      assert.equal(result.reasonCode, 'CONSENT_MISSING');
    }
  });

  it('allows authorized computation participation with minimum necessary proof', () => {
    const consent = activeHumanConsent('CONTRIBUTION_VERIFICATION');
    const proof: MinimumNecessaryProof = Object.freeze({
      kind: 'AUTHORIZED_COMPUTATION_COMPLETED',
      valid: true,
      evidenceRef: 'evidence:computation-result-hash',
      underlyingRecordRequired: false,
    });
    const result = evaluateHumanEconomyRights({
      humanConsent: consent,
      rightsGrant: baseRightsGrant(),
      requestedPurpose: 'CONTRIBUTION_VERIFICATION',
      authorizedPurpose: 'CONTRIBUTION_VERIFICATION',
      scopeLabels: ['verify-only'],
      recipientSystemRef: 'service:hin-verification',
      at: NOW,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
      minimumNecessaryProof: proof,
    });
    assert.equal(result.decision, 'ALLOW');

    const participation = buildAuthorizedComputationParticipation({
      seed: 'comp-1',
      subjectRef: 'subj_wave6',
      jurisdiction: 'US',
      humanConsentGrantId: consent.humanConsentGrantId,
      purposeCode: 'CONTRIBUTION_VERIFICATION',
      computationRef: 'computation:clean-room-1',
      resultEvidenceRef: 'evidence:result-hash',
      occurredAt: NOW,
    });
    assert.equal(participation.rawDataOnChain, false);
    assert.equal(participation.computationCompleted, true);
    const commitment = contributionCommitment(participation);
    assert.ok(commitment.length === 64);
    assert.ok(!JSON.stringify(participation).includes('rawMedicalRecord'));
  });

  it('keeps raw sensitive values absent from chain commitments', () => {
    const consent = activeHumanConsent();
    const contribution = buildAuthorizedDatasetContribution({
      seed: 'dataset-1',
      subjectRef: 'subj_wave6',
      jurisdiction: 'US',
      humanConsentGrantId: consent.humanConsentGrantId,
      purposeCode: 'RESEARCH_USE',
      authorizedComputationRef: 'computation:aggregate-research',
      dataClassification: 'SENSITIVE_PERSONAL',
      offChainRecordSeed: 'offchain-record-1',
      occurredAt: NOW,
    });
    assert.equal(contribution.rawDataOnChain, false);
    const serialized = JSON.stringify(contribution);
    assert.ok(serializedCommitmentExcludesSensitiveFields(serialized));
    assert.ok(humanEconomyConsentCommitment(consent).length === 64);
    assert.equal(isRawDataContribution({ rawPayload: 'diagnosis:cancer', classification: 'HIGHLY_RESTRICTED' }), false);
  });

  it('keeps raw sensitive values absent from usage receipt logs', () => {
    const consent = activeHumanConsent();
    const evaluation = evaluateHumanEconomyRights({
      humanConsent: consent,
      rightsGrant: baseRightsGrant(),
      requestedPurpose: 'CONTRIBUTION_VERIFICATION',
      authorizedPurpose: 'CONTRIBUTION_VERIFICATION',
      scopeLabels: ['verify-only'],
      recipientSystemRef: 'service:hin-verification',
      at: NOW,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    assert.equal(evaluation.decision, 'ALLOW');
    if (evaluation.decision !== 'ALLOW') {
      return;
    }

    const rightsEval = {
      decision: 'ALLOW' as const,
      commitment: evaluation.rightsCommitment,
      grantStateAtEvaluation: 'ACTIVE' as const,
      reliedUpon: Object.freeze({
        rightsGrantId: baseRightsGrant().rightsGrantId,
        consentGrantId: consent.baseConsentGrant.consentGrantId,
        licenseId: null,
        purposeId: evaluation.purpose.purposeId,
        revocationRef: null,
      }),
    };

    const receipt = buildHumanDataUsageReceipt({
      seed: 'receipt-1',
      humanConsent: consent,
      rightsGrantId: baseRightsGrant().rightsGrantId,
      serviceRef: 'service:hin-verification',
      occurredAt: NOW,
      computationQueryRef: 'query:credential-valid',
      resultEvidenceRef: 'evidence:credential-true',
      policyVersion: 'wave6-human-privacy:v1',
      rightsEvaluation: rightsEval,
    });
    assert.ok(usageReceiptExcludesRawPayload(receipt));
    const receiptCommitment = humanDataUsageReceiptCommitment(receipt);
    assert.ok(receiptCommitment.length === 64);
    const withReceipt = attachUsageReceiptCommitment(consent, receiptCommitment);
    assert.equal(withReceipt.usageReceiptCommitments.length, 1);
  });

  it('preserves historical commitment structure after off-chain deletion', () => {
    const record = buildOffChainRecordReference({
      seed: 'record-delete-1',
      classification: 'PERSONAL',
      scopeLabels: ['verify-only'],
    });
    const { updatedRecord, outcome } = handleOffChainRecordDeletion(record, LATER);
    assert.equal(outcome.onChainCommitmentPreserved, true);
    assert.equal(outcome.historicalProofValid, true);
    assert.equal(outcome.futureUseBlocked, true);
    assert.equal(offChainRecordAvailableForFutureUse(updatedRecord, LATER), false);
    assert.equal(historicalCommitmentRemainsValidAfterDeletion(updatedRecord), true);
    assert.equal(updatedRecord.commitment, record.commitment);
  });

  it('blocks research permission from becoming monetary permission', () => {
    assert.equal(researchCannotBecomeMonetary('RESEARCH_USE', 'MONETARY_PROPOSAL'), true);
    const consent = activeHumanConsent('RESEARCH_USE');
    const result = evaluateHumanEconomyRights({
      humanConsent: consent,
      rightsGrant: baseRightsGrant(),
      requestedPurpose: 'MONETARY_PROPOSAL',
      authorizedPurpose: 'RESEARCH_USE',
      scopeLabels: ['verify-only'],
      recipientSystemRef: 'service:hin-verification',
      at: NOW,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    assert.equal(result.decision, 'DENY');
    if (result.decision === 'DENY') {
      assert.equal(result.reasonCode, 'PURPOSE_IMPLIED_NOT_PERMITTED');
    }
  });

  it('blocks agent permission from becoming dataset monetization permission', () => {
    assert.equal(agentCannotBecomeDatasetMonetization('PERSONAL_AGENT_USE', 'ECONOMIC_VALUATION'), true);
    const consent = buildHumanEconomyConsentGrant('agent-consent', {
      baseConsentGrant: baseConsentGrant(PURPOSE_AGENT.purposeId),
      purposeCode: 'PERSONAL_AGENT_USE',
      consentVersion: 1,
      recipientSystemRef: 'service:personal-agent',
      scopeLabels: ['agent-analysis'],
    });
    const result = evaluateHumanEconomyRights({
      humanConsent: consent,
      rightsGrant: baseRightsGrant(),
      requestedPurpose: 'ECONOMIC_VALUATION',
      authorizedPurpose: 'PERSONAL_AGENT_USE',
      scopeLabels: ['agent-analysis'],
      recipientSystemRef: 'service:personal-agent',
      at: NOW,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    assert.equal(result.decision, 'DENY');
    if (result.decision === 'DENY') {
      assert.equal(result.reasonCode, 'PURPOSE_IMPLIED_NOT_PERMITTED');
    }
  });

  it('preserves historical authorization after later revocation', () => {
    const consent = activeHumanConsent();
    const allowed = evaluateHumanEconomyRights({
      humanConsent: consent,
      rightsGrant: baseRightsGrant(),
      requestedPurpose: 'CONTRIBUTION_VERIFICATION',
      authorizedPurpose: 'CONTRIBUTION_VERIFICATION',
      scopeLabels: ['verify-only'],
      recipientSystemRef: 'service:hin-verification',
      at: EXECUTION,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    assert.equal(allowed.decision, 'ALLOW');
    if (allowed.decision !== 'ALLOW') {
      return;
    }

    const revocation: RightsRevocation = Object.freeze({
      schemaVersion: 1,
      revocationId: newRightsRevocationId('revoke-hist-wave6'),
      targetGrantId: baseRightsGrant().rightsGrantId,
      targetKind: 'RIGHTS_GRANT',
      revokedAt: LATER,
      reason: 'post-execution revocation',
      effectiveForFutureUse: true,
      preservesHistoricalProof: true,
    });

    const historical = buildHistoricalAuthorizationProof({
      executionAt: EXECUTION,
      evaluatedAt: LATER,
      humanConsentGrantId: consent.humanConsentGrantId,
      rightsCommitment: allowed.rightsCommitment,
      revocations: [revocation],
      rightsGrantId: baseRightsGrant().rightsGrantId,
    });
    assert.equal(historical.validAtExecutionTime, true);
    assert.equal(historical.blockedForFutureUse, true);
  });

  it('supports consent renewal without vague perpetual blanket consent', () => {
    const prior = activeHumanConsent();
    const renewed = renewHumanEconomyConsent(prior, 'renewed-consent', {
      baseConsentGrant: baseConsentGrant(),
      effectiveFrom: NOW,
      effectiveUntil: FUTURE,
      consentVersion: 2,
    });
    assert.equal(renewed.consentVersion, 2);
    assert.equal(renewed.renewedFromConsentId, prior.humanConsentGrantId);
    assert.notEqual(renewed.humanConsentGrantId, prior.humanConsentGrantId);
    assert.equal(renewed.purposeCode, 'CONTRIBUTION_VERIFICATION');
  });

  it('flags low-entropy commitment risk for highly restricted data', () => {
    const assessment = assessCommitmentEntropy({
      commitment: 'abc123',
      classification: 'HIGHLY_RESTRICTED',
      labelCount: 1,
    });
    assert.equal(assessment.lowEntropyRisk, true);
    assert.equal(assessment.recommendation, 'OFF_CHAIN_ONLY');
  });

  it('leaves selective disclosure boundary unconfigured for later hardening', () => {
    assert.equal(selectiveDisclosureAvailable(UNCONFIGURED_SELECTIVE_DISCLOSURE_BOUNDARY), false);
    assert.equal(minimumNecessaryProofSufficient({
      kind: 'CREDENTIAL_VALID',
      valid: true,
      evidenceRef: 'evidence:credential',
      underlyingRecordRequired: false,
    }), true);
  });
});
