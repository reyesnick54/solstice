import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_CRYPTO_ENABLED, LIVE_DATA_MARKET_ENABLED, LIVE_MONEY_ENABLED } from '../../config/src/flags.ts';
import { EconomicAssetRegistry } from '../../economic-asset-registry/src/index.ts';
import { createHumanInformationAnchorCoordinator } from './network/chain-anchor/coordinator.ts';
import { runHumanInformationChainFinalityDemo } from './network/chain-anchor/finality-demo.ts';
import { provisionHinChainAnchorFixture, realizeHinUse, unwrapAnchor } from './network/chain-anchor/fixtures.ts';
import {
  CHAIN_FINALITY_IS_NOT_LEGAL_CONSENT_AUTHORITY,
  HIN_ANCHOR_INVARIANTS,
} from './network/chain-anchor/invariants.ts';
import { scheduleSettlementAnchor } from './network/chain-anchor/schedule.ts';
import { createHinContributionAdapter } from './network/contribution/index.ts';
import { createHinEconomicAssetAdapter } from './network/economic-asset-adapter.ts';

const SRC = join(import.meta.dirname, 'network', 'chain-anchor');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (full.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

function stack() {
  const net = provisionHinChainAnchorFixture();
  const assetRegistry = new EconomicAssetRegistry();
  const coordinator = createHumanInformationAnchorCoordinator({
    port: net.adapter,
    adapter: net.adapter,
    clock: net.clock,
    registry: assetRegistry,
  });
  net.engine.attachAnchorCoordinator(coordinator);
  return { ...net, coordinator, assetRegistry };
}

function finalizeOn(
  net: ReturnType<typeof stack>,
  kind: 'CONSENT_GRANT' | 'USAGE_RECEIPT' | 'CONSENT_REVOCATION' | 'HUMAN_CONTRIBUTION_PROOF' | 'INFORMATION_RIGHT_STATE',
  sourceRecordId: string,
  extra?: { contributionId?: string; requesterId?: string },
) {
  const prepared = unwrapAnchor(
    net.coordinator.prepare({
      kind,
      sourceRecordId,
      contributionId: extra?.contributionId,
      requesterId: extra?.requesterId ?? 'req_lab',
      subjectHandle: net.subject.publicHandle,
    }),
  );
  unwrapAnchor(net.coordinator.submit(prepared.anchorId));
  net.coordinator.advanceSimulatedFinality();
  return unwrapAnchor(net.coordinator.refreshFinality(prepared.anchorId));
}

describe('Chunk 140 HIN chain-anchor finality and reconciliation', () => {
  it('1-5. submits and finalizes consent, usage, contribution, and revocation anchors', () => {
    const net = stack();
    const consent = finalizeOn(net, 'CONSENT_GRANT', net.approved.grant.grantId);
    assert.equal(consent.kind, 'CONSENT_GRANT');
    assert.equal(consent.finalized, true);
    assert.equal(consent.chainState, 'FINALIZED');
    assert.ok(consent.transactionId);
    assert.ok(consent.receiptId);
    assert.ok(consent.blockReference);
    assert.ok(consent.confirmations > 0);
    assert.ok(consent.payloadCommitment);

    const { receipt } = realizeHinUse(net);
    const usage = finalizeOn(net, 'USAGE_RECEIPT', receipt.receiptId);
    assert.equal(usage.finalized, true);
    assert.equal(net.coordinator.store.usageProjections.get(receipt.receiptId)?.finalized, true);
    assert.equal(receipt.chainHeight, 0n);

    const recorded = unwrapAnchor(
      createHinContributionAdapter({
        engine: net.engine,
        registry: net.registry,
        anchorCoordinator: net.coordinator,
      }).submitRealizedUse({ receiptId: receipt.receiptId }),
    );
    const contribution = finalizeOn(net, 'HUMAN_CONTRIBUTION_PROOF', recorded.contributionId, {
      contributionId: recorded.contributionId,
    });
    assert.equal(contribution.recordType, 'PROOF_OF_CONTRIBUTION');
    assert.equal(contribution.mintsAsset, false);

    const revocation = unwrapAnchor(net.engine.revokeInformationConsent({ grantId: net.approved.grant.grantId }));
    const revoked = finalizeOn(net, 'CONSENT_REVOCATION', revocation.revocationId);
    assert.equal(revoked.finalized, true);
    assert.equal(net.coordinator.store.consentProjections.get(net.approved.grant.grantId)?.projectedActive, false);
    assert.equal(net.coordinator.store.revocationProjections.get(revocation.revocationId)?.historicalConsentAnchorImmutable, true);
  });

  it('6-7. revocation blocks future use before finality and outage does not reactivate consent', () => {
    const net = stack();
    const revocation = unwrapAnchor(net.engine.revokeInformationConsent({ grantId: net.approved.grant.grantId }));
    assert.equal(revocation.futureUseBlocked, true);
    const blocked = net.engine.submitCleanRoomComputation({
      requesterId: 'req_lab',
      purpose: 'AGGREGATED_RESEARCH',
      rightId: net.approved.right.rightId,
      approvedComputationId: net.computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: net.approved.right.expiresAt,
      jurisdiction: 'GB',
      presentedConsentHash: net.approved.grant.consentHash,
      cohortSize: 12,
      outputRowCount: 1,
    });
    assert.equal(blocked.ok, false);
    net.coordinator.setChainUnavailable(true);
    const stillBlocked = net.engine.submitCleanRoomComputation({
      requesterId: 'req_lab',
      purpose: 'AGGREGATED_RESEARCH',
      rightId: net.approved.right.rightId,
      approvedComputationId: net.computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: net.approved.right.expiresAt,
      jurisdiction: 'GB',
      presentedConsentHash: net.approved.grant.consentHash,
      cohortSize: 12,
      outputRowCount: 1,
    });
    assert.equal(stillBlocked.ok, false);
    assert.equal(net.engine.store.grants.get(net.approved.grant.grantId)?.status, 'REVOKED');
    assert.equal(CHAIN_FINALITY_IS_NOT_LEGAL_CONSENT_AUTHORITY, true);
    assert.equal(HIN_ANCHOR_INVARIANTS.REVOCATION_REQUIRES_CHAIN_TO_BLOCK_FUTURE_USE, false);
  });

  it('8/11. duplicate retry is idempotent and finalized retry returns the same anchor', () => {
    const net = stack();
    const first = unwrapAnchor(
      net.coordinator.prepare({
        kind: 'CONSENT_GRANT',
        sourceRecordId: net.approved.grant.grantId,
        requesterId: 'req_lab',
        subjectHandle: net.subject.publicHandle,
      }),
    );
    const second = unwrapAnchor(
      net.coordinator.prepare({
        kind: 'CONSENT_GRANT',
        sourceRecordId: net.approved.grant.grantId,
        requesterId: 'req_lab',
        subjectHandle: net.subject.publicHandle,
      }),
    );
    assert.equal(first.anchorId, second.anchorId);
    unwrapAnchor(net.coordinator.submit(first.anchorId));
    net.coordinator.advanceSimulatedFinality();
    const finalized = unwrapAnchor(net.coordinator.refreshFinality(first.anchorId));
    const retried = unwrapAnchor(net.coordinator.submit(first.anchorId));
    assert.equal(retried.anchorId, finalized.anchorId);
    assert.equal(retried.finalized, true);
    assert.equal(net.adapter.listAnchors().length, 1);
  });

  it('9-10. UNKNOWN requires reconciliation and does not blindly resubmit', () => {
    const net = stack();
    const prepared = unwrapAnchor(
      net.coordinator.prepare({
        kind: 'CONSENT_GRANT',
        sourceRecordId: net.approved.grant.grantId,
        requesterId: 'req_lab',
        subjectHandle: net.subject.publicHandle,
      }),
    );
    net.coordinator.setUnknownNext(true);
    const unknown = net.coordinator.submit(prepared.anchorId);
    assert.equal(unknown.ok, false);
    if (!unknown.ok) {
      assert.equal(unknown.error.code, 'HIN_ANCHOR_RECONCILIATION_REQUIRED');
    }
    const retry = net.coordinator.submit(prepared.anchorId);
    assert.equal(retry.ok, false);
    if (!retry.ok) {
      assert.equal(retry.error.code, 'HIN_ANCHOR_RECONCILIATION_REQUIRED');
    }
    assert.equal(net.adapter.listAnchors().length, 1);
    const recon = unwrapAnchor(net.coordinator.reconcile(prepared.anchorId));
    assert.equal(recon.chainOutcome, 'SUBMISSION_UNKNOWN');
    assert.equal(recon.hinOutcome, 'REVIEW_REQUIRED');
    assert.equal(recon.autoFixed, false);
  });

  it('12-13. reorg preserves HIN history and requires review', () => {
    const net = stack();
    const consent = finalizeOn(net, 'CONSENT_GRANT', net.approved.grant.grantId);
    const grant = net.engine.store.grants.get(net.approved.grant.grantId);
    assert.equal(grant?.status, 'ACTIVE');
    const observed = net.coordinator.observeReorg(consent.anchorId);
    assert.equal(observed.ok, false);
    if (!observed.ok) {
      assert.equal(observed.error.code, 'HIN_ANCHOR_REORG_OBSERVED');
    }
    const after = net.coordinator.store.findBySource('CONSENT_GRANT', net.approved.grant.grantId);
    assert.equal(after?.reorgObserved, true);
    assert.equal(after?.schedule, 'REVIEW');
    assert.equal(net.engine.store.grants.get(net.approved.grant.grantId)?.status, 'ACTIVE');
    assert.equal(net.engine.store.grants.get(net.approved.grant.grantId)?.consentHash, grant?.consentHash);
  });

  it('14-17. reconciliation maps hash mismatch, missing records, and MATCHED without auto-fix', () => {
    const net = stack();
    const consent = finalizeOn(net, 'CONSENT_GRANT', net.approved.grant.grantId);
    const matched = unwrapAnchor(net.coordinator.reconcile(consent.anchorId));
    assert.equal(matched.hinOutcome, 'MATCHED');
    assert.equal(matched.autoFixed, false);

    const simReceipts = (net.chain.simulationAdapter as unknown as {
      receipts: Map<string, { readonly receiptId: string; readonly payloadCommitment: string }>;
    }).receipts;
    const receipt = consent.receiptId ? simReceipts.get(consent.receiptId) : undefined;
    if (receipt) {
      simReceipts.set(receipt.receiptId, Object.freeze({ ...receipt, payloadCommitment: 'tampered-commitment' }));
    }
    const mismatch = unwrapAnchor(net.coordinator.reconcile(consent.anchorId));
    assert.equal(mismatch.chainOutcome, 'HASH_MISMATCH');
    assert.equal(mismatch.hinOutcome, 'REVIEW_REQUIRED');
    assert.equal(mismatch.autoFixed, false);
    assert.equal(consent.payloadCommitment === 'tampered-commitment', false);

    const submittedOnly = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'PURPOSE_GRANT',
        sourceRecordId: net.approved.right.purposeGrantId,
      }),
    );
    unwrapAnchor(net.adapter.submitAnchor(submittedOnly.anchorId));
    const byOperation = (net.chain.simulationAdapter as unknown as { byOperation: Map<string, unknown> }).byOperation;
    if (submittedOnly.operationId) {
      byOperation.delete(submittedOnly.operationId);
    }
    const remembered = net.coordinator.prepare({
      kind: 'PURPOSE_GRANT',
      sourceRecordId: net.approved.right.purposeGrantId,
      requesterId: 'req_lab',
      subjectHandle: net.subject.publicHandle,
    });
    if (remembered.ok && remembered.value.operationId) {
      const missingChain = unwrapAnchor(net.coordinator.reconcile(remembered.value.anchorId));
      assert.equal(missingChain.chainOutcome, 'MISSING_CHAIN_RECORD');
      assert.equal(missingChain.hinOutcome, 'FAILED');
      assert.equal(missingChain.autoFixed, false);
    }

    const orphan = net.coordinator.reconcileOperation('chop_missing_internal' as never);
    assert.equal(orphan.ok, true);
    if (orphan.ok) {
      assert.equal(orphan.value.chainOutcome, 'MISSING_INTERNAL_RECORD');
      assert.equal(orphan.value.hinOutcome, 'FAILED');
      assert.equal(orphan.value.autoFixed, false);
    }

    const adapterOnly = unwrapAnchor(
      net.adapter.createAnchorIntent({
        kind: 'INFORMATION_RIGHT_STATE',
        sourceRecordId: net.approved.right.rightId,
      }),
    );
    unwrapAnchor(net.adapter.submitAnchor(adapterOnly.anchorId));
    const missingHin = unwrapAnchor(net.coordinator.reconcileOperation(adapterOnly.operationId!));
    assert.equal(missingHin.chainOutcome, 'MISSING_INTERNAL_RECORD');
    assert.equal(missingHin.hinOutcome, 'FAILED');
  });

  it('18-19. Economic Asset Registry receives finalized metadata and is not independently verified', () => {
    const net = stack();
    const assets = createHinEconomicAssetAdapter(net.assetRegistry);
    const projected = unwrapAnchor(
      assets.projectInformationRight({
        right: net.approved.right,
        descriptor: net.descriptor,
        subject: net.subject,
        consent: net.approved.grant,
        at: net.clock.now(),
      }),
    );
    assert.notEqual(projected.status, 'VERIFIED');
    const rightAnchor = finalizeOn(net, 'INFORMATION_RIGHT_STATE', net.approved.right.rightId);
    net.coordinator.project(rightAnchor.anchorId);
    const updated = net.assetRegistry.findBySourceRecord('packages/information-market', net.approved.right.rightId);
    assert.ok(updated?.chainAnchor);
    assert.equal(updated?.chainAnchor?.finalityState, 'FINALIZED_ON_SIMULATION');
    assert.ok(updated?.chainAnchor?.transactionId);
    assert.notEqual(updated?.status, 'VERIFIED');
    assert.equal(projected.status === 'VERIFIED', false);
  });

  it('20-21. Control Center hides raw subject IDs and requester cannot see unrelated anchors', () => {
    const net = stack();
    finalizeOn(net, 'CONSENT_GRANT', net.approved.grant.grantId);
    const center = unwrapAnchor(net.engine.controlCenter(net.subject.subjectId));
    assert.equal(center.subjectHandle, net.subject.publicHandle);
    assert.equal(JSON.stringify(center).includes(net.subject.internalRef), false);
    assert.equal(JSON.stringify(center).includes('synthetic-ada'), false);
    assert.ok(center.consentAnchorStatus);
    unwrapAnchor(
      net.engine.registerRequester({
        requesterId: 'req_other',
        organization: 'Other Lab',
        requesterClass: 'RESEARCH_INSTITUTION',
        jurisdiction: 'GB',
      }),
    );
    const other = unwrapAnchor(net.engine.requesterPortal('req_other'));
    assert.equal(other.authorizedAnchorStatuses.length, 0);
    const own = unwrapAnchor(net.engine.requesterPortal('req_lab'));
    assert.ok(own.authorizedAnchorStatuses.length > 0);
    assert.equal(own.authorizedAnchorStatuses.every((row) => row.sourceRecordId !== net.subject.internalRef), true);
  });

  it('22-23. contribution anchors cannot mint and settlement anchors cannot alter the ledger', () => {
    const net = stack();
    const { receipt, compensation } = realizeHinUse(net);
    const recorded = unwrapAnchor(net.contribution.submitRealizedUse({ receiptId: receipt.receiptId }));
    const contribution = finalizeOn(net, 'HUMAN_CONTRIBUTION_PROOF', recorded.contributionId, {
      contributionId: recorded.contributionId,
    });
    assert.equal(contribution.mintsAsset, false);
    assert.equal(contribution.altersLedger, false);
    const settlement = unwrapAnchor(
      scheduleSettlementAnchor(net.coordinator, {
        sourceRecordId: compensation.instructionId,
        canonicalSettlement: {
          journalId: 'jrn_canonical_settlement',
          transferId: 'xfer_canonical_settlement',
          assetCommitment: 'cmt_canonical_settlement',
        },
        subjectHandle: net.subject.publicHandle,
        requesterId: 'req_lab',
      }),
    );
    assert.equal(settlement.altersLedger, false);
    assert.equal(settlement.mintsAsset, false);
    assert.equal(net.adapter.getIntent(settlement.anchorId)?.schema.fields.chainBalanceAuthoritative, false);
  });

  it('24-26. no raw personal data, no real network call, production remains disabled', () => {
    const net = stack();
    const consent = finalizeOn(net, 'CONSENT_GRANT', net.approved.grant.grantId);
    const intent = net.adapter.getIntent(consent.anchorId);
    const material = JSON.stringify({
      intent,
      receipt: consent.receiptId
        ? (net.chain as unknown as { store: { receipts: Map<string, unknown> } }).store.receipts.get(consent.receiptId)
        : null,
    });
    assert.equal(material.includes(net.subject.internalRef), false);
    assert.equal(material.includes('Ada'), false);
    assert.equal(material.includes('@'), false);
    assert.equal(consent.rawPersonalData, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
    assert.equal(net.engine.policy.productionActivated, false);
    assert.equal(HIN_ANCHOR_INVARIANTS.PRODUCTION_ACTIVE, false);
    for (const file of walk(SRC)) {
      if (file.endsWith('.test.ts') || file.endsWith('demo.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/https?:\/\//.test(source), false, file);
      if (!file.endsWith('adapter.ts')) {
        assert.equal(source.includes('SimulationChainAdapter'), false, file);
      }
    }
    const demo = runHumanInformationChainFinalityDemo();
    assert.equal(demo.CONSENT_SOURCE_OF_TRUTH, 'HIN');
    assert.equal(demo.CHAIN_ANCHOR_IS_EVIDENCE, true);
    assert.equal(demo.REVOCATION_REQUIRES_CHAIN_TO_BLOCK_FUTURE_USE, false);
    assert.ok(demo.FINALIZED_ANCHORS >= 3);
    assert.equal(demo.RAW_PERSONAL_DATA_ON_CHAIN, false);
    assert.equal(demo.ANCHOR_MINTS_ASSET, false);
    assert.equal(demo.PRODUCTION_ACTIVE, false);
  });
});
