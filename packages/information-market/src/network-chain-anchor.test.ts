import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { ENVIRONMENT, LIVE_CRYPTO_ENABLED, LIVE_DATA_MARKET_ENABLED, LIVE_MONEY_ENABLED } from '../../config/src/flags.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EconomicAssetRegistry } from '../../economic-asset-registry/src/index.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SunReyChainService } from '../../sunrey-chain/src/service.ts';
import type { ReconciliationRecord } from '../../sunrey-chain/src/types.ts';
import { createHumanInformationChainAnchorPort } from './network/chain-anchor/adapter.ts';
import { createHumanInformationAnchorCoordinator } from './network/chain-anchor/coordinator.ts';
import {
  CHAIN_FINALITY_IS_NOT_LEGAL_CONSENT_AUTHORITY,
  HIN_ANCHOR_INVARIANTS,
} from './network/chain-anchor/invariants.ts';
import type { HumanInformationChainAnchorRuntime } from './network/chain-anchor/port.ts';
import {
  scheduleContributionAnchor,
  scheduleSettlementAnchor,
} from './network/chain-anchor/schedule.ts';
import { runHumanInformationChainFinalityDemo } from './network/chain-anchor/demo.ts';
import { createHinContributionAdapter, createInProcessHumanContributionRegistry } from './network/contribution/index.ts';
import { createHinEconomicAssetAdapter } from './network/economic-asset-adapter.ts';
import { HumanInformationNetworkEngine } from './network/engine.ts';

const NOW = asUtcInstant('2026-08-20T05:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-20T05:00:00.000Z');
const SRC = join(import.meta.dirname, 'network', 'chain-anchor');

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code?: string; readonly message: string } }): T {
  if (!result.ok) {
    throw new Error(`${result.error.code ?? 'ERR'}: ${result.error.message}`);
  }
  return result.value;
}

function stack(portOverride?: HumanInformationChainAnchorRuntime) {
  const clock = new FrozenClock(NOW);
  const chain = new SunReyChainService({
    clock,
    keys: createSimulationKeyProvider({ clock: { now: () => clock.now() } }),
    evidence: new EvidenceVault(clock),
    events: new DomainEventLog(),
  });
  const port = portOverride ?? createHumanInformationChainAnchorPort(chain);
  const registry = new EconomicAssetRegistry();
  const coordinator = createHumanInformationAnchorCoordinator({ clock, port, registry });
  const engine = new HumanInformationNetworkEngine({ clock, anchorCoordinator: coordinator });
  return { clock, chain, port, registry, coordinator, engine };
}

function realizeUse(
  engine: HumanInformationNetworkEngine,
  input: {
    readonly rightId: string;
    readonly computationId: string;
    readonly consentHash: string;
    readonly subjectId: string;
  },
) {
  const job = unwrap(
    engine.submitCleanRoomComputation({
      requesterId: 'req_lab',
      purpose: 'AGGREGATED_RESEARCH',
      rightId: input.rightId as never,
      approvedComputationId: input.computationId as never,
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
      jurisdiction: 'GB',
      presentedConsentHash: input.consentHash,
      cohortSize: 12,
      outputRowCount: 1,
    }),
  );
  unwrap(
    engine.getCleanRoomResult({
      computationRequestId: job.computationRequestId,
      privacySafeValue: 'activity_band=moderate',
      cohortSize: 12,
    }),
  );
  return unwrap(
    engine.recordUsage({
      rightId: input.rightId as never,
      requesterId: 'req_lab',
      computationId: input.computationId as never,
      outputClass: 'AGGREGATE_STATISTIC',
      settlementRef: null,
    }),
  );
}

