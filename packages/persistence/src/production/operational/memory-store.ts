import { DurableStoreError } from '../snapshot-envelope.ts';
import {
  assertCustodyWithdrawalTransition,
  assertExpectedRevision,
  assertExchangeOrderTransition,
  assertPaymentTransition,
  assertProviderTransition,
} from './transitions.ts';
import {
  EMPTY_OPERATIONAL_SNAPSHOT,
  type OperationalCredentialDescriptorRef,
  type OperationalCustodyDeposit,
  type OperationalCustodyReservation,
  type OperationalCustodySubmission,
  type OperationalCustodyWallet,
  type OperationalCustodyWithdrawal,
  type OperationalExchangeOrder,
  type OperationalExchangeReservation,
  type OperationalExchangeTrade,
  type OperationalInboxRecord,
  type OperationalMutationCrash,
  type OperationalOutboxRecord,
  type OperationalPayment,
  type OperationalProviderProfile,
  type OperationalRailSubmission,
  type OperationalSettlementIntent,
  type OperationalSnapshot,
} from './types.ts';

export class CrashInjectedError extends Error {
  readonly phase: Exclude<OperationalMutationCrash, 'NONE'>;

  constructor(phase: Exclude<OperationalMutationCrash, 'NONE'>) {
    super(`injected operational crash at ${phase}`);
    this.name = 'CrashInjectedError';
    this.phase = phase;
  }
}

export class MemoryOperationalStore {
  private snapshot: OperationalSnapshot = EMPTY_OPERATIONAL_SNAPSHOT;
  crashBeforeCommit: OperationalMutationCrash = 'NONE';

  clone(): MemoryOperationalStore {
    const next = new MemoryOperationalStore();
    next.snapshot = structuredClone(this.snapshot);
    return next;
  }

  export(): OperationalSnapshot {
    return this.snapshot;
  }

  import(snapshot: OperationalSnapshot): void {
    this.snapshot = snapshot;
  }

  putPayment(row: OperationalPayment, expectedRevision?: number): OperationalPayment {
    return this.commit((draft) => {
      const existing = draft.payments.find((item) => item.paymentId === row.paymentId);
      if (existing) {
        assertExpectedRevision(existing.revision, expectedRevision, `payment ${row.paymentId}`);
        assertPaymentTransition(existing.status, row.status);
        const next = { ...row, revision: existing.revision + 1 };
        draft.payments = draft.payments.map((item) => (item.paymentId === row.paymentId ? next : item));
        return next;
      }
      const created = { ...row, revision: row.revision ?? 1 };
      draft.payments = [...draft.payments, created];
      return created;
    });
  }

  putRailSubmission(row: OperationalRailSubmission): OperationalRailSubmission {
    return this.commit((draft) => {
      const existing = draft.railSubmissions.find((item) => item.railSubmissionId === row.railSubmissionId);
      const next = existing ? { ...row, revision: existing.revision + 1 } : { ...row, revision: row.revision ?? 1 };
      draft.railSubmissions = existing
        ? draft.railSubmissions.map((item) => (item.railSubmissionId === row.railSubmissionId ? next : item))
        : [...draft.railSubmissions, next];
      return next;
    });
  }

  putWallet(row: OperationalCustodyWallet): OperationalCustodyWallet {
    return this.commit((draft) => {
      const existing = draft.wallets.find((item) => item.walletId === row.walletId);
      const next = existing ? { ...row, revision: existing.revision + 1 } : { ...row, revision: row.revision ?? 1 };
      draft.wallets = existing
        ? draft.wallets.map((item) => (item.walletId === row.walletId ? next : item))
        : [...draft.wallets, next];
      return next;
    });
  }

  putWithdrawal(row: OperationalCustodyWithdrawal, expectedRevision?: number): OperationalCustodyWithdrawal {
    return this.commit((draft) => {
      const existing = draft.withdrawals.find((item) => item.withdrawalId === row.withdrawalId);
      if (existing) {
        assertExpectedRevision(existing.revision, expectedRevision, `withdrawal ${row.withdrawalId}`);
        assertCustodyWithdrawalTransition(existing.state, row.state);
        const next = { ...row, revision: existing.revision + 1 };
        draft.withdrawals = draft.withdrawals.map((item) => (item.withdrawalId === row.withdrawalId ? next : item));
        return next;
      }
      const created = { ...row, revision: row.revision ?? 1 };
      draft.withdrawals = [...draft.withdrawals, created];
      return created;
    });
  }

