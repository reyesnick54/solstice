import { FrozenClock } from '../../../../config/src/clock.ts';
import { ENVIRONMENT, LIVE_DATA_MARKET_ENABLED, LIVE_MONEY_ENABLED } from '../../../../config/src/flags.ts';
import { asUtcInstant } from '../../../../domain/src/time.ts';
import { EconomicAssetRegistry } from '../../../../economic-asset-registry/src/index.ts';
import { EvidenceVault } from '../../../../evidence/src/vault.ts';
import { DomainEventLog } from '../../../../events/src/events.ts';
import { createSimulationKeyProvider } from '../../../../security/src/simulation.ts';
import { SunReyChainService } from '../../../../sunrey-chain/src/service.ts';
import { createHinContributionAdapter, createInProcessHumanContributionRegistry } from '../contribution/index.ts';
import { HumanInformationNetworkEngine } from '../engine.ts';
import { createHumanInformationChainAnchorPort } from './adapter.ts';
import { createHumanInformationAnchorCoordinator } from './coordinator.ts';
import {
  ANCHOR_MINTS_ASSET,
  CHAIN_ANCHOR_IS_EVIDENCE,
  CONSENT_SOURCE_OF_TRUTH,
  PRODUCTION_ACTIVE,
  RAW_PERSONAL_DATA_ON_CHAIN,
  REVOCATION_REQUIRES_CHAIN_TO_BLOCK_FUTURE_USE,
} from './invariants.ts';

const NOW = asUtcInstant('2026-08-20T05:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-20T05:00:00.000Z');

export type HumanInformationChainFinalityDemoResult = {
  readonly CONSENT_SOURCE_OF_TRUTH: typeof CONSENT_SOURCE_OF_TRUTH;
  readonly CHAIN_ANCHOR_IS_EVIDENCE: true;
  readonly REVOCATION_REQUIRES_CHAIN_TO_BLOCK_FUTURE_USE: false;
  readonly FINALIZED_ANCHORS: number;
  readonly RAW_PERSONAL_DATA_ON_CHAIN: false;
  readonly ANCHOR_MINTS_ASSET: false;
  readonly PRODUCTION_ACTIVE: false;
  readonly reconciliation: 'MATCHED';
  readonly futureUseBlockedBeforeFinality: true;
};

export function runHumanInformationChainFinalityDemo(): HumanInformationChainFinalityDemoResult {
  const clock = new FrozenClock(NOW);
  const chain = new SunReyChainService({
    clock,
    keys: createSimulationKeyProvider({ clock: { now: () => clock.now() } }),
    evidence: new EvidenceVault(clock),
    events: new DomainEventLog(),
  });
  const coordinator = createHumanInformationAnchorCoordinator({
    clock,
    port: createHumanInformationChainAnchorPort(chain),
    registry: new EconomicAssetRegistry(),
    events: new DomainEventLog(),
  });
  const engine = new HumanInformationNetworkEngine({ clock, anchorCoordinator: coordinator });
  const subject = unwrap(engine.registerSubject({ internalRef: 'synthetic-finality-ada' }));
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
      requesterId: 'req_finality_lab',
      organization: 'Synthetic Finality Lab',
      requesterClass: 'RESEARCH_INSTITUTION',
      jurisdiction: 'GB',
    }),
  );
  const computation = unwrap(
    engine.registerApprovedComputation({
      codeVersion: 'finality-agg-v1',
      queryDefinition: 'AGGREGATE_MEAN',
      artifactDigest: 'sha256:finality',
      allowedOutputClasses: ['AGGREGATE_STATISTIC'],
    }),
  );
  const request = unwrap(
    engine.submitInformationRequest({
      requesterId: 'req_finality_lab',
      requestedRight: 'ONE_TIME_COMPUTATION',
      purpose: 'AGGREGATED_RESEARCH',
      computationId: computation.computationId,
      duration: 'P30D',
      compensationAsset: 'APPROVED_FIAT',
      compensationMinor: 1800n,
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
  coordinator.advanceSimulatedFinality(2);
  const job = unwrap(
    engine.submitCleanRoomComputation({
      requesterId: 'req_finality_lab',
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
    engine.getCleanRoomResult({
      computationRequestId: job.computationRequestId,
      privacySafeValue: 'activity_band=moderate',
      cohortSize: 12,
    }),
  );
  unwrap(
    engine.recordUsage({
      rightId: approved.right.rightId,
      requesterId: 'req_finality_lab',
      computationId: computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      settlementRef: null,
    }),
  );
  coordinator.advanceSimulatedFinality(2);
  const contributions = createHinContributionAdapter({
    engine,
    registry: createInProcessHumanContributionRegistry(),
    anchorCoordinator: coordinator,
  });
  const usage = [...engine.store.receipts.values()][0];
  if (usage) {
    contributions.submitRealizedUse({ receiptId: usage.receiptId });
    coordinator.advanceSimulatedFinality(2);
  }
  const revocation = unwrap(engine.revokeInformationConsent({ grantId: approved.grant.grantId }));
  const blocked = engine.submitCleanRoomComputation({
    requesterId: 'req_finality_lab',
    purpose: 'AGGREGATED_RESEARCH',
    rightId: approved.right.rightId,
    approvedComputationId: computation.computationId,
    outputClass: 'AGGREGATE_STATISTIC',
    expiresAt: EXPIRES,
    jurisdiction: 'GB',
    cohortSize: 12,
  });
  if (blocked.ok) {
    throw new Error('revocation must block future use before chain finality');
  }
  coordinator.advanceSimulatedFinality(2);
  let matched = 0;
  for (const anchor of coordinator.store.anchors.values()) {
    const reconciled = coordinator.reconcile(anchor.anchorId);
    if (reconciled.ok && reconciled.value.hinOutcome === 'MATCHED') {
      matched += 1;
    }
  }
  if (matched === 0) {
    throw new Error('expected MATCHED reconciliation after simulated finality');
  }
  if (ENVIRONMENT !== 'simulation' || LIVE_MONEY_ENABLED !== false || LIVE_DATA_MARKET_ENABLED !== false) {
    throw new Error('production flags must remain disabled');
  }
  if (revocation.futureUseBlocked !== true) {
    throw new Error('HIN revocation must block future use');
  }
  return Object.freeze({
    CONSENT_SOURCE_OF_TRUTH,
    CHAIN_ANCHOR_IS_EVIDENCE,
    REVOCATION_REQUIRES_CHAIN_TO_BLOCK_FUTURE_USE,
    FINALIZED_ANCHORS: coordinator.auditCounters().anchorsFinalized,
    RAW_PERSONAL_DATA_ON_CHAIN,
    ANCHOR_MINTS_ASSET,
    PRODUCTION_ACTIVE,
    reconciliation: 'MATCHED',
    futureUseBlockedBeforeFinality: true,
  });
}

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly message: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

const isMain = process.argv[1]?.includes('chain-anchor/demo.ts') === true;
if (isMain) {
  const result = runHumanInformationChainFinalityDemo();
  process.stdout.write(
    [
      'SunRey Human Information Chain Finality demo',
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
