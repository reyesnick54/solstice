import type { FormalModelId, LogicalTrace, LogicalTraceEvent, TraceDomain } from './types.ts';

export function sanitizeTraceEvent(event: LogicalTraceEvent): LogicalTraceEvent {
  const args: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(event.args)) {
    if (/secret|key|seed|password|token|signature/i.test(key)) {
      continue;
    }
    args[key] = value;
  }
  return { domain: event.domain, action: event.action, args };
}

export function makeTrace(
  id: string,
  domain: TraceDomain,
  modelId: FormalModelId,
  events: readonly LogicalTraceEvent[],
): LogicalTrace {
  return {
    id,
    domain,
    modelId,
    events: events.map((event) => sanitizeTraceEvent({ ...event, domain })),
  };
}

export function consensusHappyTrace(): LogicalTrace {
  return makeTrace('trace_consensus_commit', 'consensus', 'CONSENSUS_SAFETY', [
    { domain: 'consensus', action: 'Propose(A)', args: { height: 1, round: 0, value: 'A' } },
    { domain: 'consensus', action: 'Prevote(V1,A)', args: { validator: 'V1', value: 'A' } },
    { domain: 'consensus', action: 'Prevote(V2,A)', args: { validator: 'V2', value: 'A' } },
    { domain: 'consensus', action: 'Prevote(V3,A)', args: { validator: 'V3', value: 'A' } },
    { domain: 'consensus', action: 'Lock(A)', args: { value: 'A' } },
    { domain: 'consensus', action: 'Precommit(V1,A)', args: { validator: 'V1', value: 'A' } },
    { domain: 'consensus', action: 'Precommit(V2,A)', args: { validator: 'V2', value: 'A' } },
    { domain: 'consensus', action: 'Precommit(V3,A)', args: { validator: 'V3', value: 'A' } },
    { domain: 'consensus', action: 'Commit(A)', args: { height: 1, value: 'A' } },
  ]);
}

export function assetHappyTrace(): LogicalTrace {
  return makeTrace('trace_asset_cycle', 'asset', 'NATIVE_ASSET_CONSERVATION', [
    { domain: 'asset', action: 'Issue(SUNREY_COIN)', args: { asset: 'SUNREY_COIN' } },
    { domain: 'asset', action: 'Lock(SUNREY_COIN)', args: { asset: 'SUNREY_COIN' } },
    { domain: 'asset', action: 'Unlock(SUNREY_COIN)', args: { asset: 'SUNREY_COIN' } },
    { domain: 'asset', action: 'Transfer(SUNREY_COIN)', args: { asset: 'SUNREY_COIN' } },
    { domain: 'asset', action: 'Burn(SUNREY_COIN)', args: { asset: 'SUNREY_COIN' } },
  ]);
}

export function dvpHappyTrace(): LogicalTrace {
  return makeTrace('trace_dvp_settle', 'exchange_dvp', 'EXCHANGE_ATOMIC_DVP', [
    { domain: 'exchange_dvp', action: 'SettleAllLegs', args: { base: 'SUNREY_COIN', quote: 'MOONREY_COIN' } },
  ]);
}

export function moonreyHappyTrace(): LogicalTrace {
  return makeTrace('trace_moonrey_issue', 'moonrey_issuance', 'MOONREY_ISSUANCE', [
    { domain: 'moonrey_issuance', action: 'Issue(authorized)', args: { authorized: true } },
  ]);
}

export function moonreyPolicyGovernanceHappyTrace(): LogicalTrace {
  return makeTrace('trace_moonrey_policy', 'moonrey_policy_governance', 'MOONREY_POLICY_GOVERNANCE', [
    { domain: 'moonrey_policy_governance', action: 'Issue(authorized)', args: { authorized: true } },
    { domain: 'moonrey_policy_governance', action: 'ActivatePolicy(v2)', args: { version: 2 } },
  ]);
}

export function governanceHappyTrace(): LogicalTrace {
  return makeTrace('trace_governance_activate', 'governance', 'PROTOCOL_GOVERNANCE', [
    { domain: 'governance', action: 'Propose', args: {} },
    { domain: 'governance', action: 'Vote(V1,APPROVE)', args: { voter: 'V1' } },
    { domain: 'governance', action: 'Vote(V2,APPROVE)', args: { voter: 'V2' } },
    { domain: 'governance', action: 'Vote(V3,APPROVE)', args: { voter: 'V3' } },
    { domain: 'governance', action: 'Authorize', args: {} },
    { domain: 'governance', action: 'Schedule', args: {} },
    { domain: 'governance', action: 'AdvanceHeight', args: {} },
    { domain: 'governance', action: 'AdvanceHeight', args: {} },
    { domain: 'governance', action: 'Activate', args: { height: 2 } },
  ]);
}

export function interopHappyTrace(): LogicalTrace {
  return makeTrace('trace_interop_packet', 'interop', 'INTEROP_PACKET_STATE', [
    { domain: 'interop', action: 'Send', args: { channel: 'ch_dev', sequence: 1 } },
    { domain: 'interop', action: 'Receive', args: { channel: 'ch_dev', sequence: 1 } },
    { domain: 'interop', action: 'Ack', args: { channel: 'ch_dev', sequence: 1 } },
  ]);
}

export function adaptiveFeeHappyTrace(): LogicalTrace {
  return makeTrace('trace_adaptive_fee', 'adaptive_fee', 'ADAPTIVE_FEE_MARKET', [
    { domain: 'adaptive_fee', action: 'UpdatePriceHigh', args: { usage: 2 } },
    { domain: 'adaptive_fee', action: 'Reserve', args: {} },
    { domain: 'adaptive_fee', action: 'ChargeWithinMax', args: {} },
  ]);
}