  putDeposit(row: OperationalCustodyDeposit): OperationalCustodyDeposit {
    return this.commit((draft) => {
      const existing = draft.deposits.find((item) => item.depositId === row.depositId);
      const next = existing ? { ...row, revision: existing.revision + 1 } : { ...row, revision: row.revision ?? 1 };
      draft.deposits = existing
        ? draft.deposits.map((item) => (item.depositId === row.depositId ? next : item))
        : [...draft.deposits, next];
      return next;
    });
  }

  putCustodyReservation(row: OperationalCustodyReservation): OperationalCustodyReservation {
    return this.commit((draft) => {
      const existing = draft.custodyReservations.find((item) => item.reservationId === row.reservationId);
      const next = existing ? { ...row, revision: existing.revision + 1 } : { ...row, revision: row.revision ?? 1 };
      draft.custodyReservations = existing
        ? draft.custodyReservations.map((item) => (item.reservationId === row.reservationId ? next : item))
        : [...draft.custodyReservations, next];
      return next;
    });
  }

  putCustodySubmission(row: OperationalCustodySubmission): OperationalCustodySubmission {
    return this.commit((draft) => {
      const existing = draft.custodySubmissions.find((item) => item.submissionId === row.submissionId);
      const next = existing ? { ...row, revision: existing.revision + 1 } : { ...row, revision: row.revision ?? 1 };
      draft.custodySubmissions = existing
        ? draft.custodySubmissions.map((item) => (item.submissionId === row.submissionId ? next : item))
        : [...draft.custodySubmissions, next];
      return next;
    });
  }

  putOrder(row: OperationalExchangeOrder, expectedRevision?: number): OperationalExchangeOrder {
    return this.commit((draft) => {
      const existing = draft.orders.find((item) => item.orderId === row.orderId);
      if (existing) {
        assertExpectedRevision(existing.revision, expectedRevision, `order ${row.orderId}`);
        assertExchangeOrderTransition(existing.state, row.state);
        const next = { ...row, revision: existing.revision + 1 };
        draft.orders = draft.orders.map((item) => (item.orderId === row.orderId ? next : item));
        return next;
      }
      const created = { ...row, revision: row.revision ?? 1 };
      draft.orders = [...draft.orders, created];
      return created;
    });
  }

  putExchangeReservation(row: OperationalExchangeReservation): OperationalExchangeReservation {
    return this.commit((draft) => {
      draft.exchangeReservations = [
        ...draft.exchangeReservations.filter((item) => item.reservationId !== row.reservationId),
        row,
      ];
      return row;
    });
  }

  putTrade(row: OperationalExchangeTrade): OperationalExchangeTrade {
    return this.commit((draft) => {
      if (!draft.trades.some((item) => item.tradeId === row.tradeId)) {
        draft.trades = [...draft.trades, row];
      }
      return row;
    });
  }

  putSettlement(row: OperationalSettlementIntent): OperationalSettlementIntent {
    return this.commit((draft) => {
      const existing = draft.settlements.find((item) => item.intentId === row.intentId);
      const next = existing ? { ...row, revision: existing.revision + 1 } : { ...row, revision: row.revision ?? 1 };
      draft.settlements = existing
        ? draft.settlements.map((item) => (item.intentId === row.intentId ? next : item))
        : [...draft.settlements, next];
      return next;
    });
  }

  putProvider(row: OperationalProviderProfile, expectedRevision?: number): OperationalProviderProfile {
    if (row.rawCredentialPresent !== false) {
      throw new DurableStoreError('SCHEMA_INVALID', 'raw credentials must not be persisted');
    }
    return this.commit((draft) => {
      const existing = draft.providers.find((item) => item.providerId === row.providerId);
      if (existing) {
        assertExpectedRevision(existing.revision, expectedRevision, `provider ${row.providerId}`);
        assertProviderTransition(existing.acceptanceStatus, row.acceptanceStatus);
        const next = { ...row, rawCredentialPresent: false as const, revision: existing.revision + 1 };
        draft.providers = draft.providers.map((item) => (item.providerId === row.providerId ? next : item));
        return next;
      }
      const created = { ...row, rawCredentialPresent: false as const, revision: row.revision ?? 1 };
      draft.providers = [...draft.providers, created];
      return created;
    });
  }

