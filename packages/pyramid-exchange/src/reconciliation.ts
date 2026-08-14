import type { CustomerId, UtcInstant } from '@solstice/domain';
import type { EvidenceVault } from '@solstice/kernel';
import type { SimulatedPyrCustody } from './custody.ts';
import type { KillSwitchBoard } from './kill-switch.ts';
import type { MatchingEngine } from './matching.ts';
import type { KernelAuthorization } from '@solstice/kernel';

export type ReconciliationOk = {
  readonly ok: true;
  readonly bookRemaining: bigint;
  readonly ledgerPyr: bigint;
  readonly custodyPyr: bigint;
};

export type ReconciliationHalt = {
  readonly ok: false;
  readonly halted: true;
  readonly reason: string;
  readonly bookRemaining: bigint;
  readonly ledgerPyr: bigint;
  readonly custodyPyr: bigint;
  readonly evidenceId: string;
};

/**
 * Continuously verifiable agreement between book, ledger, and custody.
 * Divergence engages the EXCHANGE kill switch and seals evidence.
 * There is no auto-correct, repair, or rebase path.
 */
export class ReconciliationEngine {
  readonly #engine: MatchingEngine;
  readonly #custody: SimulatedPyrCustody;
  readonly #kills: KillSwitchBoard;
  readonly #vault: EvidenceVault;
  readonly #customers: () => readonly CustomerId[];

  constructor(input: {
    readonly engine: MatchingEngine;
    readonly custody: SimulatedPyrCustody;
    readonly kills: KillSwitchBoard;
    readonly vault: EvidenceVault;
    readonly customers: () => readonly CustomerId[];
  }) {
    this.#engine = input.engine;
    this.#custody = input.custody;
    this.#kills = input.kills;
    this.#vault = input.vault;
    this.#customers = input.customers;
  }

  verify(
    authorization: KernelAuthorization | undefined,
    occurredAt: UtcInstant,
  ): ReconciliationOk | ReconciliationHalt {
    let bookRemaining = 0n;
    for (const order of this.#engine.listResting()) {
      if (order.pair.base === 'PYR') {
        bookRemaining += order.remaining;
      }
    }
    let ledgerPyr = 0n;
    let custodyPyr = 0n;
    for (const customerId of this.#customers()) {
      ledgerPyr += this.#custody.ledgerPosition(customerId, 'PYR');
      custodyPyr += this.#custody.position(customerId, 'PYR');
    }
    ledgerPyr += this.#custody.ledgerPosition('HOUSE', 'PYR');
    custodyPyr += this.#custody.position('HOUSE', 'PYR');

    if (ledgerPyr !== custodyPyr || this.#custody.hasInjectedDivergence()) {
      const evidence = this.#vault.seal(
        {
          kind: 'exchange.reconciliation_divergence',
          bookRemaining: bookRemaining.toString(),
          ledgerPyr: ledgerPyr.toString(),
          custodyPyr: custodyPyr.toString(),
          autoCorrected: false,
          action: 'HALT',
        },
        occurredAt,
      );
      if (authorization) {
        this.#kills.engageKillSwitch(authorization, {
          id: 'EXCHANGE',
          reason: 'reconciliation divergence: trading halted; no auto-correction applied',
          engagedAt: occurredAt,
        });
      }
      return {
        ok: false,
        halted: true,
        reason: 'reconciliation divergence: book/ledger/custody disagree; trading halted without correction',
        bookRemaining,
        ledgerPyr,
        custodyPyr,
        evidenceId: evidence.id,
      };
    }

    return { ok: true, bookRemaining, ledgerPyr, custodyPyr };
  }
}
