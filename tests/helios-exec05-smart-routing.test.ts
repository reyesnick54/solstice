/**
 * HELIOS EXEC05 — smart order router and best-execution evidence engine.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  EXEC05_SANDBOX_VENUE_CANDIDATES,
  HELIOS_EXEC05_SMART_ROUTING_QUALIFIED,
  ROUTING_SCORE_COMPONENTS,
  SmartOrderRouter,
  evaluateExec05SmartRoutingQualification,
  generateBestExecutionEvidence,
} from '../packages/platform/src/helios/execution-connectivity/exec05/index.ts';
import { asEconomicWorkOrderId } from '../packages/platform/src/helios/ids.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const T0 = asUtcInstant('2026-11-07T16:00:00.000Z');
const CUSTOMER = asCustomerId('cust_exec05');

describe('HELIOS EXEC05 smart order routing', () => {
  it('selects lowest expected implementation cost, not highest rebate', () => {
    const router = new SmartOrderRouter();
    const decision = router.route(
      Object.freeze({
        requestId: 'req_exec05_cost',
        customerId: CUSTOMER,
        workOrderId: asEconomicWorkOrderId('ewo_exec05'),
        instrumentId: 'SIM-ETF-1',
        orderAction: 'BUY',
        orderSizeMinorUnits: '100000',
        currency: 'USD',
        urgency: 'NORMAL',
        at: T0,
        directedInstruction: null,
        candidates: EXEC05_SANDBOX_VENUE_CANDIDATES,
      }),
    );
    assert.equal(decision.outcome, 'VENUE_SELECTED');
    assert.equal(decision.selectionMode, 'HELIOS_OPTIMIZED');
    assert.equal(decision.selectedVenueId, 'ARCX');
    assert.notEqual(decision.selectedVenueId, 'SIM_EXCHANGE');
    assert.ok(decision.scorecard);
    assert.equal(decision.scorecard!.transparencyNote, 'COMPONENTS_ONLY_NO_ML_BLEND');
    assert.equal(decision.grantsExecutionAuthority, false);
    assert.equal(decision.authorizesFinancialExecution, false);
  });

  it('exposes every routing score component transparently', () => {
    const router = new SmartOrderRouter();
    const decision = router.route(
      Object.freeze({
        requestId: 'req_exec05_components',
        customerId: CUSTOMER,
        workOrderId: asEconomicWorkOrderId('ewo_exec05_b'),
        instrumentId: 'SIM-ETF-1',
        orderAction: 'BUY',
        orderSizeMinorUnits: '100000',
        currency: 'USD',
        urgency: 'HIGH',
        at: T0,
        directedInstruction: null,
        candidates: EXEC05_SANDBOX_VENUE_CANDIDATES,
      }),
    );
    const names = new Set(decision.scorecard?.components.map((row) => row.component));
    for (const component of ROUTING_SCORE_COMPONENTS) {
      assert.ok(names.has(component), `missing score component ${component}`);
    }
  });

  it('records DIRECTED routing without representing it as HELIOS optimization', () => {
    const router = new SmartOrderRouter();
    const decision = router.route(
      Object.freeze({
        requestId: 'req_exec05_directed',
        customerId: CUSTOMER,
        workOrderId: asEconomicWorkOrderId('ewo_exec05_c'),
        instrumentId: 'SIM-ETF-1',
        orderAction: 'BUY',
        orderSizeMinorUnits: '100000',
        currency: 'USD',
        urgency: 'NORMAL',
        at: T0,
        directedInstruction: Object.freeze({
          directiveId: 'dir_1',
          requiredVenueId: 'SIM_EXCHANGE',
          requiredProviderId: 'sunrey-investments-paper',
          requiredAccountId: 'acct_paper_equity_sandbox',
          customerDirected: true,
          mandateRef: 'mandate_venue_pin',
        }),
        candidates: EXEC05_SANDBOX_VENUE_CANDIDATES,
      }),
    );
    assert.equal(decision.selectionMode, 'DIRECTED');
    assert.equal(decision.directedInstructionHonored, true);
    assert.equal(decision.selectedVenueId, 'SIM_EXCHANGE');
    assert.match(decision.selectionReason, /DIRECTED/);
    assert.match(decision.selectionReason, /not represented as HELIOS cost optimization/);
  });

  it('generates periodic route-review engineering evidence', () => {
    const evidence = generateBestExecutionEvidence({
      windowStart: asUtcInstant('2026-11-01T00:00:00.000Z'),
      windowEnd: asUtcInstant('2026-11-07T00:00:00.000Z'),
      generatedAt: T0,
      observations: Object.freeze([
        Object.freeze({
          venueId: 'ARCX',
          providerId: 'sunrey-investments-paper',
          filled: true,
          priceImprovementBps: 2,
          slippageBps: 1,
          rejected: false,
          latencyMs: 10,
          canceled: false,
          observedAt: T0,
        }),
        Object.freeze({
          venueId: 'ARCX',
          providerId: 'sunrey-investments-paper',
          filled: false,
          priceImprovementBps: 0,
          slippageBps: 0,
          rejected: true,
          latencyMs: 15,
          canceled: false,
          observedAt: T0,
        }),
      ]),
    });
    assert.equal(evidence.disclaimer, 'ENGINEERING_EVIDENCE_NOT_LEGAL_BEST_EXECUTION_CERTIFICATION');
    assert.equal(evidence.venueMetrics.length, 1);
    assert.equal(evidence.venueMetrics[0]!.fillRatePpm, 500_000);
    assert.equal(evidence.venueMetrics[0]!.rejectRatePpm, 500_000);
  });

  it('emits HELIOS_EXEC05_SMART_ROUTING_QUALIFIED when mandatory checks pass', () => {
    const router = new SmartOrderRouter();
    const optimized = router.route(
      Object.freeze({
        requestId: 'req_exec05_qualify',
        customerId: CUSTOMER,
        workOrderId: asEconomicWorkOrderId('ewo_exec05_q'),
        instrumentId: 'SIM-ETF-1',
        orderAction: 'BUY',
        orderSizeMinorUnits: '100000',
        currency: 'USD',
        urgency: 'NORMAL',
        at: T0,
        directedInstruction: null,
        candidates: EXEC05_SANDBOX_VENUE_CANDIDATES,
      }),
    );
    const directed = router.route(
      Object.freeze({
        requestId: 'req_exec05_qualify_directed',
        customerId: CUSTOMER,
        workOrderId: asEconomicWorkOrderId('ewo_exec05_q2'),
        instrumentId: 'SIM-ETF-1',
        orderAction: 'BUY',
        orderSizeMinorUnits: '100000',
        currency: 'USD',
        urgency: 'NORMAL',
        at: T0,
        directedInstruction: Object.freeze({
          directiveId: 'dir_q',
          requiredVenueId: 'ARCX',
          requiredProviderId: null,
          requiredAccountId: null,
          customerDirected: true,
          mandateRef: 'mandate_ref',
        }),
        candidates: EXEC05_SANDBOX_VENUE_CANDIDATES,
      }),
    );
    const evidence = generateBestExecutionEvidence({
      windowStart: asUtcInstant('2026-11-01T00:00:00.000Z'),
      windowEnd: asUtcInstant('2026-11-07T00:00:00.000Z'),
      generatedAt: T0,
      observations: Object.freeze([
        Object.freeze({
          venueId: 'ARCX',
          providerId: 'sunrey-investments-paper',
          filled: true,
          priceImprovementBps: 1,
          slippageBps: 1,
          rejected: false,
          latencyMs: 9,
          canceled: false,
          observedAt: T0,
        }),
      ]),
    });

    const result = evaluateExec05SmartRoutingQualification({
      transparentScoreComponents: (optimized.scorecard?.components.length ?? 0) >= ROUTING_SCORE_COMPONENTS.length,
      noOpaqueMlScore: optimized.scorecard?.transparencyNote === 'COMPONENTS_ONLY_NO_ML_BLEND',
      minimizesImplementationCost: optimized.selectedVenueId === 'ARCX',
      rebateNotSoleSelector: optimized.selectedVenueId !== 'SIM_EXCHANGE',
      commercialPreferenceNotSoleSelector: optimized.selectedVenueId !== 'SIM_EXCHANGE',
      directedRoutingLabeled: directed.selectionMode === 'DIRECTED',
      periodicReviewEvidence: evidence.venueMetrics.length > 0,
      noExecutionAuthorityIssued:
        optimized.grantsExecutionAuthority === false &&
        optimized.authorizesFinancialExecution === false &&
        LIVE_TRADING_ENABLED === false,
    });
    assert.equal(result.marker, HELIOS_EXEC05_SMART_ROUTING_QUALIFIED);
    assert.equal(result.qualified, true);
  });

  it('passes HELIOS boundary lint for execution-connectivity module', () => {
    const findings = lintHeliosBoundary(process.cwd()).filter((row) =>
      row.file.includes('helios/execution-connectivity'),
    );
    assert.deepEqual(findings, []);
  });
});
