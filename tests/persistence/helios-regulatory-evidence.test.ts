import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { asCustomerId } from '../../packages/domain/src/customer.ts';
import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import {
  RegulatoryEvidenceReportingService,
  regulatoryTraceIdFor,
  workOrderIdFor,
  type ConsequentialActionContext,
} from '../../packages/platform/src/helios/index.ts';
import {
  loadRegulatoryEvidenceState,
  persistRegulatoryEvidenceState,
} from '../../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;
const NOW = asUtcInstant('2026-09-18T09:30:00.000Z');

function actionContext(customerId: string): ConsequentialActionContext {
  const workOrderId = workOrderIdFor(customerId, 'persist_h29');
  const traceId = regulatoryTraceIdFor(workOrderId, 'persist');
  return Object.freeze({
    traceId,
    workOrderId,
    actionEventRef: 'evt_persist_complete',
    actionEventKind: 'HELIOS_PAPER_ORDER_COMPLETE',
    customerScope: Object.freeze({
      customerId: asCustomerId(customerId),
      accountIds: Object.freeze([`acct_${customerId}`]),
      customerClass: 'RETAIL',
      jurisdiction: asJurisdiction('US'),
    }),
    authorityContext: Object.freeze({
      mandateRef: `mandate_${customerId}`,
      approvalRef: null,
      legalEntityRef: 'le_sunrey_us_sim',
      providerId: 'sandbox_helios_investment_v1',
      capabilityPackVersion: 'helios-capability-pack-v1',
      policyVersion: 'helios-reporting-policy-v1-approved-fixture',
    }),
    intelligenceContext: Object.freeze({
      observationRefs: Object.freeze([]),
      observationTimestamps: Object.freeze([]),
      provenanceRefs: Object.freeze([]),
      modelVersion: null,
      researchResultRef: null,
      strategyCapsuleId: null,
      strategyCapsuleVersion: null,
      quantitativeAssumptionRefs: Object.freeze([]),
    }),
    controlDecisions: Object.freeze({
      riskDecisionRef: null,
      riskOutcome: 'ALLOW',
      kernelDecisionRef: 'kernel_persist',
      kernelOutcome: 'ALLOW',
      reasonCodes: Object.freeze(['OK']),
      envelopeId: null,
      executionAuthorityRef: null,
    }),
    financialRefs: Object.freeze({
      fundingRef: null,
      orderId: 'order_persist',
      acknowledgementRef: null,
      fillRefs: Object.freeze([]),
      feeRefs: Object.freeze([]),
      settlementRefs: Object.freeze([]),
      reconciliationRef: null,
      withdrawalRef: null,
      realizedStateRef: null,
      unrealizedStateRef: null,
    }),
    now: NOW,
    idempotencyKey: `idem_persist_${customerId}`,
  });
}

describePersistence('HELIOS H29 persistence', () => {
  it('16. restart persistence — no duplicate reports on replay', async () => {
    const env = await preparePersistence();
    const durable = await createDurableRuntime(env);
    const pool = durable.session.pools.customer;
    const clock = new FrozenClock(NOW);

    const service = new RegulatoryEvidenceReportingService({ clock });
    const ctx = actionContext('cust_persist_h29');
    service.createEvidencePackage(ctx);
    service.processOrderEventTrigger({
      ctx,
      orderId: 'order_persist',
      notionalMinorUnits: '10000000',
    });

    const snapshot = service.store.snapshot();
    await persistRegulatoryEvidenceState(pool, snapshot);

    const reloaded = new RegulatoryEvidenceReportingService({ clock });
    const loaded = await loadRegulatoryEvidenceState(pool);
    reloaded.store.restore(loaded);

    const replay = reloaded.processOrderEventTrigger({
      ctx,
      orderId: 'order_persist',
      notionalMinorUnits: '10000000',
    });
    assert.equal(replay.ok, true);
    if (!replay.ok) throw new Error('replay');

    assert.equal(reloaded.store.obligationsForTrace(ctx.traceId).length, 1);
    assert.equal(reloaded.store.packagesForTrace(ctx.traceId).length, 1);
    assert.equal(reloaded.store.hasIdempotencyKey(`trigger:${ctx.idempotencyKey}:ORDER_TRADING_EVENT`), true);

    const graph = reloaded.reconstruct(ctx.traceId);
    assert.ok(graph);
    assert.equal(graph!.execution.orderId, 'order_persist');
  });
});
