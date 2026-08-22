/**
 * Card-provider reconciliation inputs. A card integration that can
 * authorize but cannot reconcile is incomplete.
 */

export type CardReconciliationWindow = {
  readonly provider: string;
  readonly periodStart: string;
  readonly periodEnd: string;
};

export type CardReconciliationPort = {
  fetchAuthorizations(window: CardReconciliationWindow): readonly { readonly authorizationId: string; readonly amountMinor: bigint }[];
  fetchCaptures(window: CardReconciliationWindow): readonly { readonly captureId: string; readonly amountMinor: bigint }[];
  fetchSettlements(window: CardReconciliationWindow): readonly { readonly settlementRef: string; readonly netMinor: bigint }[];
  fetchFees(window: CardReconciliationWindow): readonly { readonly feeRef: string; readonly amountMinor: bigint }[];
};

export class SimulatedCardReconciliationAdapter implements CardReconciliationPort {
  fetchAuthorizations(_window: CardReconciliationWindow) {
    void _window;
    return [];
  }

  fetchCaptures(_window: CardReconciliationWindow) {
    void _window;
    return [];
  }

  fetchSettlements(_window: CardReconciliationWindow) {
    void _window;
    return [];
  }

  fetchFees(_window: CardReconciliationWindow) {
    void _window;
    return [];
  }
}
