import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { EconomicAssetRegistry } from '../../economic-asset-registry/src/index.ts';
import { emptyBudgetUsage } from './productive/policy-governance/budget.ts';
import { developmentPolicyBundle } from './productive/policy-governance/registry.ts';
import { evaluateContributionEligibility, type EligibilityInput } from './productive/policy-governance/eligibility.ts';
import {
  ATTRIBUTION_BOOK_IS_MONETARY_LEDGER,
  ATTRIBUTION_REJECTION_CODES,
  ATTRIBUTION_SHARE_SCALE,
  ProductiveAttributionBook,
  DEMO_HOUR_END,
  DEMO_HOUR_MID,
  DEMO_HOUR_START,
  goodsObservation,
  logisticsObservation,
  machineObservation,
  manufacturingObservation,
  reflectAttributionLineage,
  refuseRawAttributionDatasetStore,
  routeRequiresAttribution,
  simulationAttributionDecision,
  storageObservation,
} from './productive/policy-governance/attribution-accounting/index.ts';
import { createProductiveEconomicAssetAdapter } from './productive/economic-asset-adapter.ts';
import { automatedFactory, fixtureClaim, fixtureFacts, solarFacility } from './productive/fixtures.ts';
import { developmentIssuancePolicy } from './productive/policy.ts';
import { runMoonReyAttributionReconciliationDemo } from './productive/policy-governance/attribution-accounting/demo.ts';

function reserve(
  book: ProductiveAttributionBook,
  observation: ReturnType<typeof manufacturingObservation>,
  decisionId: string,
  allocatedShare = ATTRIBUTION_SHARE_SCALE,
  policyVersion = 1,
) {
  const decision = simulationAttributionDecision(observation, {
    attributionDecisionId: decisionId,
    allocatedShare,
    attributionPolicyVersion: policyVersion,
  });
  return book.reserve({
    observation,
    decision,
    expectedPolicyVersion: policyVersion,
  });
}

function manufacturingEligibility(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  const object = automatedFactory();
  const facts = fixtureFacts({ objectId: object.objectId, category: 'MANUFACTURING', quantity: 100n, unit: 'UNIT' });
  const bundle = developmentPolicyBundle();
  return {
    height: 10,
    requestedPolicyVersion: 1,
    category: 'MANUFACTURING',
    claimType: 'OUTPUT',
    object,
    objectEligible: true,
    providerId: 'oracle.1',
    actorId: object.controller,
    sourceUnitId: 'UNIT',
    sourceQuantity: 100n,
    measurementEpoch: 1,
    validFromUnixSeconds: 1_799_000_000n,
    validUntilUnixSeconds: 1_800_000_000n,
    deliveryFromUnixSeconds: 1_799_000_000n,
    deliveryUntilUnixSeconds: 1_800_000_000n,
    oracleFacts: facts,
    referenceFacts: [],
    claimLineage: [],
    knownGovernedFingerprints: new Set(),
    knownCrossCategoryEvents: new Set(),
    knownCapacityOutputEvents: new Map(),
    budgetUsage: emptyBudgetUsage(),
    issuancePolicy: developmentIssuancePolicy(),
    bundle,
    ...overrides,
  };
}

