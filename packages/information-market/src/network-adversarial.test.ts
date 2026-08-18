import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { HumanInformationNetworkEngine } from './network/engine.ts';
import { defaultNetworkPolicy } from './network/policy.ts';

const NOW = asUtcInstant('2026-08-18T14:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-18T14:00:00.000Z');

function setup() {
  const net = new HumanInformationNetworkEngine({ clock: new FrozenClock(NOW) });
  const subject = unwrap(net.registerSubject({ internalRef: 'adv-subject' }));
  const descriptor = unwrap(
    net.registerDescriptor({
      subjectId: subject.subjectId,
      category: 'DEVICE_ACTIVITY_SIGNALS',
      schema: 'device-v1',
      sourceClass: 'AUTHORIZED_CONNECTOR',
      freshness: 'P1D',
      sensitivityClass: 'PERSONAL',
      permittedComputationClasses: ['CLEAN_ROOM_COMPUTATION', 'AGGREGATED_ANALYTICS'],
    }),
  );
  unwrap(
    net.registerRequester({
      requesterId: 'req_good',
      organization: 'Good Org',
      requesterClass: 'RESEARCH_INSTITUTION',
      jurisdiction: 'GB',
    }),
  );
  unwrap(
    net.registerRequester({
      requesterId: 'req_evil',
      organization: 'Evil Org',
      requesterClass: 'ENTERPRISE',
      jurisdiction: 'GB',
    }),
  );
  const computation = unwrap(
    net.registerApprovedComputation({
      codeVersion: 'agg-v1',
      queryDefinition: 'AGGREGATE_MEAN',
      artifactDigest: 'sha256:agg',
      allowedOutputClasses: ['AGGREGATE_STATISTIC'],
    }),
  );
  const request = unwrap(
    net.submitInformationRequest({
      requesterId: 'req_good',
      requestedRight: 'AGGREGATED_ANALYTICS',
      purpose: 'DEVICE_SIGNAL_RESEARCH',
      computationId: computation.computationId,
      duration: 'P21D',
      compensationAsset: 'APPROVED_FIAT',
      compensationMinor: 5n,
      jurisdiction: 'GB',
    }),
  );
  const approved = unwrap(
    net.approveInformationConsent({
      requestId: request.requestId,
      subjectId: subject.subjectId,
      descriptorId: descriptor.descriptorId,
      processingClass: 'AGGREGATED_ANALYTICS',
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
    }),
  );
  return { net, subject, descriptor, computation, request, approved };
}

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.code);
  }
  return result.value;
}

