import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { HumanInformationNetworkEngine } from './network/engine.ts';
import { HUMAN_INFORMATION_RIGHTS_SAFETY } from './network/taxonomy.ts';

const NOW = asUtcInstant('2026-08-18T14:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-18T14:00:00.000Z');

function harness() {
  const net = new HumanInformationNetworkEngine({ clock: new FrozenClock(NOW) });
  const subject = unwrap(net.registerSubject({ internalRef: 'prop-subject' }));
  const descriptor = unwrap(
    net.registerDescriptor({
      subjectId: subject.subjectId,
      category: 'COMMERCE_PREFERENCES',
      schema: 'prefs-v1',
      sourceClass: 'PERSONAL_DATA_VAULT',
      freshness: 'P7D',
      sensitivityClass: 'PERSONAL',
      permittedComputationClasses: ['CLEAN_ROOM_COMPUTATION'],
    }),
  );
  unwrap(
    net.registerRequester({
      requesterId: 'req_prop',
      organization: 'Property Lab',
      requesterClass: 'RESEARCH_INSTITUTION',
      jurisdiction: 'GB',
    }),
  );
  const computation = unwrap(
    net.registerApprovedComputation({
      codeVersion: 'bool-v1',
      queryDefinition: 'BOOLEAN_ATTESTATION',
      artifactDigest: 'sha256:bool',
      allowedOutputClasses: ['BOOLEAN_ATTESTATION', 'AGGREGATE_STATISTIC'],
    }),
  );
  const request = unwrap(
    net.submitInformationRequest({
      requesterId: 'req_prop',
      requestedRight: 'VERIFIED_ATTRIBUTE_QUERY',
      purpose: 'VERIFIED_ATTRIBUTE_RESEARCH',
      computationId: computation.computationId,
      duration: 'P14D',
      compensationAsset: 'SUNREY_COIN',
      compensationMinor: 10n,
      jurisdiction: 'GB',
    }),
  );
  const approved = unwrap(
    net.approveInformationConsent({
      requestId: request.requestId,
      subjectId: subject.subjectId,
      descriptorId: descriptor.descriptorId,
      processingClass: 'VERIFIED_ATTRIBUTE_QUERY',
      outputClass: 'BOOLEAN_ATTESTATION',
      expiresAt: EXPIRES,
    }),
  );
  return { net, subject, computation, approved };
}

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.code);
  }
  return result.value;
}