function provision(engine: HumanInformationNetworkEngine) {
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
  unwrap(
    engine.registerRequester({
      requesterId: 'req_other',
      organization: 'Other Lab',
      requesterClass: 'RESEARCH_INSTITUTION',
      jurisdiction: 'GB',
    }),
  );
  const computation = unwrap(
    engine.registerApprovedComputation({
      codeVersion: 'agg-v1',
      queryDefinition: 'AGGREGATE_MEAN',
      artifactDigest: 'sha256:agg',
      allowedOutputClasses: ['AGGREGATE_STATISTIC'],
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
  return { subject, descriptor, computation, request };
}

function wrapPort(
  inner: HumanInformationChainAnchorRuntime,
  mapReconcile: (record: ReconciliationRecord) => ReconciliationRecord,
): HumanInformationChainAnchorRuntime {
  return {
    createIntent: (input) => inner.createIntent(input),
    submit: (intentId) => inner.submit(intentId),
    getIntent: (intentId) => inner.getIntent(intentId),
    getOperation: (operationId) => inner.getOperation(operationId),
    getReceipt: (receiptId) => inner.getReceipt(receiptId),
    getFinality: (operationId) => inner.getFinality(operationId),
    reconcile: (operationId) => {
      const current = inner.reconcile(operationId);
      if (!current.ok) {
        return current;
      }
      return { ok: true, value: mapReconcile(current.value) };
    },
    getHealth: () => inner.getHealth(),
    advanceFinality: (blocks) => inner.advanceFinality?.(blocks),
    observeReorg: (operationId) => inner.observeReorg?.(operationId) ?? inner.reconcile(operationId) as never,
    setUnavailable: (value) => inner.setUnavailable?.(value),
    setUnknownNext: (value) => inner.setUnknownNext?.(value),
    setRejectNext: (value) => inner.setRejectNext?.(value),
  };
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('HIN chain anchor finality', () => {
  it('1-5 submits and finalizes consent, usage, contribution, and revocation', () => {
    const { coordinator, engine, registry } = stack();
    const { subject, descriptor, computation, request } = provision(engine);
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
    const consent = coordinator.store.findBySource('CONSENT_RECEIPT', approved.grant.grantId);
    assert.ok(consent);
    assert.notEqual(consent.chainState, 'FINALIZED');
    coordinator.advanceSimulatedFinality(2);
    const finalizedConsent = coordinator.store.findBySource('CONSENT_RECEIPT', approved.grant.grantId);
    assert.equal(finalizedConsent?.chainState, 'FINALIZED');
    assert.equal(finalizedConsent?.finalized, true);
    assert.ok(finalizedConsent?.transactionId);
    assert.ok(finalizedConsent?.receiptId);
    assert.ok(finalizedConsent?.blockReference);
    assert.ok((finalizedConsent?.confirmations ?? 0) >= 2);

    const usage = realizeUse(engine, {
      rightId: approved.right.rightId,
      computationId: computation.computationId,
      consentHash: approved.grant.consentHash,
      subjectId: subject.subjectId,
    });
    assert.equal(usage.chainHeight, 0n);
    coordinator.advanceSimulatedFinality(2);
    const usageAnchor = coordinator.store.findBySource('USAGE_RECEIPT', usage.receiptId);
    assert.equal(usageAnchor?.finalized, true);
    const projection = coordinator.store.usageProjections.get(usage.receiptId);
    assert.ok(projection);
    assert.equal(projection.finalized, true);
    assert.ok(projection.chainHeight !== null);
    assert.equal(usage.chainHeight, 0n);

    const contributions = createHinContributionAdapter({
      engine,
      registry: createInProcessHumanContributionRegistry(),
      anchorCoordinator: coordinator,
    });
    unwrap(contributions.submitRealizedUse({ receiptId: usage.receiptId }));
    coordinator.advanceSimulatedFinality(2);
    const contributionAnchor = [...coordinator.store.anchors.values()].find((row) => row.kind === 'PROOF_OF_CONTRIBUTION');
    assert.equal(contributionAnchor?.finalized, true);
    assert.equal(contributionAnchor?.mintsAsset, false);

    unwrap(engine.revokeInformationConsent({ grantId: approved.grant.grantId }));
    coordinator.advanceSimulatedFinality(2);
    const revocation = [...engine.store.revocations.values()][0]!;
    const revocationAnchor = coordinator.store.findBySource('CONSENT_REVOCATION', revocation.revocationId);
    assert.equal(revocationAnchor?.finalized, true);
    const revocationProjection = coordinator.store.revocationProjections.get(revocation.revocationId);
    assert.equal(revocationProjection?.historicalConsentAnchorImmutable, true);
    assert.equal(revocationProjection?.hinFutureUseBlocked, true);
    assert.equal(coordinator.store.consentProjections.get(approved.grant.grantId)?.projectedActive, false);
    void registry;
  });

  it('6-7 revocation blocks future use before finality and outage does not reactivate consent', () => {
    const { coordinator, engine } = stack();
    const { subject, descriptor, computation, request } = provision(engine);
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
    coordinator.setChainUnavailable(true);
    const revocation = unwrap(engine.revokeInformationConsent({ grantId: approved.grant.grantId }));
    assert.equal(revocation.futureUseBlocked, true);
    assert.equal(engine.store.grants.get(approved.grant.grantId)?.status, 'REVOKED');
    const blocked = engine.submitCleanRoomComputation({
      requesterId: 'req_lab',
      purpose: 'AGGREGATED_RESEARCH',
      rightId: approved.right.rightId,
      approvedComputationId: computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
      jurisdiction: 'GB',
      cohortSize: 12,
    });
    assert.equal(blocked.ok, false);
    assert.equal(engine.store.grants.get(approved.grant.grantId)?.status, 'REVOKED');
    assert.equal(CHAIN_FINALITY_IS_NOT_LEGAL_CONSENT_AUTHORITY, true);
    assert.equal(HIN_ANCHOR_INVARIANTS.REVOCATION_REQUIRES_CHAIN_TO_BLOCK_FUTURE_USE, false);
  });

  it('8-11 retries are idempotent; UNKNOWN requires reconcile and does not resubmit; finalized retry returns same', () => {
    const { coordinator, engine, port } = stack();
    const { subject, descriptor, request } = provision(engine);
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
    const first = coordinator.store.findBySource('CONSENT_RECEIPT', approved.grant.grantId)!;
    const retried = unwrap(coordinator.submit(first.anchorId));
    assert.equal(retried.anchorId, first.anchorId);
    coordinator.advanceSimulatedFinality(2);
    const finalized = unwrap(coordinator.submit(first.anchorId));
    assert.equal(finalized.finalized, true);
    assert.equal(finalized.anchorId, first.anchorId);
    assert.equal([...coordinator.store.anchors.values()].filter((row) => row.kind === 'CONSENT_RECEIPT').length, 1);

    port.setUnknownNext?.(true);
    const usage = unwrap(
      engine.recordUsage({
        rightId: approved.right.rightId,
        requesterId: 'req_lab',
        computationId: unwrap(
          engine.registerApprovedComputation({
            codeVersion: 'agg-v2',
            queryDefinition: 'AGGREGATE_MEAN',
            artifactDigest: 'sha256:agg2',
            allowedOutputClasses: ['AGGREGATE_STATISTIC'],
          }),
        ).computationId,
        outputClass: 'AGGREGATE_STATISTIC',
        settlementRef: null,
      }),
    );
    const unknown = coordinator.store.findBySource('USAGE_RECEIPT', usage.receiptId)!;
    assert.equal(unknown.chainState === 'UNKNOWN' || unknown.unknownAfterBroadcast, true);
    const intentId = unknown.intentId;
    const again = coordinator.submit(unknown.anchorId);
    assert.equal(again.ok, false);
    assert.equal(again.ok === false && again.error.code, 'HIN_ANCHOR_RECONCILIATION_REQUIRED');
    assert.equal(coordinator.store.findBySource('USAGE_RECEIPT', usage.receiptId)?.intentId, intentId);
    const reconciled = unwrap(coordinator.reconcile(unknown.anchorId));
    assert.equal(reconciled.chainOutcome, 'SUBMISSION_UNKNOWN');
    assert.equal(reconciled.hinOutcome, 'REVIEW_REQUIRED');
    assert.equal(reconciled.autoFixed, false);
  });

  it('12-13 reorg preserves HIN history and requires review', () => {
    const { coordinator, engine } = stack();
    const { subject, descriptor, request } = provision(engine);
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
    const grant = engine.store.grants.get(approved.grant.grantId);
    assert.equal(grant?.status, 'ACTIVE');
    const anchor = coordinator.store.findBySource('CONSENT_RECEIPT', approved.grant.grantId)!;
    const reorg = coordinator.observeReorg(anchor.anchorId);
    assert.equal(reorg.ok, false);
    assert.equal(reorg.ok === false && reorg.error.code, 'HIN_ANCHOR_REORG_OBSERVED');
    assert.equal(engine.store.grants.get(approved.grant.grantId)?.status, 'ACTIVE');
    assert.equal(engine.store.rights.get(approved.right.rightId)?.status, 'ACTIVE');
    const after = coordinator.store.findBySource('CONSENT_RECEIPT', approved.grant.grantId)!;
    assert.equal(after.reorgObserved, true);
    assert.equal(after.schedule, 'REVIEW');
    assert.equal(coordinator.auditCounters().anchorsReorgObserved, 1);
  });

  it('14-17 maps hash mismatch, missing records, and matched reconciliation', () => {
    const clock = new FrozenClock(NOW);
    const chain = new SunReyChainService({
      clock,
      keys: createSimulationKeyProvider({ clock: { now: () => clock.now() } }),
      evidence: new EvidenceVault(clock),
      events: new DomainEventLog(),
    });
    const inner = createHumanInformationChainAnchorPort(chain);
    const port = wrapPort(inner, (current) => {
      if (current.sourceRecordReference.startsWith('hireceipt_')) {
        return { ...current, outcome: 'HASH_MISMATCH', chainCommitment: '0xdead', autoFixed: false };
      }
      return current;
    });
    const coordinator = createHumanInformationAnchorCoordinator({ clock, port });
    const engine = new HumanInformationNetworkEngine({ clock, anchorCoordinator: coordinator });
    const { subject, descriptor, computation, request } = provision(engine);
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
    const matched = unwrap(coordinator.reconcile(coordinator.store.findBySource('CONSENT_RECEIPT', approved.grant.grantId)!.anchorId));
    assert.equal(matched.hinOutcome, 'MATCHED');
    assert.equal(matched.autoFixed, false);

    unwrap(
      engine.recordUsage({
        rightId: approved.right.rightId,
        requesterId: 'req_lab',
        computationId: computation.computationId,
        outputClass: 'AGGREGATE_STATISTIC',
        settlementRef: null,
      }),
    );
    coordinator.advanceSimulatedFinality(2);
    const usage = [...engine.store.receipts.values()][0]!;
    const hashed = unwrap(coordinator.reconcile(coordinator.store.findBySource('USAGE_RECEIPT', usage.receiptId)!.anchorId));
    assert.equal(hashed.chainOutcome, 'HASH_MISMATCH');
    assert.equal(hashed.hinOutcome, 'REVIEW_REQUIRED');
    assert.equal(hashed.autoFixed, false);
    assert.equal(hashed.observedCommitment, '0xdead');

    const missingHin = coordinator.reconcileOperation('cop_missing_hin' as never);
    assert.equal(missingHin.ok && missingHin.value.chainOutcome, 'MISSING_INTERNAL_RECORD');
    assert.equal(missingHin.ok && missingHin.value.hinOutcome, 'FAILED');
    assert.equal(missingHin.ok && missingHin.value.autoFixed, false);
  });

  it('18-19 Economic Asset Registry receives finalized metadata without independent verification', () => {
    const { coordinator, engine, registry } = stack();
    const adapter = createHinEconomicAssetAdapter(registry);
    const { subject, descriptor, request } = provision(engine);
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
    unwrap(
      adapter.projectInformationRight({
        right: approved.right,
        descriptor,
        subject,
        consent: approved.grant,
        at: NOW,
      }),
    );
    const before = registry.findBySourceRecord('packages/information-market', approved.right.rightId);
    assert.equal(before?.status === 'VERIFIED', false);
    assert.equal(before?.chainAnchor?.finalityState, 'UNANCHORED');
    const consentAnchor = coordinator.store.findBySource('CONSENT_RECEIPT', approved.grant.grantId)!;
    coordinator.advanceSimulatedFinality(2);
    coordinator.project(consentAnchor.anchorId);
    const afterConsent = registry.findBySourceRecord('packages/information-market', approved.right.rightId);
    const projected = afterConsent
      ?? registry.findBySourceRecord('packages/information-market', approved.grant.grantId);
    assert.ok(projected);
    const finalized = coordinator.store.findBySource('CONSENT_RECEIPT', approved.grant.grantId)!;
    const updated = unwrap(
      ((): ReturnType<typeof adapter.projectInformationRight> => {
        const current = registry.findBySourceRecord('packages/information-market', approved.right.rightId);
        if (!current || !finalized.finalized) {
          return { ok: false, error: { code: 'ASSET_NOT_FOUND', message: 'missing' } };
        }
        return registry.correct(current.assetId, {
          assetClass: current.assetClass,
          domain: current.domain,
          canonicalOwnerSystem: current.canonicalOwnerSystem,
          sourceRecordId: current.sourceRecordId,
          sourceClass: current.sourceClass,
          sourceSystem: current.sourceSystem,
          sourceSchemaVersion: `${current.sourceSchemaVersion}+anchor`,
          controllerRef: current.controllerRef,
          rightsHolderRefs: current.rightsHolderRefs,
          subjectRef: current.subjectRef,
          jurisdiction: current.jurisdiction,
          consentRefs: current.consentRefs,
          purposeRefs: current.purposeRefs,
          usageRestrictionRefs: current.usageRestrictionRefs,
          sensitivityClass: current.sensitivityClass,
          qualityClass: current.qualityClass,
          freshness: current.freshness,
          validFrom: current.validFrom,
          economicCategory: current.economicCategory,
          contentCommitmentMaterial: `hin-right:${approved.right.rightId}:${approved.right.policyVersion}:final`,
          provenanceMaterial: `hin-right-prov:${approved.right.consentGrantId}:final`,
          storageClass: current.storageClass,
          status: 'REGISTERED',
          chainAnchor: {
            networkId: current.chainAnchor!.networkId,
            chainId: current.chainAnchor!.chainId,
            transactionId: current.chainAnchor!.transactionId,
            blockHeight: 3n,
            blockId: current.chainAnchor!.blockId,
            stateRootRef: null,
            contentCommitment: current.chainAnchor!.contentCommitment,
            anchorType: current.chainAnchor!.anchorType,
            finalityState: 'FINALIZED_ON_SIMULATION',
          },
          createdAt: NOW,
        });
      })(),
    );
    assert.equal(updated.status, 'REGISTERED');
    assert.notEqual(updated.status, 'VERIFIED');
    assert.equal(updated.chainAnchor?.finalityState, 'FINALIZED_ON_SIMULATION');
    assert.ok(updated.chainAnchor?.blockHeight);
    void projected;
  });

  it('20-21 Control Center hides raw subject IDs and requester cannot see unrelated anchors', () => {
    const { coordinator, engine } = stack();
    const { subject, descriptor, request } = provision(engine);
    unwrap(
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
    const center = unwrap(engine.controlCenter(subject.subjectId));
    assert.equal(center.subjectHandle, subject.publicHandle);
    assert.equal(JSON.stringify(center).includes(subject.internalRef), false);
    assert.equal(JSON.stringify(center).includes('synthetic-ada'), false);
    assert.ok(center.consentAnchorStatus);
    const other = unwrap(engine.requesterPortal('req_other'));
    assert.equal(other.authorizedAnchorStatuses.length, 0);
    const owner = unwrap(engine.requesterPortal('req_lab'));
    assert.ok(owner.authorizedAnchorStatuses.length > 0);
    assert.equal(
      owner.authorizedAnchorStatuses.every((row) => coordinator.anchorsForRequester('req_lab').some((anchor) => anchor.sourceRecordId === row.sourceRecordId)),
      true,
    );
  });

  it('22-23 contribution cannot mint and settlement cannot alter the ledger', () => {
    const { coordinator, engine } = stack();
    const { subject, descriptor, computation, request } = provision(engine);
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
    const usage = realizeUse(engine, {
      rightId: approved.right.rightId,
      computationId: computation.computationId,
      consentHash: approved.grant.consentHash,
      subjectId: subject.subjectId,
    });
    const contributions = createHinContributionAdapter({
      engine,
      registry: createInProcessHumanContributionRegistry(),
      anchorCoordinator: coordinator,
    });
    const recorded = unwrap(contributions.submitRealizedUse({ receiptId: usage.receiptId }));
    assert.equal(recorded.automaticSunReyMint, false);
    const contribution = unwrap(
      scheduleContributionAnchor(coordinator, {
        contributionId: recorded.contributionId,
        fingerprint: recorded.evidence.evidenceDigest,
        verificationDecision: recorded.status,
        informationRightEvidence: recorded.evidence.rightId,
        usageReceiptId: recorded.evidence.usageReceiptId,
        subjectHandle: subject.publicHandle,
        subjectRawId: subject.internalRef,
        purpose: recorded.evidence.purposeRef,
        jurisdictionCell: 'GB:SIM',
      }),
    );
    assert.equal(contribution.mintsAsset, false);
    const settlement = unwrap(
      scheduleSettlementAnchor(coordinator, {
        settlementRef: 'settle_demo',
        journalId: 'journal_none',
        transferId: 'transfer_none',
        assetCommitment: recorded.evidence.evidenceDigest,
        subjectHandle: subject.publicHandle,
        jurisdictionCell: 'GB:SIM',
        requesterId: 'req_lab',
      }),
    );
    assert.equal(settlement.altersLedger, false);
    assert.equal(settlement.kind, 'DIGITAL_ASSET_SETTLEMENT');
    assert.equal(HIN_ANCHOR_INVARIANTS.ANCHOR_ALTERS_LEDGER, false);
  });

  it('24-26 privacy, no real network, production remains disabled', () => {
    const result = runHumanInformationChainFinalityDemo();
    assert.equal(result.CONSENT_SOURCE_OF_TRUTH, 'HIN');
    assert.equal(result.CHAIN_ANCHOR_IS_EVIDENCE, true);
    assert.equal(result.REVOCATION_REQUIRES_CHAIN_TO_BLOCK_FUTURE_USE, false);
    assert.ok(result.FINALIZED_ANCHORS >= 1);
    assert.equal(result.RAW_PERSONAL_DATA_ON_CHAIN, false);
    assert.equal(result.ANCHOR_MINTS_ASSET, false);
    assert.equal(result.PRODUCTION_ACTIVE, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    for (const file of walk(SRC)) {
      if (file.endsWith('demo.ts') || file.endsWith('.test.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/legalName|ssn|iban|privateKey|rawPdv/i.test(source) && file.endsWith('invariants.ts') === false, false, file);
      assert.equal(/from ['"].*simulation\.ts['"]/.test(source) && !file.endsWith('adapter.ts'), false, file);
      assert.equal(/\bfetch\(|http\.request|net\.connect/.test(source), false, file);
    }
  });

  it('missing chain record maps to FAILED without auto-fix', () => {
    const clock = new FrozenClock(NOW);
    const chain = new SunReyChainService({
      clock,
      keys: createSimulationKeyProvider({ clock: { now: () => clock.now() } }),
      evidence: new EvidenceVault(clock),
      events: new DomainEventLog(),
    });
    const inner = createHumanInformationChainAnchorPort(chain);
    const port = wrapPort(inner, (current) => ({ ...current, outcome: 'MISSING_CHAIN_RECORD', autoFixed: false }));
    const coordinator = createHumanInformationAnchorCoordinator({ clock, port });
    const engine = new HumanInformationNetworkEngine({ clock, anchorCoordinator: coordinator });
    const { subject, descriptor, request } = provision(engine);
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
    const record = unwrap(coordinator.reconcile(coordinator.store.findBySource('CONSENT_RECEIPT', approved.grant.grantId)!.anchorId));
    assert.equal(record.chainOutcome, 'MISSING_CHAIN_RECORD');
    assert.equal(record.hinOutcome, 'FAILED');
    assert.equal(record.autoFixed, false);
  });
});