describe('Chunk 100 adversarial privacy tests', () => {
  it('blocks purpose substitution', () => {
    const { net, computation, approved } = setup();
    const attack = net.submitCleanRoomComputation({
      requesterId: 'req_good',
      purpose: 'INSURANCE_UNDERWRITING',
      rightId: approved.right.rightId,
      approvedComputationId: computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
      jurisdiction: 'GB',
      cohortSize: 12,
    });
    assert.equal(attack.ok, false);
    if (!attack.ok) {
      assert.equal(attack.error.code, 'PURPOSE_MISMATCH');
    }
  });

  it('blocks consent replay after revocation', () => {
    const { net, computation, approved } = setup();
    unwrap(net.revokeInformationConsent({ grantId: approved.grant.grantId }));
    const replay = net.submitCleanRoomComputation({
      requesterId: 'req_good',
      purpose: 'DEVICE_SIGNAL_RESEARCH',
      rightId: approved.right.rightId,
      approvedComputationId: computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
      jurisdiction: 'GB',
      presentedConsentHash: approved.grant.consentHash,
      cohortSize: 12,
    });
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.equal(replay.error.code, 'REVOKED_RIGHT');
    }
  });

  it('blocks requester impersonation', () => {
    const { net, computation, approved } = setup();
    const attack = net.submitCleanRoomComputation({
      requesterId: 'req_evil',
      purpose: 'DEVICE_SIGNAL_RESEARCH',
      rightId: approved.right.rightId,
      approvedComputationId: computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
      jurisdiction: 'GB',
      cohortSize: 12,
    });
    assert.equal(attack.ok, false);
    if (!attack.ok) {
      assert.equal(attack.error.code, 'REQUESTER_IMPERSONATION');
    }
  });

  it('blocks raw export requests', () => {
    const { net } = setup();
    const attack = net.exportRawPdv();
    assert.equal(attack.ok, false);
    if (!attack.ok) {
      assert.equal(attack.error.code, 'RAW_PDV_UNAVAILABLE');
    }
  });

  it('blocks arbitrary clean-room code', () => {
    const { net, computation, approved } = setup();
    const attack = net.submitCleanRoomComputation({
      requesterId: 'req_good',
      purpose: 'DEVICE_SIGNAL_RESEARCH',
      rightId: approved.right.rightId,
      approvedComputationId: computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
      jurisdiction: 'GB',
      arbitraryCode: 'SELECT * FROM vault',
      cohortSize: 12,
    });
    assert.equal(attack.ok, false);
    if (!attack.ok) {
      assert.equal(attack.error.code, 'ARBITRARY_CODE_FORBIDDEN');
    }
  });

  it('blocks small-cohort extraction', () => {
    const { net, computation, approved } = setup();
    const attack = net.submitCleanRoomComputation({
      requesterId: 'req_good',
      purpose: 'DEVICE_SIGNAL_RESEARCH',
      rightId: approved.right.rightId,
      approvedComputationId: computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
      jurisdiction: 'GB',
      cohortSize: 2,
    });
    assert.equal(attack.ok, false);
    if (!attack.ok) {
      assert.equal(attack.error.code, 'MIN_COHORT_NOT_MET');
    }
  });

  it('blocks repeated-query extraction', () => {
    const { net, computation, approved } = setup();
    const policy = defaultNetworkPolicy();
    for (let index = 0; index < policy.maxQueriesPerRequesterPurpose; index += 1) {
      unwrap(
        net.submitCleanRoomComputation({
          requesterId: 'req_good',
          purpose: 'DEVICE_SIGNAL_RESEARCH',
          rightId: approved.right.rightId,
          approvedComputationId: computation.computationId,
          outputClass: 'AGGREGATE_STATISTIC',
          expiresAt: EXPIRES,
          jurisdiction: 'GB',
          cohortSize: 12,
        }),
      );
    }
    const attack = net.submitCleanRoomComputation({
      requesterId: 'req_good',
      purpose: 'DEVICE_SIGNAL_RESEARCH',
      rightId: approved.right.rightId,
      approvedComputationId: computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
      jurisdiction: 'GB',
      cohortSize: 12,
    });
    assert.equal(attack.ok, false);
    if (!attack.ok) {
      assert.equal(attack.error.code, 'QUERY_ABUSE');
    }
  });

  it('blocks wrong subject mapping', () => {
    const { net, request, descriptor } = setup();
    const other = unwrap(net.registerSubject({ internalRef: 'other-person' }));
    const otherDescriptor = unwrap(
      net.registerDescriptor({
        subjectId: other.subjectId,
        category: 'DEVICE_ACTIVITY_SIGNALS',
        schema: 'device-v1',
        sourceClass: 'AUTHORIZED_CONNECTOR',
        freshness: 'P1D',
        sensitivityClass: 'PERSONAL',
        permittedComputationClasses: ['CLEAN_ROOM_COMPUTATION'],
      }),
    );
    const own = net.approveInformationConsent({
      requestId: request.requestId,
      subjectId: other.subjectId,
      descriptorId: otherDescriptor.descriptorId,
      processingClass: 'AGGREGATED_ANALYTICS',
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
    });
    assert.equal(own.ok, true);
    const mismatch = net.approveInformationConsent({
      requestId: request.requestId,
      subjectId: other.subjectId,
      descriptorId: descriptor.descriptorId,
      processingClass: 'AGGREGATED_ANALYTICS',
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
    });
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) {
      assert.equal(mismatch.error.code, 'WRONG_SUBJECT_MAPPING');
    }
  });

  it('blocks output tamper', () => {
    const { net, computation, approved } = setup();
    const job = unwrap(
      net.submitCleanRoomComputation({
        requesterId: 'req_good',
        purpose: 'DEVICE_SIGNAL_RESEARCH',
        rightId: approved.right.rightId,
        approvedComputationId: computation.computationId,
        outputClass: 'AGGREGATE_STATISTIC',
        expiresAt: EXPIRES,
        jurisdiction: 'GB',
        cohortSize: 12,
      }),
    );
    const attack = net.getCleanRoomResult({
      computationRequestId: job.computationRequestId,
      privacySafeValue: 'leaked-row',
      cohortSize: 12,
      tamperOutput: true,
    });
    assert.equal(attack.ok, false);
    if (!attack.ok) {
      assert.equal(attack.error.code, 'OUTPUT_TAMPER');
    }
  });

  it('blocks developer-scope and agent-scope escalation', () => {
    const { net, computation, approved, subject, descriptor } = setup();
    const developer = net.submitCleanRoomComputation({
      requesterId: 'req_good',
      purpose: 'DEVICE_SIGNAL_RESEARCH',
      rightId: approved.right.rightId,
      approvedComputationId: computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
      jurisdiction: 'GB',
      cohortSize: 12,
      developer: {
        credentialId: 'hin-key',
        applicationApproved: true,
        scopes: ['HUMAN_INFORMATION_CLEAN_ROOM'],
        purpose: 'DEVICE_SIGNAL_RESEARCH',
        consentPresent: true,
        privacyPolicyAccepted: true,
        eligibilitySatisfied: true,
      },
    });
    assert.equal(developer.ok, true);
    const chainOnly = net.submitInformationRequest({
      requesterId: 'req_good',
      requestedRight: 'ONE_TIME_COMPUTATION',
      purpose: 'DEVICE_SIGNAL_RESEARCH',
      duration: 'P7D',
      compensationAsset: 'APPROVED_FIAT',
      compensationMinor: 1n,
      jurisdiction: 'GB',
      developer: {
        credentialId: 'chain-key',
        applicationApproved: true,
        scopes: ['CHAIN_READ'],
        purpose: 'CHAIN_READ',
        consentPresent: true,
        privacyPolicyAccepted: true,
        eligibilitySatisfied: true,
      },
    });
    assert.equal(chainOnly.ok, false);
    const agent = net.approveInformationConsent({
      requestId: approved.grant.grantId as never,
      subjectId: subject.subjectId,
      descriptorId: descriptor.descriptorId,
      processingClass: 'AGGREGATED_ANALYTICS',
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
      agent: {
        mandateId: 'generic',
        explicitHumanInformationMandate: false,
        genericFinancialAgent: true,
      },
    });
    assert.equal(agent.ok, false);
  });

  it('refuses emergency controls that would grant broader access', () => {
    const { net } = setup();
    const restricted = unwrap(net.applyEmergencyRestriction());
    assert.equal(restricted.broaderAccessGranted, false);
    const later = net.submitInformationRequest({
      requesterId: 'req_good',
      requestedRight: 'ONE_TIME_COMPUTATION',
      purpose: 'DEVICE_SIGNAL_RESEARCH',
      duration: 'P7D',
      compensationAsset: 'APPROVED_FIAT',
      compensationMinor: 1n,
      jurisdiction: 'GB',
    });
    assert.equal(later.ok, false);
    if (!later.ok) {
      assert.equal(later.error.code, 'EMERGENCY_RESTRICTED');
    }
  });
});
