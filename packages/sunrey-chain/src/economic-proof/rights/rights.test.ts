import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../../../domain/src/time.ts';
import {
  consentGrantCommitment,
  rightsGrantCommitment,
  rightsCommitmentDigest,
  scopeCommitmentFromLabels,
  subjectCommitment,
  verifyRightsCommitmentIntegrity,
} from './commitments.ts';
import {
  evaluateRightsFailClosed,
  buildHistoricalRightsProof,
} from './evaluation.ts';
import {
  newConsentGrantId,
  newLicenseAuthorizationId,
  newPurposeAuthorizationId,
  newRightsDeltaId,
  newRightsGrantId,
  newRightsRevocationId,
} from './ids.ts';
import { rightsRootFromCommitments, rightsRootFromDeltas } from './root.ts';
import type {
  ConsentGrant,
  LicenseAuthorization,
  PurposeAuthorization,
  RightsDelta,
  RightsGrant,
  RightsRevocation,
} from './types.ts';
import { computeAppHash, computeBlockStateRoots, blockStateChangedWhenRightsChange } from '../state-commitment/roots.ts';

const NOW = asUtcInstant('2026-09-02T08:00:00.000Z');
const LATER = asUtcInstant('2026-09-02T09:00:00.000Z');
const EXPIRED = asUtcInstant('2025-01-01T00:00:00.000Z');
const FUTURE = asUtcInstant('2027-01-01T00:00:00.000Z');

const PURPOSE_VERIFICATION: PurposeAuthorization = Object.freeze({
  schemaVersion: 1,
  purposeId: newPurposeAuthorizationId('CONTRIBUTION_VERIFICATION', 1),
  purposeVersion: 1,
  code: 'CONTRIBUTION_VERIFICATION',
  description: 'Verify a human contribution claim',
});

const PURPOSE_VALUATION: PurposeAuthorization = Object.freeze({
  schemaVersion: 1,
  purposeId: newPurposeAuthorizationId('ECONOMIC_VALUATION', 1),
  purposeVersion: 1,
  code: 'ECONOMIC_VALUATION',
  description: 'Economic valuation of contribution evidence',
});

const PURPOSE_MONETARY: PurposeAuthorization = Object.freeze({
  schemaVersion: 1,
  purposeId: newPurposeAuthorizationId('MONETARY_PROPOSAL', 1),
  purposeVersion: 1,
  code: 'MONETARY_PROPOSAL',
  description: 'Propose monetary issuance for human review',
});

function humanRightsGrant(overrides: Partial<RightsGrant> = {}): RightsGrant {
  return Object.freeze({
    schemaVersion: 1,
    rightsGrantId: newRightsGrantId('human-1'),
    economyKind: 'HUMAN',
    subjectCommitment: subjectCommitment('subj_demo', 'US'),
    controllerRef: 'controller:hin',
    dataScopeCommitment: scopeCommitmentFromLabels(['contribution-metadata']),
    evidenceScopeCommitment: scopeCommitmentFromLabels(['verification-bundle']),
    permittedPurposes: [PURPOSE_VERIFICATION.purposeId, PURPOSE_VALUATION.purposeId],
    prohibitedPurposes: [PURPOSE_MONETARY.purposeId],
    jurisdiction: 'US',
    effectiveFrom: EXPIRED,
    effectiveUntil: FUTURE,
    revocationRef: null,
    delegation: Object.freeze({ delegable: false, maxSubdelegates: 0, notes: null }),
    issuerRef: 'issuer:consent-ledger',
    authorizationRef: 'auth:fixture-1',
    authorizesMonetaryIssuance: false,
    authorizesEconomicValuation: false,
    ...overrides,
  });
}

