import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { HumanContributionMonetaryBridge } from '../../sunrey-chain/src/economics/human-contribution-bridge/index.ts';
import { emptyBook } from '../../sunrey-chain/src/economics/supply.ts';
import { INFORMATION_COMMANDS, runInformationCommand } from './network/cli.ts';
import { runHumanInformationNetworkDemo } from './network/demo.ts';
import { HumanInformationNetworkEngine } from './network/engine.ts';
import { NETWORK_LEGAL_STATUS, RAW_EXPORT_POLICY } from './network/taxonomy.ts';

const NOW = asUtcInstant('2026-08-18T14:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-18T14:00:00.000Z');

function engine(): HumanInformationNetworkEngine {
  return new HumanInformationNetworkEngine({ clock: new FrozenClock(NOW) });
}

function provision(net: HumanInformationNetworkEngine) {
  const subject = unwrap(net.registerSubject({ internalRef: 'synthetic-ada' }));
  const descriptor = unwrap(
    net.registerDescriptor({
      subjectId: subject.subjectId,
      category: 'FINANCIAL_ACTIVITY_METADATA',
      schema: 'activity-metadata-v1',
      sourceClass: 'PERSONAL_DATA_VAULT',
      freshness: 'P30D',
      sensitivityClass: 'SENSITIVE',
      permittedComputationClasses: ['CLEAN_ROOM_COMPUTATION'],
    }),
  );
  unwrap(
    net.registerRequester({
      requesterId: 'req_lab',
      organization: 'Synthetic Lab',
      requesterClass: 'RESEARCH_INSTITUTION',
      jurisdiction: 'GB',
    }),
  );
  const computation = unwrap(
    net.registerApprovedComputation({
      codeVersion: 'agg-v1',
      queryDefinition: 'AGGREGATE_MEAN',
      artifactDigest: 'sha256:agg',
      allowedOutputClasses: ['AGGREGATE_STATISTIC', 'BOOLEAN_ATTESTATION'],
    }),
  );
  const request = unwrap(
    net.submitInformationRequest({
      requesterId: 'req_lab',
      requestedRight: 'ONE_TIME_COMPUTATION',
      purpose: 'AGGREGATED_RESEARCH',
      computationId: computation.computationId,
      duration: 'P30D',
      compensationAsset: 'APPROVED_FIAT',
      compensationMinor: 1000n,
      jurisdiction: 'GB',
    }),
  );
  const approved = unwrap(
    net.approveInformationConsent({
      requestId: request.requestId,
      subjectId: subject.subjectId,
      descriptorId: descriptor.descriptorId,
      processingClass: 'CLEAN_ROOM_COMPUTATION',
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
    }),
  );
  return { subject, descriptor, computation, request, approved };
}

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