describe('Chunk 122 MoonRey attribution accounting', () => {
  it('exposes stable rejection codes and is not a monetary ledger', () => {
    for (const code of [
      'ATTRIBUTION_DECISION_REQUIRED',
      'ATTRIBUTION_SHARE_EXHAUSTED',
      'EVENT_OVERALLOCATED',
      'EVENT_REPLAY',
      'CLAIM_REPLAY',
      'CONTRIBUTION_REPLAY',
      'OVERLAPPING_WINDOW_DUPLICATE',
      'BATCH_SPLIT_OVERALLOCATION',
      'BATCH_MERGE_DUPLICATE',
      'CATEGORY_RELABEL_DUPLICATE',
      'OBJECT_RELABEL_DUPLICATE',
      'CONTROLLER_RELABEL_DUPLICATE',
      'CORRECTION_REQUIRED',
      'MONETARY_ADJUSTMENT_REVIEW_REQUIRED',
      'ATTRIBUTION_POLICY_VERSION_MISMATCH',
    ]) {
      assert.ok((ATTRIBUTION_REJECTION_CODES as readonly string[]).includes(code), code);
    }
    const book = new ProductiveAttributionBook();
    assert.equal(book.isMonetaryLedger, false);
    assert.equal(book.storesMoonReyBalance, false);
    assert.equal(book.isAssetSupplyBook, false);
    assert.equal(ATTRIBUTION_BOOK_IS_MONETARY_LEDGER, false);
  });

  it('1. refuses a new claim ID wrapping the same event', () => {
    const book = new ProductiveAttributionBook();
    const first = reserve(book, manufacturingObservation(), 'd1');
    assert.equal(first.ok, true);
    const second = reserve(
      book,
      manufacturingObservation({ claimId: 'claim.mfg.2', contributionId: 'contrib.mfg.2' }),
      'd2',
    );
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.ok(['CLAIM_REPLAY', 'CONTRIBUTION_REPLAY', 'EVENT_REPLAY', 'ATTRIBUTION_SHARE_EXHAUSTED'].includes(second.code));
    }
  });

  it('2. refuses a new contribution ID for the same claim evidence', () => {
    const book = new ProductiveAttributionBook();
    assert.equal(reserve(book, manufacturingObservation(), 'd1').ok, true);
    const second = reserve(book, manufacturingObservation({ contributionId: 'contrib.mfg.2' }), 'd2');
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, 'CLAIM_REPLAY');
    }
  });

  it('3. refuses a new object ID for the same event evidence', () => {
    const book = new ProductiveAttributionBook();
    assert.equal(reserve(book, manufacturingObservation(), 'd1').ok, true);
    const second = reserve(
      book,
      manufacturingObservation({
        objectId: 'object.line-b',
        claimId: 'claim.mfg.obj',
        contributionId: 'contrib.mfg.obj',
        economicEventId: 'event.factory.relabel-object',
      }),
      'd2',
    );
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.ok(['OBJECT_RELABEL_DUPLICATE', 'EVENT_REPLAY', 'CLAIM_REPLAY', 'CONTRIBUTION_REPLAY'].includes(second.code));
    }
  });

  it('4. refuses a controller switch on the same event', () => {
    const book = new ProductiveAttributionBook();
    assert.equal(reserve(book, manufacturingObservation(), 'd1').ok, true);
    const second = reserve(
      book,
      manufacturingObservation({
        controllerId: 'controller.other',
        claimId: 'claim.mfg.ctl',
        contributionId: 'contrib.mfg.ctl',
        economicEventId: 'event.factory.relabel-controller',
      }),
      'd2',
    );
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.ok(['CONTROLLER_RELABEL_DUPLICATE', 'EVENT_REPLAY', 'CLAIM_REPLAY', 'CONTRIBUTION_REPLAY'].includes(second.code));
    }
  });

  it('5. refuses a category relabel of the same event', () => {
    const book = new ProductiveAttributionBook();
    assert.equal(reserve(book, manufacturingObservation(), 'd1').ok, true);
    const second = reserve(book, goodsObservation(), 'd2');
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.ok(['CATEGORY_RELABEL_DUPLICATE', 'EVENT_OVERALLOCATED', 'ATTRIBUTION_SHARE_EXHAUSTED', 'EVENT_REPLAY'].includes(second.code));
    }
  });

  it('6. treats unit aliases as the same event', () => {
    const book = new ProductiveAttributionBook();
    assert.equal(reserve(book, manufacturingObservation({ sourceUnitId: 'units_produced' }), 'd1').ok, true);
    const second = reserve(
      book,
      manufacturingObservation({
        sourceUnitId: 'UNIT',
        claimId: 'claim.mfg.alias',
        contributionId: 'contrib.mfg.alias',
        economicEventId: 'event.factory.unit-alias',
      }),
      'd2',
    );
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.ok(['EVENT_REPLAY', 'CLAIM_REPLAY', 'CONTRIBUTION_REPLAY', 'ATTRIBUTION_SHARE_EXHAUSTED'].includes(second.code));
    }
  });

  it('7. refuses overlapping window duplicates and allows adjacent cycles', () => {
    const book = new ProductiveAttributionBook();
    const firstHalf = manufacturingObservation({
      validFromUnixSeconds: DEMO_HOUR_START,
      validUntilUnixSeconds: DEMO_HOUR_MID,
      claimId: 'claim.half.1',
      contributionId: 'contrib.half.1',
    });
    assert.equal(reserve(book, firstHalf, 'd1').ok, true);
    const overlap = reserve(
      book,
      manufacturingObservation({
        validFromUnixSeconds: DEMO_HOUR_START,
        validUntilUnixSeconds: DEMO_HOUR_END,
        claimId: 'claim.full.overlap',
        contributionId: 'contrib.full.overlap',
        economicEventId: 'event.factory.overlap',
      }),
      'd2',
    );
    assert.equal(overlap.ok, false);
    if (!overlap.ok) {
      assert.ok(['OVERLAPPING_WINDOW_DUPLICATE', 'ATTRIBUTION_SHARE_EXHAUSTED', 'EVENT_OVERALLOCATED', 'CLAIM_REPLAY'].includes(overlap.code));
    }

    const adjacentBook = new ProductiveAttributionBook();
    const hour1 = manufacturingObservation({
      oracleFactIds: ['fact.cycle.1'],
      validFromUnixSeconds: DEMO_HOUR_START,
      validUntilUnixSeconds: DEMO_HOUR_END,
      batchId: 'batch.cycle-1',
    });
    const hour2 = manufacturingObservation({
      economicEventId: 'event.factory.hour-2',
      claimId: 'claim.mfg.hour2',
      contributionId: 'contrib.mfg.hour2',
      oracleFactIds: ['fact.cycle.2'],
      validFromUnixSeconds: DEMO_HOUR_END,
      validUntilUnixSeconds: DEMO_HOUR_END + 3_600n,
      batchId: 'batch.cycle-2',
    });
    assert.equal(reserve(adjacentBook, hour1, 'd-h1').ok, true);
    assert.equal(reserve(adjacentBook, hour2, 'd-h2').ok, true);
  });

  it('8. refuses a batch split that increases attributable production', () => {
    const book = new ProductiveAttributionBook();
    const parent = manufacturingObservation({ batchId: 'batch.A' });
    assert.equal(reserve(book, parent, 'd-parent').ok, true);
    const child = manufacturingObservation({
      economicEventId: 'event.factory.A1',
      claimId: 'claim.split.a1',
      contributionId: 'contrib.split.a1',
      batchId: 'batch.A1',
      lineage: {
        kind: 'SPLIT',
        parentEventIds: ['event.factory.hour-1'],
        childEventIds: ['event.factory.A1', 'event.factory.A2'],
      },
    });
    const split = reserve(book, child, 'd-split');
    assert.equal(split.ok, false);
    if (!split.ok) {
      assert.ok(['BATCH_SPLIT_OVERALLOCATION', 'ATTRIBUTION_SHARE_EXHAUSTED', 'EVENT_OVERALLOCATED', 'CLAIM_REPLAY'].includes(split.code));
    }
  });

  it('9. refuses a batch merge that fabricates new goods', () => {
    const book = new ProductiveAttributionBook();
    const a1 = manufacturingObservation({
      economicEventId: 'event.A1',
      claimId: 'claim.a1',
      contributionId: 'contrib.a1',
      batchId: 'batch.A1',
      oracleFactIds: ['fact.a1'],
    });
    const a2 = manufacturingObservation({
      economicEventId: 'event.A2',
      claimId: 'claim.a2',
      contributionId: 'contrib.a2',
      batchId: 'batch.A2',
      oracleFactIds: ['fact.a2'],
      geographyId: 'geo.plant-1',
    });
    assert.equal(reserve(book, a1, 'd-a1', ATTRIBUTION_SHARE_SCALE / 2n).ok, true);
    assert.equal(reserve(book, a2, 'd-a2', ATTRIBUTION_SHARE_SCALE / 2n).ok, true);
    const merged = reserve(
      book,
      manufacturingObservation({
        economicEventId: 'event.B',
        claimId: 'claim.merge.b',
        contributionId: 'contrib.merge.b',
        batchId: 'batch.B',
        oracleFactIds: ['fact.a1', 'fact.a2'],
        lineage: {
          kind: 'MERGE',
          parentEventIds: ['event.A1', 'event.A2'],
          childEventIds: ['event.B'],
        },
      }),
      'd-merge',
    );
    assert.equal(merged.ok, false);
    if (!merged.ok) {
      assert.equal(merged.code, 'BATCH_MERGE_DUPLICATE');
    }
  });

  it('10. refuses a different provider observation of the same event', () => {
    const book = new ProductiveAttributionBook();
    assert.equal(reserve(book, manufacturingObservation(), 'd1').ok, true);
    const second = reserve(
      book,
      manufacturingObservation({
        providerId: 'oracle.mes.2',
        oracleFactIds: ['fact.mes.output.other-provider'],
        claimId: 'claim.mfg.provider',
        contributionId: 'contrib.mfg.provider',
        economicEventId: 'event.factory.provider-2',
      }),
      'd2',
    );
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.ok(['EVENT_REPLAY', 'OBJECT_RELABEL_DUPLICATE', 'CONTRIBUTION_REPLAY'].includes(second.code));
    }
  });

  it('11-12. refuses manufacturing + goods and manufacturing + machine at 100%', () => {
    const book = new ProductiveAttributionBook();
    assert.equal(reserve(book, manufacturingObservation(), 'd-mfg').ok, true);
    const goods = reserve(book, goodsObservation(), 'd-goods');
    const machine = reserve(book, machineObservation(), 'd-machine');
    assert.equal(goods.ok, false);
    assert.equal(machine.ok, false);
  });

  it('13. refuses goods + logistics when logistics is not independently evidenced', () => {
    const book = new ProductiveAttributionBook();
    assert.equal(reserve(book, goodsObservation(), 'd-goods').ok, true);
    const tied = reserve(
      book,
      logisticsObservation({
        independentlyEvidenced: false,
        geographyId: 'geo.plant-1',
        sourceUnitId: 'units_produced',
        sourceQuantity: 100n,
        validFromUnixSeconds: DEMO_HOUR_START,
        validUntilUnixSeconds: DEMO_HOUR_END,
        oracleFactIds: ['fact.mes.output.1'],
        batchId: 'batch.A',
        economicEventId: 'event.logistics.tied',
      }),
      'd-log-tied',
    );
    assert.equal(tied.ok, false);
  });

  it('14-15. allows independently evidenced logistics and storage', () => {
    const book = new ProductiveAttributionBook();
    assert.equal(reserve(book, manufacturingObservation(), 'd-mfg').ok, true);
    const logistics = reserve(book, logisticsObservation(), 'd-log');
    const storage = reserve(book, storageObservation(), 'd-store');
    assert.equal(logistics.ok, true);
    assert.equal(storage.ok, true);
  });

  it('16. refuses compute + AI compute double attribution of one event', () => {
    const book = new ProductiveAttributionBook();
    const compute = manufacturingObservation({
      category: 'COMPUTE',
      economicEventId: 'event.compute.1',
      claimId: 'claim.compute',
      contributionId: 'contrib.compute',
      objectId: 'object.gpu-1',
      sourceUnitId: 'gpu_s',
      sourceQuantity: 3_600n,
      oracleFactIds: ['fact.gpu.1'],
      batchId: undefined,
    });
    const ai = manufacturingObservation({
      category: 'AI_COMPUTE',
      economicEventId: 'event.ai.1',
      claimId: 'claim.ai',
      contributionId: 'contrib.ai',
      objectId: 'object.gpu-1',
      sourceUnitId: 'gpu_s',
      sourceQuantity: 3_600n,
      oracleFactIds: ['fact.gpu.1'],
      batchId: undefined,
    });
    assert.equal(reserve(book, compute, 'd-compute').ok, true);
    const second = reserve(book, ai, 'd-ai');
    assert.equal(second.ok, false);
  });

  it('17. retries are idempotent and do not consume attribution twice', () => {
    const book = new ProductiveAttributionBook();
    const observation = manufacturingObservation();
    const first = reserve(book, observation, 'd-retry');
    const retry = reserve(book, observation, 'd-retry');
    assert.equal(first.ok, true);
    assert.equal(retry.ok, true);
    if (first.ok && retry.ok) {
      assert.equal(retry.idempotentReplay, true);
      assert.equal(retry.value.entryId, first.value.entryId);
    }
    assert.equal(book.allocatedShareForEvent(observation.economicEventId), ATTRIBUTION_SHARE_SCALE);
  });

  it('18-19. correction and supersession preserve history', () => {
    const book = new ProductiveAttributionBook();
    const first = reserve(book, manufacturingObservation(), 'd1', ATTRIBUTION_SHARE_SCALE);
    if (!first.ok) {
      throw new Error('expected ok');
    }
    book.finalize(first.value.entryId);
    const replacementObs = manufacturingObservation({
      claimId: 'claim.mfg.corrected',
      contributionId: 'contrib.mfg.corrected',
    });
    const corrected = book.correct({
      targetEntryId: first.value.entryId,
      reason: 'misallocated manufacturing share',
      evidenceIds: ['ev.correction.1'],
      supersede: true,
      replacement: {
        observation: replacementObs,
        decision: simulationAttributionDecision(replacementObs, {
          attributionDecisionId: 'd-corrected',
          allocatedShare: ATTRIBUTION_SHARE_SCALE / 2n,
        }),
        expectedPolicyVersion: 1,
      },
    });
    if (!corrected.ok) {
      throw new Error('expected ok');
    }
    const original = book.getEntry(first.value.entryId);
    assert.equal(original?.status, 'SUPERSEDED');
    assert.ok(book.snapshotCorrections().length === 1);
    assert.equal(book.snapshotCorrections()[0]?.rewritesHistory, false);
    assert.equal(book.snapshotEntries().length >= 2, true);
  });

  it('20. settled corrections flag monetary review and do not claw back', () => {
    const book = new ProductiveAttributionBook();
    const first = reserve(book, manufacturingObservation(), 'd1');
    if (!first.ok) {
      throw new Error('expected ok');
    }
    book.finalize(first.value.entryId);
    book.noteIssuanceStatus(first.value.entryId, 'SETTLED');
    const settled = book.correct({
      targetEntryId: first.value.entryId,
      reason: 'post-settlement correction',
      evidenceIds: ['ev.settled.1'],
      supersede: false,
    });
    assert.equal(settled.ok, false);
    if (!settled.ok) {
      assert.equal(settled.code, 'MONETARY_ADJUSTMENT_REVIEW_REQUIRED');
    }
    const original = book.getEntry(first.value.entryId);
    assert.equal(original?.status, 'RELEASED_BY_CORRECTION');
    assert.equal(original?.monetaryAdjustmentReviewRequired, true);
    assert.equal(book.snapshotCorrections()[0]?.clawbackExecuted, false);
  });

  it('requires a valid decision and available share before future productive value', () => {
    assert.equal(routeRequiresAttribution({ category: 'MANUFACTURING' }), true);
    assert.equal(routeRequiresAttribution({ category: 'ENERGY' }), false);
    const missing = evaluateContributionEligibility(manufacturingEligibility());
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.code, 'ATTRIBUTION_DECISION_REQUIRED');
    }

    const book = new ProductiveAttributionBook();
    const observation = manufacturingObservation({
      objectId: automatedFactory().objectId,
      controllerId: automatedFactory().controller,
    });
    const decision = simulationAttributionDecision(observation, { attributionDecisionId: 'd-elig' });
    const allowed = evaluateContributionEligibility(
      manufacturingEligibility({
        attributionBook: book,
        attributionDecision: decision,
        attributionRequest: { observation, decision, expectedPolicyVersion: 1 },
      }),
    );
    assert.equal(allowed.ok, true);

    const energyObject = solarFacility();
    const energy = evaluateContributionEligibility({
      ...manufacturingEligibility(),
      category: 'ENERGY',
      object: energyObject,
      actorId: energyObject.controller,
      objectEligible: true,
      sourceUnitId: 'kWh',
      sourceQuantity: 1_200n,
      oracleFacts: fixtureFacts({ objectId: energyObject.objectId, category: 'ENERGY', quantity: 1_200n, unit: 'kWh' }),
    });
    assert.equal(energy.ok, true);
  });

  it('rejects a policy version mismatch', () => {
    const book = new ProductiveAttributionBook();
    const observation = manufacturingObservation();
    const decision = simulationAttributionDecision(observation, {
      attributionDecisionId: 'd-ver',
      attributionPolicyVersion: 2,
    });
    const result = book.reserve({ observation, decision, expectedPolicyVersion: 1 });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'ATTRIBUTION_POLICY_VERSION_MISMATCH');
    }
  });

  it('reflects lineage into the Economic Asset Registry without storing accounting state', () => {
    const registry = new EconomicAssetRegistry();
    const adapter = createProductiveEconomicAssetAdapter(registry);
    const at = asUtcInstant('2026-08-19T12:00:00.000Z');
    const object = automatedFactory();
    const claim = fixtureClaim({
      claimId: 'claim.mfg.1',
      objectId: object.objectId,
      claimType: 'OUTPUT',
      category: 'MANUFACTURING',
      quantity: 100n,
      unit: 'UNIT',
    });
    const projectedObject = adapter.projectObject(object, at);
    assert.equal(projectedObject.ok, true);
    const projectedClaim = adapter.projectClaim({
      claim,
      objectAssetId: projectedObject.ok ? projectedObject.value.assetId : undefined,
      at,
    });
    assert.equal(projectedClaim.ok, true);
    if (!projectedClaim.ok || !projectedObject.ok) {
      throw new Error('expected ok');
    }
    const book = new ProductiveAttributionBook();
    const reserved = reserve(book, manufacturingObservation(), 'd-ear');
    if (!reserved.ok) {
      throw new Error('expected ok');
    }
    const reflected = reflectAttributionLineage({
      registry,
      contributionAssetId: projectedClaim.value.assetId,
      eventAssetId: projectedObject.value.assetId,
      entry: reserved.value,
      at,
    });
    assert.equal(reflected.ok, true);
    if (reflected.ok) {
      assert.ok(reflected.value.lineage.some((edge) => edge.kind === 'ATTESTED_BY'));
      assert.equal('allocatedShare' in reflected.value, false);
    }
    assert.equal(refuseRawAttributionDatasetStore().ok, false);
  });

  it('prints the reconciliation demo invariants', () => {
    const demo = runMoonReyAttributionReconciliationDemo();
    assert.equal(demo.overAllocatedEvents, 0);
    assert.equal(demo.replayIncreasedAttribution, false);
    assert.equal(demo.categoryRelabelIncreasedAttribution, false);
    assert.equal(demo.attributionBookIsMonetaryLedger, false);
    assert.equal(demo.productionActive, false);
  });
});
