import { EconomicAssetRegistry } from '../../../../economic-asset-registry/src/index.ts';
import { createHumanInformationAnchorCoordinator } from './coordinator.ts';
import { provisionHinChainAnchorFixture, realizeHinUse, unwrapAnchor } from './fixtures.ts';
import {
  CHAIN_ANCHOR_IS_EVIDENCE,
  CONSENT_SOURCE_OF_TRUTH,
  PRODUCTION_ACTIVE,
  RAW_PERSONAL_DATA_ON_CHAIN,
  REVOCATION_REQUIRES_CHAIN_TO_BLOCK_FUTURE_USE,
} from './invariants.ts';

export type HumanInformationChainFinalityDemoResult = {
  readonly CONSENT_SOURCE_OF_TRUTH: 'HIN';
  readonly CHAIN_ANCHOR_IS_EVIDENCE: true;
  readonly REVOCATION_REQUIRES_CHAIN_TO_BLOCK_FUTURE_USE: false;
  readonly FINALIZED_ANCHORS: number;
  readonly RAW_PERSONAL_DATA_ON_CHAIN: false;
  readonly ANCHOR_MINTS_ASSET: false;
  readonly PRODUCTION_ACTIVE: false;
};

export function runHumanInformationChainFinalityDemo(): HumanInformationChainFinalityDemoResult {
  const net = provisionHinChainAnchorFixture();
  const coordinator = createHumanInformationAnchorCoordinator({
    port: net.adapter,
    adapter: net.adapter,
    clock: net.clock,
    registry: new EconomicAssetRegistry(),
  });
  net.engine.attachAnchorCoordinator(coordinator);

  const consent = unwrapAnchor(
    coordinator.prepare({
      kind: 'CONSENT_GRANT',
      sourceRecordId: net.approved.grant.grantId,
      requesterId: net.approved.grant.requesterId,
      subjectHandle: net.subject.publicHandle,
    }),
  );
  unwrapAnchor(coordinator.submit(consent.anchorId));
  coordinator.advanceSimulatedFinality();
  const finalizedConsent = unwrapAnchor(coordinator.refreshFinality(consent.anchorId));
  if (!finalizedConsent.finalized || finalizedConsent.chainState !== 'FINALIZED') {
    throw new Error('consent anchor must wait for existing SunRey Chain finality');
  }

  const realized = realizeHinUse(net);
  const usage = unwrapAnchor(
    coordinator.prepare({
      kind: 'USAGE_RECEIPT',
      sourceRecordId: realized.receipt.receiptId,
      requesterId: realized.receipt.requesterId,
      subjectHandle: net.subject.publicHandle,
    }),
  );
  unwrapAnchor(coordinator.submit(usage.anchorId));
  coordinator.advanceSimulatedFinality();
  unwrapAnchor(coordinator.refreshFinality(usage.anchorId));

  const revocation = unwrapAnchor(net.engine.revokeInformationConsent({ grantId: net.approved.grant.grantId }));
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
  if (blocked.ok) {
    throw new Error('revocation must block future HIN use before chain finality');
  }
  const revocationAnchor = unwrapAnchor(
    coordinator.prepare({
      kind: 'CONSENT_REVOCATION',
      sourceRecordId: revocation.revocationId,
      requesterId: net.approved.grant.requesterId,
      subjectHandle: net.subject.publicHandle,
      priorConsentCommitment: finalizedConsent.payloadCommitment,
    }),
  );
  unwrapAnchor(coordinator.submit(revocationAnchor.anchorId));
  coordinator.advanceSimulatedFinality();
  unwrapAnchor(coordinator.refreshFinality(revocationAnchor.anchorId));

  const matched = unwrapAnchor(coordinator.reconcile(finalizedConsent.anchorId));
  if (matched.hinOutcome !== 'MATCHED' || matched.autoFixed !== false) {
    throw new Error('finalized consent reconciliation must MATCH without auto-fix');
  }

  const finalized = coordinator.auditCounters().anchorsFinalized;
  if (net.engine.policy.productionActivated !== false) {
    throw new Error('HIN chain anchoring must remain simulation-only');
  }
  return Object.freeze({
    CONSENT_SOURCE_OF_TRUTH,
    CHAIN_ANCHOR_IS_EVIDENCE,
    REVOCATION_REQUIRES_CHAIN_TO_BLOCK_FUTURE_USE,
    FINALIZED_ANCHORS: finalized,
    RAW_PERSONAL_DATA_ON_CHAIN,
    ANCHOR_MINTS_ASSET: false,
    PRODUCTION_ACTIVE,
  });
}

const isMain = process.argv[1]?.includes('chain-anchor/finality-demo.ts') === true;
if (isMain) {
  const result = runHumanInformationChainFinalityDemo();
  process.stdout.write(
    [
      'SunRey Human Information Network chain-anchor finality demo',
      'subject → request → consent → right → intent → submit → simulated finality',
      `CONSENT_SOURCE_OF_TRUTH=${result.CONSENT_SOURCE_OF_TRUTH}`,
      `CHAIN_ANCHOR_IS_EVIDENCE=${result.CHAIN_ANCHOR_IS_EVIDENCE}`,
      `REVOCATION_REQUIRES_CHAIN_TO_BLOCK_FUTURE_USE=${result.REVOCATION_REQUIRES_CHAIN_TO_BLOCK_FUTURE_USE}`,
      `FINALIZED_ANCHORS=${result.FINALIZED_ANCHORS}`,
      `RAW_PERSONAL_DATA_ON_CHAIN=${result.RAW_PERSONAL_DATA_ON_CHAIN}`,
      `ANCHOR_MINTS_ASSET=${result.ANCHOR_MINTS_ASSET}`,
      `PRODUCTION_ACTIVE=${result.PRODUCTION_ACTIVE}`,
      '',
    ].join('\n'),
  );
}