function humanConsent(overrides: Partial<ConsentGrant> = {}): ConsentGrant {
  const rightsGrantId = overrides.rightsGrantId ?? newRightsGrantId('human-1');
  return Object.freeze({
    schemaVersion: 1,
    consentGrantId: newConsentGrantId('consent-1'),
    rightsGrantId,
    authorizerRef: 'subject:demo',
    contributionCategory: 'INFORMATION_RIGHT_CONTRIBUTION',
    dataCategoryCommitment: scopeCommitmentFromLabels(['hin-descriptor']),
    purposeId: PURPOSE_VERIFICATION.purposeId,
    scopeCommitment: scopeCommitmentFromLabels(['verify-only']),
    effectiveFrom: EXPIRED,
    effectiveUntil: FUTURE,
    revocationRef: null,
    proofRef: 'offchain:consent-receipt-hash-only',
    authorizesMonetaryIssuance: false,
    authorizesEconomicValuation: false,
    ...overrides,
  });
}

function productiveRightsGrant(overrides: Partial<RightsGrant> = {}): RightsGrant {
  return Object.freeze({
    schemaVersion: 1,
    rightsGrantId: newRightsGrantId('productive-1'),
    economyKind: 'PRODUCTIVE',
    subjectCommitment: subjectCommitment('provider:oracle-fixture', 'GLOBAL'),
    controllerRef: 'controller:provider',
    dataScopeCommitment: scopeCommitmentFromLabels(['oracle-observation']),
    evidenceScopeCommitment: scopeCommitmentFromLabels(['certified-source']),
    permittedPurposes: [PURPOSE_VERIFICATION.purposeId],
    prohibitedPurposes: [],
    jurisdiction: 'GLOBAL',
    effectiveFrom: EXPIRED,
    effectiveUntil: FUTURE,
    revocationRef: null,
    delegation: Object.freeze({ delegable: false, maxSubdelegates: 0, notes: null }),
    issuerRef: 'issuer:provider-config',
    authorizationRef: 'auth:provider-license',
    authorizesMonetaryIssuance: false,
    authorizesEconomicValuation: false,
    ...overrides,
  });
}

function productiveLicense(overrides: Partial<LicenseAuthorization> = {}): LicenseAuthorization {
  return Object.freeze({
    schemaVersion: 1,
    licenseId: newLicenseAuthorizationId('license-1'),
    providerRef: 'provider:fixture-energy',
    sourceScopeCommitment: scopeCommitmentFromLabels(['energy-grid-feed']),
    commercialUse: 'ALLOWED',
    persistence: 'RESTRICTED',
    derivedUse: 'ALLOWED',
    redistribution: 'FORBIDDEN',
    attributionRequired: true,
    effectiveFrom: EXPIRED,
    expiresAt: FUTURE,
    configurationRef: 'provider-config:fixture-energy:v1',
    authorizesMonetaryIssuance: false,
    ...overrides,
  });
}

