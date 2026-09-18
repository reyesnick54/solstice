import type {
  GrowCloseRequest,
  GrowControlNotification,
  GrowMandateChangeRequest,
  GrowPauseControl,
  GrowWithdrawalRequest,
} from './types.ts';

export type GrowControlsStoreSnapshot = {
  readonly pauseBySubject: Readonly<Record<string, GrowPauseControl>>;
  readonly closeRequests: readonly GrowCloseRequest[];
  readonly withdrawals: readonly GrowWithdrawalRequest[];
  readonly mandateChanges: readonly GrowMandateChangeRequest[];
  readonly notifications: readonly GrowControlNotification[];
};

function subjectKey(customerId: string, subjectId: string): string {
  return `${customerId}:${subjectId}`;
}

export class InMemoryGrowControlsStore {
  private pauseBySubject = new Map<string, GrowPauseControl>();
  private closeRequests = new Map<string, GrowCloseRequest>();
  private withdrawals = new Map<string, GrowWithdrawalRequest>();
  private mandateChanges = new Map<string, GrowMandateChangeRequest>();
  private notifications: GrowControlNotification[] = [];
  private idempotencyClose = new Map<string, string>();
  private idempotencyWithdraw = new Map<string, string>();

  getPause(customerId: string, subjectId: string): GrowPauseControl | undefined {
    return this.pauseBySubject.get(subjectKey(customerId, subjectId));
  }

  putPause(control: GrowPauseControl, customerId: string, subjectId: string): void {
    this.pauseBySubject.set(subjectKey(customerId, subjectId), control);
  }

  getCloseRequest(closeRequestId: string): GrowCloseRequest | undefined {
    return this.closeRequests.get(closeRequestId);
  }

  closeByIdempotency(customerId: string, idempotencyKey: string): GrowCloseRequest | undefined {
    const id = this.idempotencyClose.get(`${customerId}:${idempotencyKey}`);
    return id ? this.closeRequests.get(id) : undefined;
  }

  putCloseRequest(request: GrowCloseRequest): void {
    this.closeRequests.set(request.closeRequestId, request);
    this.idempotencyClose.set(`${request.customerId}:${request.idempotencyKey}`, request.closeRequestId);
  }

  listCloseRequests(customerId: string, subjectId: string): readonly GrowCloseRequest[] {
    return Object.freeze(
      [...this.closeRequests.values()].filter(
        (row) => row.customerId === customerId && row.subjectId === subjectId,
      ),
    );
  }

  getWithdrawal(withdrawalId: string): GrowWithdrawalRequest | undefined {
    return this.withdrawals.get(withdrawalId);
  }

  withdrawalByIdempotency(customerId: string, idempotencyKey: string): GrowWithdrawalRequest | undefined {
    const id = this.idempotencyWithdraw.get(`${customerId}:${idempotencyKey}`);
    return id ? this.withdrawals.get(id) : undefined;
  }

  putWithdrawal(request: GrowWithdrawalRequest): void {
    this.withdrawals.set(request.withdrawalId, request);
    this.idempotencyWithdraw.set(`${request.customerId}:${request.idempotencyKey}`, request.withdrawalId);
  }

  listWithdrawals(customerId: string, subjectId: string): readonly GrowWithdrawalRequest[] {
    return Object.freeze(
      [...this.withdrawals.values()].filter(
        (row) => row.customerId === customerId && row.subjectId === subjectId,
      ),
    );
  }

  putMandateChange(change: GrowMandateChangeRequest): void {
    this.mandateChanges.set(change.changeId, change);
  }

  appendNotification(notification: GrowControlNotification): void {
    this.notifications.push(notification);
  }

  listNotifications(customerId: string, subjectId: string, limit = 20): readonly GrowControlNotification[] {
    return Object.freeze(
      this.notifications
        .filter((row) => row.customerId === customerId && row.subjectId === subjectId)
        .slice(-limit),
    );
  }

  snapshot(): GrowControlsStoreSnapshot {
    const pauseBySubject: Record<string, GrowPauseControl> = {};
    for (const [key, value] of this.pauseBySubject) {
      pauseBySubject[key] = value;
    }
    return Object.freeze({
      pauseBySubject: Object.freeze(pauseBySubject),
      closeRequests: Object.freeze([...this.closeRequests.values()]),
      withdrawals: Object.freeze([...this.withdrawals.values()]),
      mandateChanges: Object.freeze([...this.mandateChanges.values()]),
      notifications: Object.freeze([...this.notifications]),
    });
  }

  loadState(snapshot: GrowControlsStoreSnapshot): void {
    this.pauseBySubject.clear();
    for (const [key, value] of Object.entries(snapshot.pauseBySubject)) {
      this.pauseBySubject.set(key, value);
    }
    this.closeRequests.clear();
    this.idempotencyClose.clear();
    for (const row of snapshot.closeRequests) {
      this.closeRequests.set(row.closeRequestId, row);
      this.idempotencyClose.set(`${row.customerId}:${row.idempotencyKey}`, row.closeRequestId);
    }
    this.withdrawals.clear();
    this.idempotencyWithdraw.clear();
    for (const row of snapshot.withdrawals) {
      this.withdrawals.set(row.withdrawalId, row);
      this.idempotencyWithdraw.set(`${row.customerId}:${row.idempotencyKey}`, row.withdrawalId);
    }
    this.mandateChanges.clear();
    for (const row of snapshot.mandateChanges) {
      this.mandateChanges.set(row.changeId, row);
    }
    this.notifications = [...snapshot.notifications];
  }
}