describe('Chunk 100 Human Information Network', () => {
  it('runs the synthetic production-candidate demo', () => {
    const result = runHumanInformationNetworkDemo();
    assert.equal(result.syntheticData, true);
    assert.equal(result.rawPersonalDataExported, false);
    assert.equal(result.productionActivated, false);
    assert.equal(result.humanWorthScore, false);
    assert.equal(result.consented, true);
    assert.equal(result.revoked, true);
    assert.equal(result.historicalSettlementRetained, true);
  });

  it('keeps subjects privacy-preserving and descriptors free of raw content', () => {
    const net = engine();
    const subject = unwrap(net.registerSubject({ internalRef: 'Ada Lovelace' }));
    assert.equal(subject.legalNameExposed, false);
    assert.equal(subject.rawIdentityExposed, false);
    assert.equal(subject.publicHandle.startsWith('subject_'), true);
    const denied = net.registerDescriptor({
      subjectId: subject.subjectId,
      category: 'HEALTH_WELLNESS',
      schema: 'health-v1',
      sourceClass: 'PERSONAL_DATA_VAULT',
      freshness: 'P1D',
      sensitivityClass: 'HIGHLY_SENSITIVE',
      permittedComputationClasses: ['CLEAN_ROOM_COMPUTATION'],
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'CATEGORY_DEFAULT_DENY');
    }
  });

  it('does not enable a right merely because it is enumerated', () => {
    const net = engine();
    const { subject } = provision(net);
    const offer = net.registerOffer({
      subjectId: subject.subjectId,
      rightType: 'MODEL_TRAINING_PERMISSION',
      purposeClasses: ['MODEL_TRAINING'],
      requesterClasses: ['APPROVED_AI_DEVELOPER'],
      compensationRequired: true,
      validUntil: EXPIRES,
      privacyRequirements: ['NO_RAW_EXPORT'],
    });
    assert.equal(offer.ok, false);
    if (!offer.ok) {
      assert.equal(offer.error.code, 'RIGHT_TYPE_NOT_ENABLED');
    }
  });

  it('rejects generic any-future-purpose access', () => {
    const net = engine();
    provision(net);
    const request = net.submitInformationRequest({
      requesterId: 'req_lab',
      requestedRight: 'ONE_TIME_COMPUTATION',
      purpose: 'ANY_FUTURE_PURPOSE',
      duration: 'P365D',
      compensationAsset: 'SUNREY_COIN',
      compensationMinor: 1n,
      jurisdiction: 'GB',
    });
    assert.equal(request.ok, false);
    if (!request.ok) {
      assert.equal(request.error.code, 'PURPOSE_TOO_BROAD');
    }
  });

  it('evaluates Exchange HUMAN_INFORMATION_RIGHT eligibility before match', () => {
    const net = engine();
    const { request, approved } = provision(net);
    const eligibility = unwrap(
      net.evaluateInformationEligibility({ requestId: request.requestId, rightId: approved.right.rightId }),
    );
    assert.equal(eligibility.eligible, true);
    assert.equal(net.exportRawPdv().ok, false);
  });

  it('prefers clean-room computation and issues a usage receipt without raw data', () => {
    const net = engine();
    const { subject, computation, approved } = provision(net);
    const job = unwrap(
      net.submitCleanRoomComputation({
        requesterId: 'req_lab',
        purpose: 'AGGREGATED_RESEARCH',
        rightId: approved.right.rightId,
        approvedComputationId: computation.computationId,
        outputClass: 'AGGREGATE_STATISTIC',
        expiresAt: EXPIRES,
        jurisdiction: 'GB',
        presentedConsentHash: approved.grant.consentHash,
        cohortSize: 12,
      }),
    );
    const result = unwrap(
      net.getCleanRoomResult({
        computationRequestId: job.computationRequestId,
        privacySafeValue: 42,
        cohortSize: 12,
      }),
    );
    assert.equal(result.rawRows, false);
    assert.equal(result.describesPersonWorth, false);
    const compensation = unwrap(
      net.authorizeCompensation({
        subjectId: subject.subjectId,
        requesterId: 'req_lab',
        asset: 'APPROVED_FIAT',
        amountMinor: 1000n,
      }),
    );
    const receipt = unwrap(
      net.recordUsage({
        rightId: approved.right.rightId,
        requesterId: 'req_lab',
        computationId: computation.computationId,
        outputClass: 'AGGREGATE_STATISTIC',
        settlementRef: compensation.settlementRef,
      }),
    );
    assert.equal(receipt.rawPersonalData, false);
    assert.equal(net.policy.rawExportPolicy, RAW_EXPORT_POLICY);
    const center = unwrap(net.controlCenter(subject.subjectId));
    assert.equal(center.usageHistory.length, 1);
    const portal = unwrap(net.requesterPortal('req_lab'));
    assert.equal(portal.results.length, 1);
  });

  it('revokes future use without erasing historical settlement', () => {
    const net = engine();
    const { approved } = provision(net);
    const revocation = unwrap(net.revokeInformationConsent({ grantId: approved.grant.grantId }));
    assert.equal(revocation.futureUseBlocked, true);
    assert.equal(revocation.historicalSettlementErased, false);
  });

  it('exposes CLI commands and a production-gated status', () => {
    const net = engine();
    assert.deepEqual([...INFORMATION_COMMANDS], [
      'rights',
      'requests',
      'consent',
      'revoke',
      'usage',
      'compensation',
      'clean-room',
      'audit',
      'requester',
      'status',
    ]);
    const status = runInformationCommand(net, ['status']);
    assert.equal(status.ok, true);
    const payload = status.payload as { readonly productionActivated: false };
    assert.equal(payload.productionActivated, false);
    assert.equal(net.productionActivation().productionActivated, false);
    assert.equal(NETWORK_LEGAL_STATUS.counselConfirmed, false);
  });

  it('projects privacy-minimized mobile events', () => {
    const net = engine();
    provision(net);
    assert.ok(net.notifications.length > 0);
    for (const notification of net.notifications) {
      assert.equal(notification.rawPayload, false);
      assert.equal(notification.legalName, false);
    }
  });

  it('treats provider availability as non-authority and forbids scraping', () => {
    const net = engine();
    assert.deepEqual(net.providerAvailabilityIsNotAuthority(), { available: true, authority: false });
    assert.equal(net.ingestScrapedSource().ok, false);
  });

  it('cannot mint SunRey from HIN consent, usage receipt, or clean-room result alone', () => {
    const net = engine();
    const { subject, computation, approved } = provision(net);
    const job = unwrap(
      net.submitCleanRoomComputation({
        requesterId: 'req_lab',
        purpose: 'AGGREGATED_RESEARCH',
        rightId: approved.right.rightId,
        approvedComputationId: computation.computationId,
        outputClass: 'AGGREGATE_STATISTIC',
        expiresAt: EXPIRES,
        jurisdiction: 'GB',
        presentedConsentHash: approved.grant.consentHash,
        cohortSize: 12,
      }),
    );
    unwrap(
      net.getCleanRoomResult({
        computationRequestId: job.computationRequestId,
        privacySafeValue: 42,
        cohortSize: 12,
      }),
    );
    const receipt = unwrap(
      net.recordUsage({
        rightId: approved.right.rightId,
        requesterId: 'req_lab',
        computationId: computation.computationId,
        outputClass: 'AGGREGATE_STATISTIC',
        settlementRef: null,
      }),
    );
    const bridge = new HumanContributionMonetaryBridge();
    const book = emptyBook('SUNREY_COIN', 'sunrey.monetary.constitution.v1');
    const consent = bridge.attempt(
      { recipient: subject.publicHandle, standalone: { kind: 'HIN_CONSENT', consentRef: approved.grant.grantId } },
      book,
    );
    assert.equal(consent.ok, false);
    if (!consent.ok) {
      assert.equal(consent.code, 'HIN_CONSENT_ALONE_CANNOT_ISSUE');
    }
    const usage = bridge.attempt(
      { recipient: subject.publicHandle, standalone: { kind: 'HIN_USAGE_RECEIPT', receiptId: receipt.receiptId } },
      book,
    );
    assert.equal(usage.ok, false);
    if (!usage.ok) {
      assert.equal(usage.code, 'HIN_USAGE_RECEIPT_ALONE_CANNOT_ISSUE');
    }
    const cleanRoom = bridge.attempt(
      {
        recipient: subject.publicHandle,
        standalone: { kind: 'CLEAN_ROOM_RESULT', resultId: job.computationRequestId },
      },
      book,
    );
    assert.equal(cleanRoom.ok, false);
    if (!cleanRoom.ok) {
      assert.equal(cleanRoom.code, 'CLEAN_ROOM_RESULT_ALONE_CANNOT_ISSUE');
    }
  });
});
