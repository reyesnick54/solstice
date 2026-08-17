/**
 * Export economic-rehearsal traces for Chunk 61 trace-conformance.
 */

import { checkTraceConformance } from '../formal/conformance.ts';
import type { LogicalTrace, TraceConformanceResult } from '../formal/types.ts';

function event(domain: LogicalTrace['domain'], action: string): LogicalTrace['events'][number] {
  return Object.freeze({ domain, action, args: Object.freeze({}) });
}

export function economicRehearsalTraces(): readonly LogicalTrace[] {
  return Object.freeze([
    {
      id: 'econ-reh-adaptive-fee',
      domain: 'adaptive_fee',
      modelId: 'ADAPTIVE_FEE_MARKET',
      events: Object.freeze([
        event('adaptive_fee', 'UpdatePriceHigh'),
        event('adaptive_fee', 'Reserve'),
        event('adaptive_fee', 'ChargeTreasury'),
      ]),
    },
    {
      id: 'econ-reh-validator-economics',
      domain: 'validator_economics',
      modelId: 'VALIDATOR_ECONOMICS',
      events: Object.freeze([
        event('validator_economics', 'Bond'),
        event('validator_economics', 'CreditPool'),
        event('validator_economics', 'Reward'),
        event('validator_economics', 'AdvanceEpoch'),
        event('validator_economics', 'RequestUnbond'),
        event('validator_economics', 'AdvanceEpoch'),
        event('validator_economics', 'ReleaseUnbond'),
      ]),
    },
    {
      id: 'econ-reh-monetary',
      domain: 'monetary_policy',
      modelId: 'NATIVE_MONETARY_POLICY',
      events: Object.freeze([
        event('monetary_policy', 'Issue(SUNREY_COIN)'),
        event('monetary_policy', 'Transfer(SUNREY_COIN)'),
        event('monetary_policy', 'Lock(SUNREY_COIN)'),
      ]),
    },
    {
      id: 'econ-reh-dvp',
      domain: 'exchange_dvp',
      modelId: 'EXCHANGE_ATOMIC_DVP',
      events: Object.freeze([event('exchange_dvp', 'SettleAllLegs')]),
    },
    {
      id: 'econ-reh-genesis-allocation',
      domain: 'genesis_allocation',
      modelId: 'GENESIS_ALLOCATION_CONSERVATION',
      events: Object.freeze([
        event('genesis_allocation', 'Allocate(SUNREY_COIN)'),
        event('genesis_allocation', 'Allocate(MOONREY_COIN)'),
      ]),
    },
    {
      id: 'econ-reh-governance',
      domain: 'governance',
      modelId: 'PROTOCOL_GOVERNANCE',
      events: Object.freeze([
        event('governance', 'Propose'),
        event('governance', 'Vote(V1,APPROVE)'),
        event('governance', 'Vote(V2,APPROVE)'),
        event('governance', 'Vote(V3,APPROVE)'),
        event('governance', 'Authorize'),
        event('governance', 'Schedule'),
        event('governance', 'AdvanceHeight'),
        event('governance', 'AdvanceHeight'),
        event('governance', 'Activate'),
      ]),
    },
  ]);
}

export function runEconomicTraceConformance(): readonly TraceConformanceResult[] {
  return checkTraceConformance(economicRehearsalTraces());
}