  putCredentialRef(row: OperationalCredentialDescriptorRef): OperationalCredentialDescriptorRef {
    if (row.rawCredentialPresent !== false || row.privateKeyPresent !== false) {
      throw new DurableStoreError('SCHEMA_INVALID', 'credential values must not be persisted');
    }
    return this.commit((draft) => {
      draft.credentialRefs = [
        ...draft.credentialRefs.filter((item) => item.descriptorId !== row.descriptorId),
        row,
      ];
      return row;
    });
  }

  mutateWithOutbox<T>(
    mutate: (store: MemoryOperationalStore) => T,
    outbox: OperationalOutboxRecord,
  ): T {
    const previous = structuredClone(this.snapshot);
    if (this.crashBeforeCommit === 'BEFORE_COMMIT') {
      throw new CrashInjectedError('BEFORE_COMMIT');
    }
    try {
      const result = mutate(this);
      this.snapshot = {
        ...this.snapshot,
        outbox: [...this.snapshot.outbox.filter((row) => row.eventId !== outbox.eventId), outbox],
      };
      if (this.crashBeforeCommit === 'AFTER_OUTBOX') {
        throw new CrashInjectedError('AFTER_OUTBOX');
      }
      if (this.crashBeforeCommit === 'AFTER_COMMIT') {
        throw new CrashInjectedError('AFTER_COMMIT');
      }
      return result;
    } catch (error) {
      if (error instanceof CrashInjectedError && error.phase === 'BEFORE_COMMIT') {
        this.snapshot = previous;
      }
      if (error instanceof CrashInjectedError && error.phase === 'AFTER_COMMIT') {
        // domain committed; outbox already written in this helper
      }
      throw error;
    }
  }

  putOutbox(row: OperationalOutboxRecord): void {
    this.snapshot = {
      ...this.snapshot,
      outbox: [...this.snapshot.outbox.filter((item) => item.eventId !== row.eventId), row],
    };
  }

  putInbox(row: OperationalInboxRecord): void {
    this.snapshot = {
      ...this.snapshot,
      inbox: [
        ...this.snapshot.inbox.filter((item) => !(item.consumerId === row.consumerId && item.eventId === row.eventId)),
        row,
      ],
    };
  }

  private commit<T>(fn: (draft: WritableSnapshot) => T): T {
    if (this.crashBeforeCommit === 'BEFORE_COMMIT') {
      throw new CrashInjectedError('BEFORE_COMMIT');
    }
    const draft = writable(this.snapshot);
    const result = fn(draft);
    this.snapshot = Object.freeze({
      ...draft,
      postgresIsLedger: false,
      postgresIsNativeSupplyAuthority: false,
    });
    if (this.crashBeforeCommit === 'AFTER_COMMIT') {
      throw new CrashInjectedError('AFTER_COMMIT');
    }
    return result;
  }
}

type WritableSnapshot = {
  -readonly [K in keyof OperationalSnapshot]: OperationalSnapshot[K] extends readonly (infer U)[] ? U[] : OperationalSnapshot[K];
};

function writable(snapshot: OperationalSnapshot): WritableSnapshot {
  return {
    payments: [...snapshot.payments],
    railSubmissions: [...snapshot.railSubmissions],
    wallets: [...snapshot.wallets],
    withdrawals: [...snapshot.withdrawals],
    deposits: [...snapshot.deposits],
    custodyReservations: [...snapshot.custodyReservations],
    custodySubmissions: [...snapshot.custodySubmissions],
    orders: [...snapshot.orders],
    exchangeReservations: [...snapshot.exchangeReservations],
    trades: [...snapshot.trades],
    settlements: [...snapshot.settlements],
    providers: [...snapshot.providers],
    credentialRefs: [...snapshot.credentialRefs],
    outbox: [...snapshot.outbox],
    inbox: [...snapshot.inbox],
    postgresIsLedger: false,
    postgresIsNativeSupplyAuthority: false,
  };
}