describe(HUMAN_INFORMATION_RIGHTS_SAFETY, () => {
  it('refuses use without a valid right', () => {
    const { net, computation } = harness();
    const missing = net.submitCleanRoomComputation({
      requesterId: 'req_prop',
      purpose: 'VERIFIED_ATTRIBUTE_RESEARCH',
      rightId: 'hiright_missing' as never,
      approvedComputationId: computation.computationId,
      outputClass: 'BOOLEAN_ATTESTATION',
      expiresAt: EXPIRES,
      jurisdiction: 'GB',
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error.code, 'USE_WITHOUT_RIGHT');
    }
  });

  it('refuses use outside the bound purpose', () => {
    const { net, computation, approved } = harness();
    const outside = net.submitCleanRoomComputation({
      requesterId: 'req_prop',
      purpose: 'ADVERTISING_RETARGETING',
      rightId: approved.right.rightId,
      approvedComputationId: computation.computationId,
      outputClass: 'BOOLEAN_ATTESTATION',
      expiresAt: EXPIRES,
      jurisdiction: 'GB',
    });
    assert.equal(outside.ok, false);
    if (!outside.ok) {
      assert.equal(outside.error.code, 'PURPOSE_MISMATCH');
    }
  });

  it('refuses future use after revocation', () => {
    const { net, computation, approved } = harness();
    unwrap(net.revokeInformationConsent({ grantId: approved.grant.grantId }));
    const future = net.submitCleanRoomComputation({
      requesterId: 'req_prop',
      purpose: 'VERIFIED_ATTRIBUTE_RESEARCH',
      rightId: approved.right.rightId,
      approvedComputationId: computation.computationId,
      outputClass: 'BOOLEAN_ATTESTATION',
      expiresAt: EXPIRES,
      jurisdiction: 'GB',
    });
    assert.equal(future.ok, false);
    if (!future.ok) {
      assert.equal(future.error.code, 'REVOKED_RIGHT');
    }
  });

  it('treats a developer key alone as insufficient', () => {
    const net = new HumanInformationNetworkEngine({ clock: new FrozenClock(NOW) });
    unwrap(
      net.registerRequester({
        requesterId: 'req_dev',
        organization: 'Dev Co',
        requesterClass: 'ENTERPRISE',
        jurisdiction: 'GB',
      }),
    );
    const denied = net.submitInformationRequest({
      requesterId: 'req_dev',
      requestedRight: 'ONE_TIME_COMPUTATION',
      purpose: 'PRODUCT_RESEARCH',
      duration: 'P7D',
      compensationAsset: 'APPROVED_FIAT',
      compensationMinor: 1n,
      jurisdiction: 'GB',
      developer: {
        credentialId: 'key_only',
        applicationApproved: false,
        scopes: ['HUMAN_INFORMATION_READ'],
        purpose: '',
        consentPresent: false,
        privacyPolicyAccepted: false,
        eligibilitySatisfied: false,
      },
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'DEVELOPER_KEY_INSUFFICIENT');
    }
  });

  it('keeps raw PDV unavailable to a market buyer', () => {
    const { net } = harness();
    const exported = net.exportRawPdv();
    assert.equal(exported.ok, false);
    if (!exported.ok) {
      assert.equal(exported.error.code, 'RAW_PDV_UNAVAILABLE');
    }
  });

  it('refuses unrestricted compensation minting', () => {
    const { net, subject } = harness();
    const minted = net.authorizeCompensation({
      subjectId: subject.subjectId,
      requesterId: 'req_prop',
      asset: 'SUNREY_COIN',
      amountMinor: 100n,
      mintUnrestricted: true,
    });
    assert.equal(minted.ok, false);
    if (!minted.ok) {
      assert.equal(minted.error.code, 'MINT_FORBIDDEN');
    }
  });

  it('binds the approved computation hash', () => {
    const { net, computation, approved } = harness();
    const altered = net.submitCleanRoomComputation({
      requesterId: 'req_prop',
      purpose: 'VERIFIED_ATTRIBUTE_RESEARCH',
      rightId: approved.right.rightId,
      approvedComputationId: computation.computationId,
      outputClass: 'BOOLEAN_ATTESTATION',
      expiresAt: EXPIRES,
      jurisdiction: 'GB',
      requestedComputationHash: 'tampered',
    });
    assert.equal(altered.ok, false);
    if (!altered.ok) {
      assert.equal(altered.error.code, 'COMPUTATION_HASH_MISMATCH');
    }
  });

  it('invalidates a tampered consent hash', () => {
    const { net, approved } = harness();
    const verify = net.verifyConsentHash(approved.grant.grantId, 'deadbeef');
    assert.equal(verify.ok, false);
    if (!verify.ok) {
      assert.equal(verify.error.code, 'CONSENT_HASH_TAMPER');
    }
  });

  it('rejects a generic financial-agent mandate', () => {
    const net = new HumanInformationNetworkEngine({ clock: new FrozenClock(NOW) });
    const subject = unwrap(net.registerSubject({ internalRef: 'agent-user' }));
    const descriptor = unwrap(
      net.registerDescriptor({
        subjectId: subject.subjectId,
        category: 'CREATIVE_ACTIVITY',
        schema: 'creative-v1',
        sourceClass: 'PERSONAL_DATA_VAULT',
        freshness: 'P1D',
        sensitivityClass: 'PERSONAL',
        permittedComputationClasses: ['CLEAN_ROOM_COMPUTATION'],
      }),
    );
    unwrap(
      net.registerRequester({
        requesterId: 'req_agent',
        organization: 'Agent Lab',
        requesterClass: 'ENTERPRISE',
        jurisdiction: 'GB',
      }),
    );
    const request = unwrap(
      net.submitInformationRequest({
        requesterId: 'req_agent',
        requestedRight: 'ONE_TIME_COMPUTATION',
        purpose: 'CREATIVE_ANALYTICS',
        duration: 'P7D',
        compensationAsset: 'APPROVED_FIAT',
        compensationMinor: 1n,
        jurisdiction: 'GB',
      }),
    );
    const denied = net.approveInformationConsent({
      requestId: request.requestId,
      subjectId: subject.subjectId,
      descriptorId: descriptor.descriptorId,
      processingClass: 'CLEAN_ROOM_COMPUTATION',
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
      agent: {
        mandateId: 'fin-agent',
        explicitHumanInformationMandate: false,
        genericFinancialAgent: true,
      },
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'AGENT_MANDATE_INSUFFICIENT');
    }
  });
});
