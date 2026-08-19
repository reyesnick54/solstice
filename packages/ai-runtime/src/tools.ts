import { err, ok, type Result } from '../../domain/src/result.ts';
import { isForbiddenAiTool } from './taxonomy.ts';
import type { AiProviderFailure, AiToolIntent, AiToolResult } from './types.ts';

export type ToolIntentContext = {
  readonly actorId: string;
  readonly mandateId: string | null;
  readonly agentId: string | null;
};

/**
 * Brokers translate bounded tool intents into later SunRey service calls.
 * They never execute payments, trades, mint, burn, or key operations.
 */
export type ToolIntentBroker = {
  readonly brokerId: string;
  handle(intent: AiToolIntent, context: ToolIntentContext): Result<AiToolResult, AiProviderFailure>;
};

export class RefuseExecuteToolIntentBroker implements ToolIntentBroker {
  readonly brokerId = 'refuse-execute';

  handle(intent: AiToolIntent, _context: ToolIntentContext): Result<AiToolResult, AiProviderFailure> {
    if (isForbiddenAiTool(intent.name) || intent.executes) {
      return err({
        ok: false,
        code: 'FORBIDDEN_TOOL_REQUESTED',
        detail: `${intent.name} cannot execute from the inference plane`,
        providerKind: null,
      });
    }
    if (intent.name.startsWith('READ_')) {
      return ok(
        Object.freeze({
          intentId: intent.intentId,
          name: intent.name,
          ok: true,
          detail: 'read intent accepted; no financial mutation',
          proposalId: null,
          executed: false,
        }),
      );
    }
    return ok(
      Object.freeze({
        intentId: intent.intentId,
        name: intent.name,
        ok: true,
        detail: 'preparation intent requires the canonical SunRey agent ProposalGate path',
        proposalId: null,
        executed: false,
      }),
    );
  }
}

export function preparationRequiresAgentPath(intent: AiToolIntent): boolean {
  return (
    intent.name === 'PREPARE_PAYMENT' ||
    intent.name === 'PREPARE_EXCHANGE_ORDER' ||
    intent.name === 'PREPARE_REBALANCE' ||
    intent.name === 'REQUEST_HUMAN_APPROVAL'
  );
}
