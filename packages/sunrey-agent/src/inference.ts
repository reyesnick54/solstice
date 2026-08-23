import { err, ok, type Result } from '../../domain/src/result.ts';
import {
  preparationRequiresAgentPath,
  type AiInferenceResponse,
  type AiRuntime,
  type AiToolIntent,
} from '../../ai-runtime/src/index.ts';
import type { UserAgentMandateEngine, CreateProposalInput } from './engine.ts';
import type { AgentTransactionProposal, MandateRefusal } from './types.ts';

/**
 * Inference port: the Financial Agent obtains reasoning and structured
 * tool intents from packages/ai-runtime. Resulting proposals still go
 * through UserAgentMandateEngine and ProposalGate.
 */
export type AiRuntimePort = {
  infer: AiRuntime['infer'];
  stream?: AiRuntime['infer'];
};

export function proposalInputFromToolIntent(input: {
  readonly mandateId: string;
  readonly intent: AiToolIntent;
  readonly modelRef: string;
  readonly networkId: string;
}): CreateProposalInput | MandateRefusal {
  if (!preparationRequiresAgentPath(input.intent) || input.intent.executes) {
    return {
      ok: false,
      code: 'ACTION_CLASS_NOT_PERMITTED',
      detail: 'only bounded prepare/read-approval intents may enter the agent proposal path',
    };
  }
  if (!input.intent.quantity || !input.intent.assetId || !input.intent.destinationOrMarket) {
    return { ok: false, code: 'ACTION_CLASS_NOT_PERMITTED', detail: 'prepare intent is missing integer quantity fields' };
  }
  return {
    mandateId: input.mandateId,
    intent: input.intent.name,
    reasonCode: 'AI_RUNTIME_TOOL_INTENT',
    strategyRef: null,
    assetId: input.intent.assetId,
    quantity: BigInt(input.intent.quantity.minorUnits),
    destinationOrMarket: input.intent.destinationOrMarket,
    fees: input.intent.fees ? BigInt(input.intent.fees.minorUnits) : 0n,
    expectedOutcomeClass:
      input.intent.name === 'PREPARE_EXCHANGE_ORDER'
        ? 'EXCHANGE_ORDER_PREPARED'
        : input.intent.name === 'REQUEST_HUMAN_APPROVAL'
          ? 'HUMAN_APPROVAL_REQUESTED'
          : input.intent.name === 'PREPARE_REBALANCE'
            ? 'REBALANCE_PREPARED'
            : 'PAYMENT_PREPARED',
    operationalRationale: input.intent.rationale,
    modelRef: input.modelRef,
    networkId: input.networkId,
  };
}

export function createProposalFromInference(
  engine: UserAgentMandateEngine,
  input: {
    readonly mandateId: string;
    readonly response: AiInferenceResponse;
    readonly networkId: string;
  },
): Result<AgentTransactionProposal, MandateRefusal> {
  if (input.response.grantsExecutionAuthority !== false) {
    return err({
      ok: false,
      code: 'AI_CANNOT_SIGN',
      detail: 'provider output cannot grant execution authority',
    });
  }
  const prepare = input.response.toolIntents.find((intent) => preparationRequiresAgentPath(intent));
  if (!prepare) {
    return err({
      ok: false,
      code: 'ACTION_CLASS_NOT_PERMITTED',
      detail: 'inference produced no prepare intent for the agent proposal path',
    });
  }
  const drafted = proposalInputFromToolIntent({
    mandateId: input.mandateId,
    intent: prepare,
    modelRef: `${input.response.modelRef.modelId}@${input.response.modelRef.version}`,
    networkId: input.networkId,
  });
  if ('ok' in drafted && drafted.ok === false) {
    return err(drafted);
  }
  return engine.createProposal(drafted as CreateProposalInput);
}

export function inferenceCannotExecute(response: AiInferenceResponse): boolean {
  return response.grantsExecutionAuthority === false && response.toolIntents.every((intent) => intent.executes === false);
}
