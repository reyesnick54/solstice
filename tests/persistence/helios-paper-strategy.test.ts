import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import {
  HELIOS_H14_REFERENCE_PRICE_ENTRY_V1,
  InMemoryHeliosPaperStrategyStore,
  type HeliosPaperGrowProposal,
  type HeliosPaperGrowResult,
  type HeliosPaperPosition,
} from '../../packages/platform/src/helios/index.ts';
import {
  loadHeliosPaperStrategyState,
  persistHeliosPaperStrategyState,
} from '../../packages/persistence/src/index.ts';
import { paperCycleIdFor, paperPositionIdFor, paperProposalIdFor, workOrderIdFor } from '../../packages/platform/src/helios/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;
const NOW = asUtcInstant('2026-09-15T14:00:00.000Z');

describePersistence('HELIOS H14 persistence', () => {
  it('paper strategy state survives restart', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const pool = durable.session.pools.customer;
    const store = new InMemoryHeliosPaperStrategyStore();
    const workOrderId = workOrderIdFor('cust_persist_h14', '001');
    const proposalId = paperProposalIdFor(workOrderId, 'persist');
    const positionId = paperPositionIdFor(workOrderId, 'SIM-ETF-1');
    const cycleId = paperCycleIdFor(workOrderId, 'task_persist');

    const proposal: HeliosPaperGrowProposal = Object.freeze({
      proposalId,
      workOrderId,
      customerId: asCustomerId('cust_persist_h14'),
      subjectId: 'id_persist_h14',
      sandboxAllocationMinor: '50000',
      sandboxAllocationCurrency: 'USD',
      instrumentId: 'SIM-ETF-1',
      direction: 'BUY',
      quantityUnits: '1000000000',
      notional: Object.freeze({ minorUnits: '10000', currency: 'USD' }),
      referencePrice: Object.freeze({ minorUnits: '10000', currency: 'USD' }),
      evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
      research: Object.freeze({
        researchId: 'hr_persist',
        strategyId: HELIOS_H14_REFERENCE_PRICE_ENTRY_V1,
        hypothesis: 'persist test',
        synthesizedAt: NOW,
        evidenceRefs: Object.freeze(['ev_external_market_obs_001']),
        referencePrice: Object.freeze({ minorUnits: '10000', currency: 'USD' }),
        referenceAsOf: NOW,
        informationTimeObservedAt: NOW,
        informationTimeArrivedAt: NOW,
        deterministic: true,
        llmSourced: false,
      }),
      strategyDecision: Object.freeze({
        strategyId: HELIOS_H14_REFERENCE_PRICE_ENTRY_V1,
        action: 'BUY',
        instrumentId: 'SIM-ETF-1',
        quantityUnits: '1000000000',
        rationale: 'persist',
        ruleVersion: 'v1',
        entryThresholdMinor: '10100',
        exitThresholdMinor: '10300',
        referenceMidMinor: '10000',
        decidedAt: NOW,
      }),
      rationale: 'persist',
      invalidationConditions: Object.freeze(['expire']),
      expiresAt: NOW,
      environment: 'PAPER',
      state: 'EXECUTED',
      createdAt: NOW,
      updatedAt: NOW,
      grantsFinancialEffect: false,
    });

    const position: HeliosPaperPosition = Object.freeze({
      positionId,
      customerId: asCustomerId('cust_persist_h14'),
      workOrderId,
      strategyId: HELIOS_H14_REFERENCE_PRICE_ENTRY_V1,
      instrumentId: 'SIM-ETF-1',
      quantityUnits: '1000000000',
      costBasis: Object.freeze({ minorUnits: '10015', currency: 'USD' }),
      status: 'OPEN',
      entryFills: Object.freeze([]),
      exitFills: Object.freeze([]),
      referenceValuation: Object.freeze({ minorUnits: '10000', currency: 'USD' }),
      feesAssumed: Object.freeze({ minorUnits: '0', currency: 'USD' }),
      realizedResult: null,
      unrealizedResult: null,
      environment: 'PAPER',
      liveProviderPosition: false,
      openedAt: NOW,
      closedAt: null,
    });

    const cycle: HeliosPaperGrowResult = Object.freeze({
      cycleId,
      proposalId,
      positionId,
      outcome: 'EXECUTED',
      attributionClass: 'PAPER',
      grossResult: Object.freeze({ minorUnits: '10000', currency: 'USD' }),
      netResult: Object.freeze({ minorUnits: '10015', currency: 'USD' }),
      feesIncluded: Object.freeze({ minorUnits: '0', currency: 'USD' }),
      reasonCodes: Object.freeze(['OK']),
      evidenceChainRefs: Object.freeze([]),
      completedAt: NOW,
    });

    store.putProposal(proposal);
    store.putPosition(position);
    store.putCycle(cycle);
    store.markTaskCompleted('task_persist');

    await persistHeliosPaperStrategyState(pool, store.snapshot());
    const reloaded = await loadHeliosPaperStrategyState(pool);
    assert.equal(reloaded.proposals.length, 1);
    assert.equal(reloaded.positions.length, 1);
    assert.equal(reloaded.cycles.length, 1);
    assert.equal(reloaded.proposals[0]?.environment, 'PAPER');
    assert.equal(reloaded.positions[0]?.liveProviderPosition, false);
    assert.equal(reloaded.completedTaskIds.includes('task_persist'), true);
  });
});
