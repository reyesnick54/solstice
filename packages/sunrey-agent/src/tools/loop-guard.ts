import { contentHash } from '../ids.ts';
import type { StructuredToolCall } from './types.ts';

export type TurnLimits = {
  readonly maxToolCalls: number;
  readonly maxIdenticalCalls: number;
  readonly maxProposalCreates: number;
  readonly maxRecursiveProposals: number;
};

export const DEFAULT_TURN_LIMITS: TurnLimits = Object.freeze({
  maxToolCalls: 8,
  maxIdenticalCalls: 2,
  maxProposalCreates: 3,
  maxRecursiveProposals: 1,
});

export type LoopGuardFailure = {
  readonly ok: false;
  readonly code: 'TOOL_LOOP_LIMIT' | 'IDENTICAL_CALL_LIMIT' | 'PROPOSAL_LOOP_LIMIT';
  readonly safeMessage: string;
};

export class ToolLoopGuard {
  private readonly calls: string[] = [];
  private readonly identical = new Map<string, number>();
  private proposalCreates = 0;
  private readonly proposalHashes = new Set<string>();
  private readonly limits: TurnLimits;

  constructor(limits: TurnLimits = DEFAULT_TURN_LIMITS) {
    this.limits = limits;
  }

  inspect(
    call: StructuredToolCall,
    createsProposal: boolean,
  ): { readonly ok: true; readonly callHash: string } | LoopGuardFailure {
    if (this.calls.length >= this.limits.maxToolCalls) {
      return {
        ok: false,
        code: 'TOOL_LOOP_LIMIT',
        safeMessage: 'I reached the per-turn tool limit and stopped to avoid a loop.',
      };
    }
    const callHash = contentHash({ toolId: call.toolId, input: call.input });
    const seen = (this.identical.get(callHash) ?? 0) + 1;
    if (seen > this.limits.maxIdenticalCalls) {
      return {
        ok: false,
        code: 'IDENTICAL_CALL_LIMIT',
        safeMessage: 'I already made that same tool call this turn.',
      };
    }
    if (createsProposal) {
      if (this.proposalCreates >= this.limits.maxProposalCreates) {
        return {
          ok: false,
          code: 'PROPOSAL_LOOP_LIMIT',
          safeMessage: 'I cannot create more proposals in this turn.',
        };
      }
      if (this.proposalHashes.has(callHash) && this.proposalHashes.size >= this.limits.maxRecursiveProposals) {
        return {
          ok: false,
          code: 'PROPOSAL_LOOP_LIMIT',
          safeMessage: 'I cannot recursively recreate the same proposal.',
        };
      }
    }
    this.calls.push(call.toolId);
    this.identical.set(callHash, seen);
    if (createsProposal) {
      this.proposalCreates += 1;
      this.proposalHashes.add(callHash);
    }
    return { ok: true, callHash };
  }

  callCount(): number {
    return this.calls.length;
  }
}
