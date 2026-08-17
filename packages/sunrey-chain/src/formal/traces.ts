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

export function allDevelopmentTraces(): readonly LogicalTrace[] {
  return [
    consensusHappyTrace(),
    assetHappyTrace(),
    dvpHappyTrace(),
    moonreyHappyTrace(),
    governanceHappyTrace(),
    interopHappyTrace(),
  ];
}