export function validatorEconomicsHappyTrace(): LogicalTrace {
  return makeTrace('trace_validator_economics', 'validator_economics', 'VALIDATOR_ECONOMICS', [
    { domain: 'validator_economics', action: 'Bond', args: { quantity: 1 } },
    { domain: 'validator_economics', action: 'CreditPool', args: { amount: 1 } },
    { domain: 'validator_economics', action: 'Reward', args: {} },
    { domain: 'validator_economics', action: 'AdvanceEpoch', args: {} },
    { domain: 'validator_economics', action: 'RequestUnbond', args: {} },
    { domain: 'validator_economics', action: 'AdvanceEpoch', args: {} },
    { domain: 'validator_economics', action: 'ReleaseUnbond', args: {} },
  ]);
}

export function monetaryHappyTrace(): LogicalTrace {
  return makeTrace('trace_monetary_policy', 'monetary_policy', 'NATIVE_MONETARY_POLICY', [
    { domain: 'monetary_policy', action: 'Issue(SUNREY_COIN)', args: { asset: 'SUNREY_COIN' } },
    { domain: 'monetary_policy', action: 'Lock(SUNREY_COIN)', args: { asset: 'SUNREY_COIN' } },
    { domain: 'monetary_policy', action: 'Unlock(SUNREY_COIN)', args: { asset: 'SUNREY_COIN' } },
    { domain: 'monetary_policy', action: 'Burn(SUNREY_COIN)', args: { asset: 'SUNREY_COIN' } },
    { domain: 'monetary_policy', action: 'Issue(MOONREY_COIN)', args: { asset: 'MOONREY_COIN' } },
  ]);
}

export function governanceOpsHappyTrace(): LogicalTrace {
  return makeTrace('trace_governance_ops_activate', 'governance_operations', 'GOVERNANCE_OPERATION_SAFETY', [
    { domain: 'governance_operations', action: 'ApproveHuman', args: {} },
    { domain: 'governance_operations', action: 'ApproveHuman', args: {} },
    { domain: 'governance_operations', action: 'MarkApproved', args: {} },
    { domain: 'governance_operations', action: 'Schedule', args: {} },
    { domain: 'governance_operations', action: 'AdvanceHeight', args: {} },
    { domain: 'governance_operations', action: 'AdvanceHeight', args: {} },
    { domain: 'governance_operations', action: 'Activate', args: { height: 2 } },
  ]);
}

export function genesisHappyTrace(): LogicalTrace {
  return makeTrace('trace_genesis_allocation', 'genesis_allocation', 'GENESIS_ALLOCATION_CONSERVATION', [
    { domain: 'genesis_allocation', action: 'Allocate(SUNREY_COIN)', args: { asset: 'SUNREY_COIN' } },
    { domain: 'genesis_allocation', action: 'Allocate(MOONREY_COIN)', args: { asset: 'MOONREY_COIN' } },
  ]);
}

export function protocolTreasuryHappyTrace(): LogicalTrace {
  return makeTrace('trace_protocol_treasury', 'protocol_treasury', 'PROTOCOL_TREASURY', [
    { domain: 'protocol_treasury', action: 'Reserve', args: {} },
    { domain: 'protocol_treasury', action: 'Finalize', args: {} },
  ]);
}

export function crossEconomicHappyTrace(): LogicalTrace {
  return makeTrace('trace_cross_economic', 'cross_economic', 'CROSS_ECONOMIC_INVARIANTS', [
    { domain: 'cross_economic', action: 'IssueSunRey', args: {} },
    { domain: 'cross_economic', action: 'ChargeFee', args: {} },
    { domain: 'cross_economic', action: 'AuthorizeMoonRey', args: {} },
    { domain: 'cross_economic', action: 'IssueMoonRey', args: {} },
  ]);
}

export function genesisExecutionHappyTrace(): LogicalTrace {
  return makeTrace('trace_genesis_execution', 'genesis_execution', 'GENESIS_EXECUTION_AUTHORIZATION', [
    { domain: 'genesis_execution', action: 'VerifyPlan', args: {} },
    { domain: 'genesis_execution', action: 'ApproveHuman', args: {} },
    { domain: 'genesis_execution', action: 'ApproveHuman', args: {} },
    { domain: 'genesis_execution', action: 'CompleteAuthorization', args: {} },
    { domain: 'genesis_execution', action: 'IssuePermit', args: {} },
    { domain: 'genesis_execution', action: 'ExecuteGenesis', args: {} },
    { domain: 'genesis_execution', action: 'FinalizeFirstBlock', args: {} },
    { domain: 'genesis_execution', action: 'VerifyInitialChain', args: {} },
  ]);
}

export function allDevelopmentTraces(): readonly LogicalTrace[] {
  return [
    consensusHappyTrace(),
    assetHappyTrace(),
    dvpHappyTrace(),
    moonreyHappyTrace(),
    moonreyPolicyGovernanceHappyTrace(),
    governanceHappyTrace(),
    interopHappyTrace(),
    adaptiveFeeHappyTrace(),
    validatorEconomicsHappyTrace(),
    monetaryHappyTrace(),
    genesisHappyTrace(),
    governanceOpsHappyTrace(),
    protocolTreasuryHappyTrace(),
    crossEconomicHappyTrace(),
    genesisExecutionHappyTrace(),
  ];
}
