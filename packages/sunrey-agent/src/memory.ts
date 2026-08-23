import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { memoryIdFor } from './ids.ts';
import type { MemoryCategory, MemoryClassification, MemorySource } from './taxonomy.ts';
import type { AgentMemory, MandateRefusal, UserAgent } from './types.ts';

const SPECULATION_MARKERS = [
  'i think',
  'probably',
  'might be',
  'seems like',
  'guess',
  'speculat',
];

export type CreateMemoryInput = {
  readonly agent: UserAgent;
  readonly ownerId: string;
  readonly category: MemoryCategory;
  readonly content: string;
  readonly source: MemorySource;
  readonly confidence: AgentMemory['confidence'];
  readonly userEditable: boolean;
  readonly dataClassification: MemoryClassification;
  readonly personalization: boolean;
  readonly expiresAt?: AgentMemory['expiresAt'];
  readonly actorId: string;
};

export function createAgentMemory(clock: Clock, input: CreateMemoryInput): Result<AgentMemory, MandateRefusal> {
  if (input.ownerId !== input.agent.ownerId && input.ownerId !== input.agent.owner.ownerId) {
    return err({ ok: false, code: 'CROSS_USER_DENIED', detail: 'memory must belong to the agent owner' });
  }
  if (input.actorId.startsWith('agent:') && input.source !== 'CONFIRMED_SYSTEM_FACT' && input.source !== 'PEG_REFERENCE') {
    return err({
      ok: false,
      code: 'MEMORY_SPECULATION_FORBIDDEN',
      detail: 'agent-originated text cannot become memory unless it is a confirmed fact or PEG reference',
    });
  }
  if (input.source === 'PEG_REFERENCE' && input.category !== 'FINANCIAL_GOAL_REFERENCE' && input.category !== 'CONFIRMED_FACT_REFERENCE') {
    return err({
      ok: false,
      code: 'MEMORY_SPECULATION_FORBIDDEN',
      detail: 'PEG references may only be stored as goal or confirmed-fact references',
    });
  }
  const lower = input.content.toLowerCase();
  if (SPECULATION_MARKERS.some((marker) => lower.includes(marker)) && input.source !== 'USER_DECLARED' && input.source !== 'USER_CORRECTED') {
    return err({
      ok: false,
      code: 'MEMORY_SPECULATION_FORBIDDEN',
      detail: 'model-generated speculation cannot be stored as memory',
    });
  }
  if (input.personalization && input.dataClassification === 'OPERATIONAL_AUDIT') {
    return err({
      ok: false,
      code: 'MEMORY_SPECULATION_FORBIDDEN',
      detail: 'operational audit records are not personalization memory',
    });
  }
  const now = clock.now();
  return ok(
    Object.freeze({
      memoryId: memoryIdFor(input.agent.agentId, input.ownerId, input.category, input.content),
      agentId: input.agent.agentId,
      ownerId: input.ownerId,
      category: input.category,
      content: input.content,
      source: input.source,
      confidence: input.confidence,
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAt ?? null,
      userEditable: input.userEditable,
      dataClassification: input.dataClassification,
      personalization: input.personalization,
    }),
  );
}

export function correctAgentMemory(
  memory: AgentMemory,
  content: string,
  actorId: string,
  at: AgentMemory['updatedAt'],
): Result<AgentMemory, MandateRefusal> {
  if (actorId.startsWith('agent:')) {
    return err({ ok: false, code: 'SELF_EXPANSION_FORBIDDEN', detail: 'an agent cannot correct its own memory' });
  }
  if (!memory.userEditable && memory.dataClassification === 'OPERATIONAL_AUDIT') {
    return err({
      ok: false,
      code: 'MEMORY_NOT_USER_EDITABLE',
      detail: 'operational audit memory has separate retention treatment',
    });
  }
  if (!memory.userEditable) {
    return err({ ok: false, code: 'MEMORY_NOT_USER_EDITABLE', detail: 'this memory is not user-editable' });
  }
  return ok(
    Object.freeze({
      ...memory,
      content,
      source: 'USER_CORRECTED' as const,
      confidence: 'USER_DECLARED' as const,
      updatedAt: at,
    }),
  );
}

export function memoryIsPegDuplicate(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes('balance is') ||
    lower.includes('position is') ||
    lower.includes('account balance') ||
    lower.includes('ledger')
  );
}
