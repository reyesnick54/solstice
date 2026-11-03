import { asAgentConversationId, asAgentMessageId } from '../ids.ts';
import type { AgentMessage } from '../types.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';

export const DEFAULT_COMPACTION_TOKEN_BUDGET = 4000;
export const DEFAULT_COMPACTION_KEEP_RECENT = 8;

export type CompactionBoundary = {
  readonly boundaryIndex: number;
  readonly summary: string;
  readonly sourceHash: string;
};

export type CompactionResult = {
  readonly compacted: boolean;
  readonly messages: readonly AgentMessage[];
  readonly estimatedTokens: number;
  readonly boundary: CompactionBoundary | null;
};

function estimateTokens(messages: readonly AgentMessage[]): number {
  return messages.reduce((sum, message) => sum + Math.ceil(message.content.length / 4) + 8, 0);
}

function sourceHash(messages: readonly AgentMessage[]): string {
  return messages.map((m) => `${m.role}:${m.content}`).join('|');
}

function heuristicSummary(messages: readonly AgentMessage[]): string {
  return (
    '[Earlier conversation, abbreviated]\n' +
    messages
      .slice(0, 12)
      .map((m) => `${m.role}: ${m.content.slice(0, 240)}`)
      .join('\n')
  );
}

/**
 * In-memory session compaction inspired by Seris compactor.ts. Tool-call batches
 * are kept intact by only cutting on assistant message boundaries.
 */
export function compactConversationMessages(input: {
  readonly messages: readonly AgentMessage[];
  readonly priorBoundary?: CompactionBoundary | null;
  readonly tokenBudget?: number;
  readonly keepRecent?: number;
  readonly summarize?: (messages: readonly AgentMessage[]) => string;
}): CompactionResult {
  const budget = input.tokenBudget ?? DEFAULT_COMPACTION_TOKEN_BUDGET;
  const keepRecent = input.keepRecent ?? DEFAULT_COMPACTION_KEEP_RECENT;
  const summarize = input.summarize ?? heuristicSummary;

  const chronological = [...input.messages].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const prior = input.priorBoundary;
  const validPrior =
    prior &&
    prior.boundaryIndex > 0 &&
    prior.boundaryIndex <= chronological.length &&
    prior.sourceHash === sourceHash(chronological.slice(0, prior.boundaryIndex));

  let working = validPrior
    ? [
        systemCompactionMessage(prior.summary),
        ...chronological.slice(prior.boundaryIndex),
      ]
    : chronological;

  let estimated = estimateTokens(working);
  if (estimated <= budget) {
    return Object.freeze({
      compacted: !!validPrior,
      messages: Object.freeze(working),
      estimatedTokens: estimated,
      boundary: validPrior ? prior : null,
    });
  }

  const protectedStart = Math.max(0, chronological.length - keepRecent);
  const cuts: number[] = [];
  for (let i = 0; i < protectedStart; i += 1) {
    const message = chronological[i];
    if (message?.role === 'AGENT' || message?.role === 'USER') {
      cuts.push(i + 1);
    }
  }

  for (const cut of cuts) {
    if (cut <= (validPrior ? prior.boundaryIndex : 0)) {
      continue;
    }
    const tail = chronological.slice(cut);
    if (estimateTokens(tail) + 40 >= budget) {
      continue;
    }
    const old = validPrior
      ? [systemCompactionMessage(prior.summary), ...chronological.slice(prior.boundaryIndex, cut)]
      : chronological.slice(0, cut);
    let summary = summarize(old);
    working = [systemCompactionMessage(summary), ...tail];
    estimated = estimateTokens(working);
    while (estimated > budget && summary.length > 32) {
      summary = `${summary.slice(0, Math.floor(summary.length * 0.7))}\n[abbreviated]`;
      working = [systemCompactionMessage(summary), ...tail];
      estimated = estimateTokens(working);
    }
    if (estimated > budget) {
      continue;
    }
    const boundary: CompactionBoundary = Object.freeze({
      boundaryIndex: cut,
      summary,
      sourceHash: sourceHash(chronological.slice(0, cut)),
    });
    return Object.freeze({
      compacted: true,
      messages: Object.freeze(working),
      estimatedTokens: estimated,
      boundary,
    });
  }

  return Object.freeze({
    compacted: false,
    messages: Object.freeze(chronological),
    estimatedTokens: estimateTokens(chronological),
    boundary: validPrior ? prior : null,
  });
}

function systemCompactionMessage(summary: string): AgentMessage {
  return Object.freeze({
    messageId: asAgentMessageId(`amg_compaction_${summary.length}`),
    conversationId: asAgentConversationId('acv_native_compaction'),
    role: 'SYSTEM',
    content: summary,
    createdAt: asUtcInstant('1970-01-01T00:00:00.000Z'),
    visible: true,
    proposalRef: null,
    toolEventId: null,
    hiddenReasoning: false,
  });
}