describe('Wave 3 economic-proof rights', () => {
  it('permits the correct purpose', () => {
    const grant = humanRightsGrant();
    const consent = humanConsent({ rightsGrantId: grant.rightsGrantId });
    const result = evaluateRightsFailClosed({
      rightsGrant: grant,
      consentGrant: consent,
      requestedPurpose: PURPOSE_VERIFICATION,
      at: NOW,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    assert.equal(result.decision, 'ALLOW');
    if (result.decision === 'ALLOW') {
      assert.equal(result.reliedUpon.purposeId, PURPOSE_VERIFICATION.purposeId);
    }
  });

  it('denies the wrong purpose', () => {
    const grant = humanRightsGrant();
    const consent = humanConsent({
      rightsGrantId: grant.rightsGrantId,
      purposeId: PURPOSE_VERIFICATION.purposeId,
    });
    const result = evaluateRightsFailClosed({
      rightsGrant: grant,
      consentGrant: consent,
      requestedPurpose: PURPOSE_VALUATION,
      at: NOW,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    assert.equal(result.decision, 'DENY');
    if (result.decision === 'DENY') {
      assert.equal(result.reasonCode, 'PURPOSE_NOT_PERMITTED');
    }
  });

  it('denies expired rights', () => {
    const grant = humanRightsGrant({ effectiveUntil: EXPIRED });
    const result = evaluateRightsFailClosed({
      rightsGrant: grant,
      requestedPurpose: PURPOSE_VERIFICATION,
      at: NOW,
    });
    assert.equal(result.decision, 'DENY');
    if (result.decision === 'DENY') {
      assert.equal(result.reasonCode, 'RIGHTS_EXPIRED');
    }
  });

  it('denies revoked rights for future action', () => {
    const grant = humanRightsGrant();
    const revocation: RightsRevocation = Object.freeze({
      schemaVersion: 1,
      revocationId: newRightsRevocationId('revoke-1'),
      targetGrantId: grant.rightsGrantId,
      targetKind: 'RIGHTS_GRANT',
      revokedAt: NOW,
      reason: 'subject withdrew participation',
      effectiveForFutureUse: true,
      preservesHistoricalProof: true,
    });
    const result = evaluateRightsFailClosed({
      rightsGrant: grant,
      requestedPurpose: PURPOSE_VERIFICATION,
      at: LATER,
      revocations: [revocation],
    });
    assert.equal(result.decision, 'DENY');
    if (result.decision === 'DENY') {
      assert.equal(result.reasonCode, 'RIGHTS_REVOKED');
    }
  });

  it('keeps historic valid authorization auditable after later revocation', () => {
    const grant = humanRightsGrant();
    const consent = humanConsent({ rightsGrantId: grant.rightsGrantId });
    const executionAt = asUtcInstant('2026-09-02T07:00:00.000Z');
    const allowed = evaluateRightsFailClosed({
      rightsGrant: grant,
      consentGrant: consent,
      requestedPurpose: PURPOSE_VERIFICATION,
      at: executionAt,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    assert.equal(allowed.decision, 'ALLOW');
    if (allowed.decision !== 'ALLOW') {
      return;
    }

    const revocation: RightsRevocation = Object.freeze({
      schemaVersion: 1,
      revocationId: newRightsRevocationId('revoke-hist'),
      targetGrantId: grant.rightsGrantId,
      targetKind: 'RIGHTS_GRANT',
      revokedAt: LATER,
      reason: 'post-execution revocation',
      effectiveForFutureUse: true,
      preservesHistoricalProof: true,
    });

    const historical = buildHistoricalRightsProof({
      executionAt,
      evaluatedAt: LATER,
      commitment: allowed.commitment,
      revocations: [revocation],
      rightsGrantId: grant.rightsGrantId,
    });
    assert.equal(historical.validAtExecutionTime, true);
    assert.equal(historical.blockedForFutureUse, true);
    assert.ok(historical.commitment.commitmentId);
  });

  it('denies missing consent where required for human economy sensitive classes', () => {
    const grant = humanRightsGrant();
    const result = evaluateRightsFailClosed({
      rightsGrant: grant,
      requestedPurpose: PURPOSE_VERIFICATION,
      at: NOW,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    assert.equal(result.decision, 'DENY');
    if (result.decision === 'DENY') {
      assert.equal(result.reasonCode, 'CONSENT_REQUIRED');
    }
  });

  it('does not treat consent as mint authorization', () => {
    const grant = humanRightsGrant({
      permittedPurposes: [...grantPermitsMintPurpose()],
      prohibitedPurposes: [],
    });
    const consent = humanConsent({
      rightsGrantId: grant.rightsGrantId,
      purposeId: PURPOSE_MONETARY.purposeId,
    });
    const result = evaluateRightsFailClosed({
      rightsGrant: grant,
      consentGrant: consent,
      requestedPurpose: PURPOSE_MONETARY,
      at: NOW,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    assert.equal(result.decision, 'DENY');
    if (result.decision === 'DENY') {
      assert.equal(result.reasonCode, 'CONSENT_DOES_NOT_AUTHORIZE_ISSUANCE');
    }
  });

  it('enforces productive license restrictions from provider configuration', () => {
    const grant = productiveRightsGrant();
    const license = productiveLicense({ redistribution: 'FORBIDDEN' });
    const result = evaluateRightsFailClosed({
      rightsGrant: grant,
      licenseAuthorization: license,
      requestedPurpose: PURPOSE_VERIFICATION,
      at: NOW,
      licenseOperation: 'REDISTRIBUTION',
    });
    assert.equal(result.decision, 'DENY');
    if (result.decision === 'DENY') {
      assert.equal(result.reasonCode, 'LICENSE_RESTRICTION');
    }
  });

  it('produces deterministic RightsCommitment digests', () => {
    const grant = humanRightsGrant();
    const consent = humanConsent({ rightsGrantId: grant.rightsGrantId });
    const first = evaluateRightsFailClosed({
      rightsGrant: grant,
      consentGrant: consent,
      requestedPurpose: PURPOSE_VERIFICATION,
      at: NOW,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    const second = evaluateRightsFailClosed({
      rightsGrant: grant,
      consentGrant: consent,
      requestedPurpose: PURPOSE_VERIFICATION,
      at: NOW,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    assert.equal(first.decision, 'ALLOW');
    assert.equal(second.decision, 'ALLOW');
    if (first.decision === 'ALLOW' && second.decision === 'ALLOW') {
      assert.equal(
        rightsCommitmentDigest(first.commitment),
        rightsCommitmentDigest(second.commitment),
      );
    }
  });

  it('produces deterministic RightsRoot values', () => {
    const leaves = [
      rightsGrantCommitment(humanRightsGrant()),
      consentGrantCommitment(humanConsent()),
    ];
    assert.equal(rightsRootFromCommitments(leaves), rightsRootFromCommitments([...leaves].reverse()));
    const delta: RightsDelta = Object.freeze({
      schemaVersion: 1,
      deltaId: newRightsDeltaId('delta-1'),
      sequence: 1,
      commitment: leaves[0]!,
      occurredAt: NOW,
    });
    assert.equal(rightsRootFromDeltas([delta]), rightsRootFromDeltas([delta]));
  });

  it('invalidates proof when commitment material is tampered', () => {
    const grant = humanRightsGrant();
    const consent = humanConsent({ rightsGrantId: grant.rightsGrantId });
    const allowed = evaluateRightsFailClosed({
      rightsGrant: grant,
      consentGrant: consent,
      requestedPurpose: PURPOSE_VERIFICATION,
      at: NOW,
      contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
    });
    assert.equal(allowed.decision, 'ALLOW');
    if (allowed.decision !== 'ALLOW') {
      return;
    }
    const digest = rightsCommitmentDigest(allowed.commitment);
    const tampered = Object.freeze({
      ...allowed.commitment,
      jurisdiction: 'XX',
    });
    assert.equal(verifyRightsCommitmentIntegrity(tampered, digest), false);
  });

  it('changes block app hash when rights commitment changes', () => {
    const leaf = (label: string) => rightsGrantCommitment(humanRightsGrant({ authorizationRef: label }));
    const base = computeBlockStateRoots({
      transactionLeaves: [leaf('tx-a')],
      monetaryStateLeaves: [leaf('supply-a')],
      evidenceLeaves: [leaf('evidence-a')],
      rightsLeaves: [leaf('rights-a')],
    });
    const changed = computeBlockStateRoots({
      transactionLeaves: [leaf('tx-a')],
      monetaryStateLeaves: [leaf('supply-a')],
      evidenceLeaves: [leaf('evidence-a')],
      rightsLeaves: [leaf('rights-b')],
    });
    assert.equal(blockStateChangedWhenRightsChange(base, changed), true);
    assert.notEqual(computeAppHash(base), computeAppHash(changed));
  });

  it('keeps raw personal rights documents off-chain via commitments only', () => {
    const grant = humanRightsGrant();
    const serialized = JSON.stringify(grant);
    assert.ok(!serialized.includes('legalName'));
    assert.ok(!serialized.includes('email'));
    assert.ok(grant.subjectCommitment.length === 64);
    const consent = humanConsent({ rightsGrantId: grant.rightsGrantId });
    assert.ok(consent.proofRef.startsWith('offchain:'));
    assert.ok(!JSON.stringify(consent).includes('rawConsentDocument'));
  });
});

function grantPermitsMintPurpose(): readonly ReturnType<typeof newPurposeAuthorizationId>[] {
  return [PURPOSE_MONETARY.purposeId];
}
