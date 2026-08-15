import { createHash } from 'node:crypto';

import type { ModelRegistry } from '../../model-registry/src/registry.ts';
import type { RiskOutcome } from '../../risk/src/types.ts';
import { asCapitalArbitrationId } from './ids.ts';
import type {
  ArbiterOutcome,
  CapitalArbitration,
  CapitalContext,
  CompiledAllocation,
  HardVeto,
  HardVetoReason,
  ModelRef,
  StrategyValidationState,
} from './types.ts';

export type ArbiterInput = {
  readonly context: CapitalContext;
  readonly compiled: CompiledAllocation;
  readonly modelRefs: readonly ModelRef[];
  readonly registry: ModelRegistry;
  readonly riskOutcome?: RiskOutcome;
  readonly schemaValid: boolean;
  readonly requiredFactsPresent: boolean;
  readonly contradictionBlocks: boolean;
};

function veto(reason: HardVetoReason, message: string): HardVeto {
  return Object.freeze({ reason, message, defeatedByConfidence: false });
}

export function materialModelsApproved(
  refs: readonly ModelRef[],
  registry: ModelRegistry,
): { readonly ok: boolean; readonly missing: readonly string[] } {
  const missing: string[] = [];
  for (const ref of refs) {
    const model = registry.get(ref.modelId, ref.version);
    if (!model || model.lifecycle !== 'APPROVED_FOR_SIMULATION') {
      missing.push(`${ref.modelId}@${ref.version}`);
    }
  }
  return { ok: missing.length === 0, missing: Object.freeze(missing) };
}

/**
 * Deterministic CapitalProposalArbiter. Not an AI. Agent votes cannot authorize.
 */
export function arbitrate(input: ArbiterInput): CapitalArbitration {
  const vetoes: HardVeto[] = [];
  if (!input.schemaValid) {
    vetoes.push(veto('STALE_CRITICAL_DATA', 'required output schema is incomplete'));
  }
  if (!input.requiredFactsPresent) {
    vetoes.push(veto('STALE_CRITICAL_DATA', 'required capital facts are missing'));
  }
  if (input.context.portfolio.accountRestricted) {
    vetoes.push(veto('ACCOUNT_RESTRICTED', 'investment account is restricted'));
  }
  if (!input.context.mandate.compatibleWithInvestment) {
    vetoes.push(veto('MANDATE_VIOLATION', 'active mandate does not permit considering investment activity'));
  }
  if (input.compiled.investableCapitalMinor <= 0n) {
    vetoes.push(veto('INSUFFICIENT_CAPITAL', 'no investable capital after protected liquidity and obligations'));
  }
  if (input.context.rdt.state === 'NOT_SUPPORTED') {
    vetoes.push(veto('RDT_NOT_SUPPORTED', 'Regulatory Digital Twin reports NOT_SUPPORTED'));
  }
  if (input.context.market.some((row) => row.stale)) {
    vetoes.push(veto('STALE_CRITICAL_DATA', 'critical market-data snapshot is stale'));
  }
  const models = materialModelsApproved(input.modelRefs, input.registry);
  if (!models.ok) {
    vetoes.push(
      veto('UNAPPROVED_MATERIAL_MODEL', `unregistered or unapproved material model: ${models.missing.join(',')}`),
    );
  }
  if (input.riskOutcome === 'BLOCK') {
    vetoes.push(veto('RISK_BLOCK', 'canonical Risk Engine decision is BLOCK'));
  }
  const unavailable = input.compiled.quantities.filter(
    (qty) => !input.context.universe.some((row) => row.instrumentId === qty.instrumentId && row.available),
  );
  if (unavailable.length > 0) {
    vetoes.push(veto('INSTRUMENT_UNAVAILABLE', 'compiled instrument is not available'));
  }

  let outcome: ArbiterOutcome;
  let strategy: StrategyValidationState = 'NEEDS_BACKTEST';
  if (vetoes.length > 0) {
    outcome = 'BLOCKED';
    strategy = 'REJECTED';
  } else if (!input.requiredFactsPresent) {
    outcome = 'NEEDS_MORE_DATA';
    strategy = 'UNVALIDATED';
  } else if (input.riskOutcome === 'REQUIRE_REVIEW' || input.contradictionBlocks) {
    outcome = 'NEEDS_HUMAN_REVIEW';
    strategy = 'PAPER_ONLY_PENDING_VALIDATION';
  } else if (
    input.context.rdt.state === 'RESEARCH_REQUIRED' ||
    input.context.rdt.state === 'COUNSEL_REVIEW_REQUIRED' ||
    input.context.rdt.legalReviewStatus === 'RESEARCH_REQUIRED'
  ) {
    outcome = 'NEEDS_BACKTEST';
    strategy = 'NEEDS_BACKTEST';
  } else {
    // Strategy Lab is not implemented; Mesh cannot claim VALIDATED or treat a
    // proposal as executable. NEEDS_BACKTEST is the correct ready-but-gated result.
    outcome = 'NEEDS_BACKTEST';
    strategy = 'NEEDS_BACKTEST';
  }

  const material = `${input.context.contextId}:${outcome}:${vetoes.map((item) => item.reason).join(',')}`;
  return Object.freeze({
    arbitrationId: asCapitalArbitrationId(`cmarb_${createHash('sha256').update(material).digest('hex').slice(0, 24)}`),
    outcome,
    vetoes: Object.freeze(vetoes),
    strategyValidation: strategy,
    requiredFactsMissing: Object.freeze(input.requiredFactsPresent ? [] : ['required capital facts']),
    notes: Object.freeze([
      'Arbiter is deterministic code, not an agent vote.',
      'Strategy Lab is not implemented; VALIDATED is unavailable.',
      `RDT state ${input.context.rdt.state} is preserved and is not regulatory approval.`,
    ]),
    agentVotesAuthorize: false,
  });
}

export function refuseAgentVoteAuthorization(_votesFor: bigint, _votesAgainst: bigint): {
  readonly authorized: false;
  readonly reason: string;
} {
  return Object.freeze({
    authorized: false,
    reason: 'Agent consensus has no execution authority. Majority vote cannot authorize a proposal.',
  });
}
