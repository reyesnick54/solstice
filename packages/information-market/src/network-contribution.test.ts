import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { createHinContributionAdapter } from './network/contribution/adapter.ts';
import {
  FORBIDDEN_REGISTRY_KEYS,
  INFORMATION_RIGHT_CONTRIBUTION,
  NON_HIN_CONTRIBUTION_CLASSES,
} from './network/contribution/index.ts';
import { createInMemoryDataAssetProjection } from './network/contribution/projection.ts';
import { createInProcessHumanContributionRegistry } from './network/contribution/registry.ts';
import { runHumanInformationContributionDemo } from './network/contribution/demo.ts';
import { HumanInformationNetworkEngine } from './network/engine.ts';
import { newUsageReceiptId } from './network/ids.ts';

const NOW = asUtcInstant('2026-08-19T07:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-19T07:00:00.000Z');

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

function provision(clock = new FrozenClock(NOW)) {
  const engine = new HumanInformationNetworkEngine({ clock });
  const registry = createInProcessHumanContributionRegistry();
  const dataAssetProjection = createInMemoryDataAssetProjection();
  const adapter = createHinContributionAdapter({ engine, registry, dataAssetProjection });
  const subject = unwrap(engine.registerSubject({ internalRef: 'synthetic-ada' }));
  const descriptor = unwrap(
    engine.registerDescriptor({
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
    engine.registerRequester({
      requesterId: 'req_lab',
      organization: 'Synthetic Lab',
      requesterClass: 'RESEARCH_INSTITUTION',
      jurisdiction: 'GB',
    }),
  );
  const computation = unwrap(
    engine.registerApprovedComputation({
      codeVersion: 'agg-v1',
      queryDefinition: 'AGGREGATE_MEAN',
      artifactDigest: 'sha256:agg',
      allowedOutputClasses: ['AGGREGATE_STATISTIC', 'BOOLEAN_ATTESTATION'],
    }),
  );
  const request = unwrap(
    engine.submitInformationRequest({
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
    engine.approveInformationConsent({
      requestId: request.requestId,
      subjectId: subject.subjectId,
      descriptorId: descriptor.descriptorId,
      processingClass: 'CLEAN_ROOM_COMPUTATION',
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
    }),
  );
  return { engine, adapter, registry, subject, descriptor, computation, request, approved, clock };
}

function realizeUse(net: ReturnType<typeof provision>, purpose = 'AGGREGATED_RESEARCH') {
  const job = unwrap(
    net.engine.submitCleanRoomComputation({
      requesterId: 'req_lab',
      purpose,
      rightId: net.approved.right.rightId,
      approvedComputationId: net.computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
      jurisdiction: 'GB',
      presentedConsentHash: net.approved.grant.consentHash,
      cohortSize: 12,
      outputRowCount: 1,
    }),
  );
  const result = unwrap(
    net.engine.getCleanRoomResult({
      computationRequestId: job.computationRequestId,
      privacySafeValue: 'activity_band=moderate',
      cohortSize: 12,
    }),
  );
  const compensation = unwrap(
    net.engine.authorizeCompensation({
      subjectId: net.subject.subjectId,
      requesterId: 'req_lab',
      asset: 'APPROVED_FIAT',
      amountMinor: 1000n,
    }),
  );
  const receipt = unwrap(
    net.engine.recordUsage({
      rightId: net.approved.right.rightId,
      requesterId: 'req_lab',
      computationId: net.computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      settlementRef: compensation.settlementRef,
    }),
  );
  return { job, result, compensation, receipt };
}

describe('Chunk 107 HIN contribution integration', () => {
  it('1. valid consented information use becomes a verified contribution', () => {
    const net = provision();
    const { receipt, compensation } = realizeUse(net);
    const recorded = unwrap(net.adapter.submitRealizedUse({ receiptId: receipt.receiptId }));
    assert.equal(recorded.contributionClass, INFORMATION_RIGHT_CONTRIBUTION);
    assert.equal(recorded.status, 'VERIFIED');
    assert.equal(recorded.evidence.usageReceiptId, receipt.receiptId);
    assert.equal(recorded.evidence.descriptorId, net.descriptor.descriptorId);
    assert.equal(recorded.evidence.rightId, net.approved.right.rightId);
    assert.equal(recorded.evidence.consentRef, net.approved.grant.consentHash);
    assert.equal(recorded.evidence.rawPersonalData, false);
    assert.equal(recorded.automaticSunReyMint, false);
    assert.equal(net.adapter.projection.byUsageReceiptId(receipt.receiptId), recorded.contributionId);
    assert.deepEqual(net.adapter.projection.byDescriptorId(net.descriptor.descriptorId), [recorded.contributionId]);
    unwrap(net.adapter.inspectCompensation(compensation.settlementRef));
  });

  it('2. data ownership alone does not create a contribution', () => {
    const net = provision();
    const attempt = net.adapter.attemptOwnershipContribution({ descriptorId: net.descriptor.descriptorId });
    assert.equal(attempt.ok, false);
    if (!attempt.ok) {
      assert.equal(attempt.error.code, 'OWNERSHIP_IS_NOT_CONTRIBUTION');
    }
  });

  it('3. consent alone does not create a contribution or issuance', () => {
    const net = provision();
    const attempt = net.adapter.attemptConsentContribution({ grantId: net.approved.grant.grantId });
    assert.equal(attempt.ok, false);
    if (!attempt.ok) {
      assert.equal(attempt.error.code, 'CONSENT_IS_NOT_CONTRIBUTION');
    }
  });

  it('4. missing usage receipt fails', () => {
    const net = provision();
    const attempt = net.adapter.submitRealizedUse({ receiptId: newUsageReceiptId() });
    assert.equal(attempt.ok, false);
    if (!attempt.ok) {
      assert.equal(attempt.error.code, 'USAGE_DID_NOT_OCCUR');
    }
  });

  it('5. revoked-before-use fails', () => {
    const net = provision();
    unwrap(net.engine.revokeInformationConsent({ grantId: net.approved.grant.grantId }));
    const usage = net.engine.recordUsage({
      rightId: net.approved.right.rightId,
      requesterId: 'req_lab',
      computationId: net.computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      settlementRef: null,
    });
    assert.equal(usage.ok, false);
    const plantedId = newUsageReceiptId();
    net.engine.store.receipts.set(plantedId, Object.freeze({
      receiptId: plantedId,
      rightId: net.approved.right.rightId,
      requesterId: 'req_lab',
      purpose: 'AGGREGATED_RESEARCH',
      computationId: net.computation.computationId,
      policyVersion: net.engine.policy.policyVersion,
      outputClass: 'AGGREGATE_STATISTIC',
      settlementRef: null,
      occurredAt: asUtcInstant('2026-08-19T08:00:00.000Z'),
      chainHeight: 0n,
      evidenceDigest: 'not-checked-yet',
      rawPersonalData: false,
    }));
    const attempt = net.adapter.submitRealizedUse({ receiptId: plantedId });
    assert.equal(attempt.ok, false);
    if (!attempt.ok) {
      assert.equal(attempt.error.code, 'RIGHT_REVOKED_BEFORE_USE');
    }
  });

  it('6. later revocation preserves the historical contribution record', () => {
    const net = provision();
    const { receipt } = realizeUse(net);
    const recorded = unwrap(net.adapter.submitRealizedUse({ receiptId: receipt.receiptId }));
    unwrap(net.engine.revokeInformationConsent({ grantId: net.approved.grant.grantId }));
    const historical = net.registry.getById(recorded.contributionId);
    assert.ok(historical);
    assert.equal(historical?.historicalRecordImmutable, true);
    assert.equal(historical?.evidence.usageReceiptId, receipt.receiptId);
    const blocked = net.engine.submitCleanRoomComputation({
      requesterId: 'req_lab',
      purpose: 'AGGREGATED_RESEARCH',
      rightId: net.approved.right.rightId,
      approvedComputationId: net.computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
      jurisdiction: 'GB',
      cohortSize: 12,
    });
    assert.equal(blocked.ok, false);
  });

  it('7. purpose mismatch fails', () => {
    const net = provision();
    const { receipt } = realizeUse(net);
    net.engine.store.receipts.set(receipt.receiptId, Object.freeze({ ...receipt, purpose: 'MODEL_TRAINING' }));
    const attempt = net.adapter.submitRealizedUse({ receiptId: receipt.receiptId });
    assert.equal(attempt.ok, false);
    if (!attempt.ok) {
      assert.equal(attempt.error.code, 'PURPOSE_MISMATCH');
    }
  });

  it('8. subject mismatch fails', () => {
    const net = provision();
    const other = unwrap(net.engine.registerSubject({ internalRef: 'synthetic-other' }));
    const { receipt } = realizeUse(net);
    const descriptor = net.engine.store.descriptors.get(net.descriptor.descriptorId);
    assert.ok(descriptor);
    net.engine.store.descriptors.set(descriptor.descriptorId, Object.freeze({ ...descriptor, subjectId: other.subjectId }));
    const attempt = net.adapter.submitRealizedUse({ receiptId: receipt.receiptId });
    assert.equal(attempt.ok, false);
    if (!attempt.ok) {
      assert.equal(attempt.error.code, 'DESCRIPTOR_SUBJECT_MISMATCH');
    }
  });

  it('9. raw data never appears in the registry', () => {
    const net = provision();
    const { receipt, result } = realizeUse(net);
    const recorded = unwrap(net.adapter.submitRealizedUse({ receiptId: receipt.receiptId }));
    const serialized = JSON.stringify(recorded);
    for (const key of FORBIDDEN_REGISTRY_KEYS) {
      assert.equal(serialized.includes(`"${key}"`), false, key);
    }
    assert.equal(serialized.includes('ada@example.com'), false);
    assert.equal(serialized.includes('111-22-3333'), false);
    assert.equal(serialized.includes(String(result.privacySafeValue)), false);
    assert.equal(recorded.evidence.rawPersonalData, false);
    assert.equal(recorded.rawPersonalDataOnRegistry, false);
    assert.equal(result.rawRows, false);
  });

  it('10. HIN compensation does not mint', () => {
    const net = provision();
    const { compensation } = realizeUse(net);
    assert.equal(compensation.mintRequested, false);
    assert.equal(compensation.unrestrictedIssuance, false);
    assert.equal(compensation.monetaryAuthority, 'CHUNK_71_MONETARY_CONSTITUTION');
    const mint = net.engine.authorizeCompensation({
      subjectId: net.subject.subjectId,
      requesterId: 'req_lab',
      asset: 'SUNREY_COIN',
      amountMinor: 1n,
      mintUnrestricted: true,
    });
    assert.equal(mint.ok, false);
    if (!mint.ok) {
      assert.equal(mint.error.code, 'MINT_FORBIDDEN');
    }
    unwrap(net.adapter.inspectCompensation(compensation.settlementRef));
  });

  it('11. duplicate usage receipt cannot create a duplicate contribution', () => {
    const net = provision();
    const { receipt } = realizeUse(net);
    unwrap(net.adapter.submitRealizedUse({ receiptId: receipt.receiptId }));
    const duplicate = net.adapter.submitRealizedUse({ receiptId: receipt.receiptId });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.equal(duplicate.error.code, 'DUPLICATE_USAGE_RECEIPT');
    }
  });

  it('12. same consent with distinct authorized uses can create distinct contributions', () => {
    const net = provision();
    const first = realizeUse(net);
    const firstRecord = unwrap(net.adapter.submitRealizedUse({ receiptId: first.receipt.receiptId }));
    const second = realizeUse(net);
    const secondRecord = unwrap(net.adapter.submitRealizedUse({ receiptId: second.receipt.receiptId }));
    assert.notEqual(first.receipt.receiptId, second.receipt.receiptId);
    assert.notEqual(firstRecord.contributionId, secondRecord.contributionId);
    assert.equal(firstRecord.evidence.consentRef, secondRecord.evidence.consentRef);
    assert.equal(net.adapter.projection.byDescriptorId(net.descriptor.descriptorId).length, 2);
  });

  it('13. clean-room output is privacy safe', () => {
    const net = provision();
    const { receipt, result } = realizeUse(net);
    assert.equal(result.rawRows, false);
    assert.equal(result.describesPersonWorth, false);
    const recorded = unwrap(net.adapter.submitRealizedUse({ receiptId: receipt.receiptId }));
    assert.equal(recorded.evidence.approvedComputationResultId, result.resultId);
    assert.equal(JSON.stringify(recorded).includes('sourceRows'), false);
    assert.equal(JSON.stringify(recorded).includes('rawRows":true'), false);
  });

  it('14. unauthorized scraping remains forbidden', () => {
    const net = provision();
    const scraped = net.engine.ingestScrapedSource();
    assert.equal(scraped.ok, false);
    const refused = net.adapter.refuseScrapedContribution();
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'SCRAPING_FORBIDDEN');
    }
  });

  it('expired-before-use and hash tamper fail closed', () => {
    const clock = new FrozenClock(NOW);
    const net = provision(clock);
    clock.set(asUtcInstant('2026-10-01T07:00:00.000Z'));
    const job = unwrap(
      net.engine.submitCleanRoomComputation({
        requesterId: 'req_lab',
        purpose: 'AGGREGATED_RESEARCH',
        rightId: net.approved.right.rightId,
        approvedComputationId: net.computation.computationId,
        outputClass: 'AGGREGATE_STATISTIC',
        expiresAt: EXPIRES,
        jurisdiction: 'GB',
        presentedConsentHash: net.approved.grant.consentHash,
        cohortSize: 12,
        outputRowCount: 1,
      }),
    );
    unwrap(
      net.engine.getCleanRoomResult({
        computationRequestId: job.computationRequestId,
        privacySafeValue: 'activity_band=moderate',
        cohortSize: 12,
      }),
    );
    const receipt = unwrap(
      net.engine.recordUsage({
        rightId: net.approved.right.rightId,
        requesterId: 'req_lab',
        computationId: net.computation.computationId,
        outputClass: 'AGGREGATE_STATISTIC',
        settlementRef: null,
      }),
    );
    const expired = net.adapter.submitRealizedUse({ receiptId: receipt.receiptId });
    assert.equal(expired.ok, false);
    if (!expired.ok) {
      assert.equal(expired.error.code, 'RIGHT_EXPIRED_BEFORE_USE');
    }

    const live = provision();
    const used = realizeUse(live);
    live.engine.store.receipts.set(used.receipt.receiptId, Object.freeze({ ...used.receipt, evidenceDigest: 'tampered' }));
    const tampered = live.adapter.submitRealizedUse({ receiptId: used.receipt.receiptId });
    assert.equal(tampered.ok, false);
    if (!tampered.ok) {
      assert.equal(tampered.error.code, 'EVIDENCE_HASH_TAMPERED');
    }

    const forbidden = provision();
    const forbiddenUse = realizeUse(forbidden);
    forbidden.engine.store.receipts.set(
      forbiddenUse.receipt.receiptId,
      Object.freeze({ ...forbiddenUse.receipt, outputClass: 'MODEL_UPDATE_ARTIFACT' }),
    );
    const output = forbidden.adapter.submitRealizedUse({ receiptId: forbiddenUse.receipt.receiptId });
    assert.equal(output.ok, false);
    if (!output.ok) {
      assert.equal(output.error.code, 'OUTPUT_CLASS_FORBIDDEN');
    }
  });

  it('does not force non-information contribution classes through HIN', () => {
    assert.ok(NON_HIN_CONTRIBUTION_CLASSES.includes('CREATIVE_PRODUCTION'));
    assert.equal(NON_HIN_CONTRIBUTION_CLASSES.includes(INFORMATION_RIGHT_CONTRIBUTION as never), false);
  });

  it('runs the contribution demo without minting or storing raw personal data', () => {
    const result = runHumanInformationContributionDemo();
    assert.equal(result.RAW_PERSONAL_DATA_ON_REGISTRY, false);
    assert.equal(result.AUTOMATIC_SUNREY_MINT, false);
    assert.equal(result.canonicalRegistryEntry, true);
    assert.equal(result.futureUseBlocked, true);
    assert.equal(result.productionActivated, false);
  });
});
