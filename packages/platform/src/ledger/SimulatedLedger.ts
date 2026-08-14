import type { ExecutionAuthority } from '../authority/ExecutionAuthority.ts';
import { AuthorityIssuer } from '../authority/ExecutionAuthority.ts';
import type { Money } from '../../../contracts/src/money.ts';

/**
 * Minimal simulated ledger. Agent code cannot import this module.
 * postJournal requires an ExecutionAuthority. The agent-originated path
 * in the Kernel never calls postJournal.
 */
export type Journal = {
  readonly id: string;
  readonly actionType: string;
  readonly authorityId: string;
  readonly createdAt: string;
};

export class SimulatedLedger {
  private readonly journals: Journal[] = [];

  postJournal(input: {
    readonly actionType: string;
    readonly authority: ExecutionAuthority;
    readonly amount: Money;
    readonly createdAt: string;
  }): Journal {
    if (!input.authority || typeof input.authority.signature !== 'string') {
      throw new Error('ledger requires a signed Execution Authority');
    }
    const journal: Journal = Object.freeze({
      id: `jnl_${this.journals.length + 1}`,
      actionType: input.actionType,
      authorityId: input.authority.authorityId,
      createdAt: input.createdAt,
    });
    this.journals.push(journal);
    return journal;
  }

  count(): number {
    return this.journals.length;
  }

  list(): readonly Journal[] {
    return this.journals.slice();
  }
}

export type { AuthorityIssuer };
