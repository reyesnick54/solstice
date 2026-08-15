import type { InvestmentAccountId, InstrumentId, PaperOrderId, FillId, SettlementId } from './ids.ts';
import type { InvestmentAccountProfile } from './profile.ts';
import type { Instrument } from './instrument.ts';
import type { PaperOrder } from './order.ts';
import type { PaperFill } from './fill.ts';
import type { PositionLot } from './lot.ts';
import type { PortfolioPosition } from './position.ts';
import type { InvestmentSettlement } from './settlement.ts';
import type { PortfolioValuationSnapshot } from './valuation.ts';
import type { CorporateAction } from './corporate-action.ts';
import type { InvestmentReconciliation } from './reconciliation.ts';
import type { RealizedPnL } from './pnl.ts';

export type InvestmentSnapshot = {
  readonly profiles: readonly InvestmentAccountProfile[];
  readonly instruments: readonly Instrument[];
  readonly orders: readonly PaperOrder[];
  readonly fills: readonly PaperFill[];
  readonly lots: readonly PositionLot[];
  readonly positions: readonly PortfolioPosition[];
  readonly settlements: readonly InvestmentSettlement[];
  readonly valuations: readonly PortfolioValuationSnapshot[];
  readonly corporateActions: readonly CorporateAction[];
  readonly reconciliations: readonly InvestmentReconciliation[];
  readonly realized: readonly RealizedPnL[];
};

export class InvestmentStore {
  private readonly profiles = new Map<string, InvestmentAccountProfile>();
  private readonly instruments = new Map<string, Instrument>();
  private readonly orders = new Map<string, PaperOrder>();
  private readonly ordersByIdempotency = new Map<string, PaperOrder>();
  private readonly fills = new Map<string, PaperFill>();
  private readonly fillsByProviderRef = new Map<string, PaperFill>();
  private readonly lots = new Map<string, PositionLot[]>();
  private readonly positions = new Map<string, PortfolioPosition>();
  private readonly settlements = new Map<string, InvestmentSettlement>();
  private readonly valuations: PortfolioValuationSnapshot[] = [];
  private readonly corporateActions = new Map<string, CorporateAction>();
  private readonly reconciliations: InvestmentReconciliation[] = [];
  private readonly realized: RealizedPnL[] = [];
  private readonly fundingByIdempotency = new Map<string, string>();

  putProfile(profile: InvestmentAccountProfile): void {
    this.profiles.set(profile.investmentAccountId, profile);
  }

  getProfile(id: InvestmentAccountId): InvestmentAccountProfile | undefined {
    return this.profiles.get(id);
  }

  getProfileByBrokerageCash(accountId: string): InvestmentAccountProfile | undefined {
    return [...this.profiles.values()].find((row) => row.brokerageCashAccountId === accountId);
  }

  listProfiles(): readonly InvestmentAccountProfile[] {
    return [...this.profiles.values()];
  }

  putInstrument(instrument: Instrument): void {
    this.instruments.set(instrument.instrumentId, instrument);
  }

  getInstrument(id: InstrumentId | string): Instrument | undefined {
    return this.instruments.get(id);
  }

  listInstruments(): readonly Instrument[] {
    return [...this.instruments.values()];
  }

  putOrder(order: PaperOrder): void {
    this.orders.set(order.orderId, order);
    this.ordersByIdempotency.set(order.idempotencyKey, order);
  }

  getOrder(id: PaperOrderId | string): PaperOrder | undefined {
    return this.orders.get(id);
  }

  getOrderByIdempotency(key: string): PaperOrder | undefined {
    return this.ordersByIdempotency.get(key);
  }

  listOrders(): readonly PaperOrder[] {
    return [...this.orders.values()];
  }

  putFill(fill: PaperFill): void {
    this.fills.set(fill.fillId, fill);
    this.fillsByProviderRef.set(fill.providerFillRef, fill);
  }

  getFill(id: FillId | string): PaperFill | undefined {
    return this.fills.get(id);
  }

  getFillByProviderRef(ref: string): PaperFill | undefined {
    return this.fillsByProviderRef.get(ref);
  }

  listFills(): readonly PaperFill[] {
    return [...this.fills.values()];
  }

  replaceLots(investmentAccountId: InvestmentAccountId, instrumentId: InstrumentId, lots: readonly PositionLot[]): void {
    this.lots.set(`${investmentAccountId}:${instrumentId}`, [...lots]);
  }

  getLots(investmentAccountId: InvestmentAccountId, instrumentId: InstrumentId): readonly PositionLot[] {
    return this.lots.get(`${investmentAccountId}:${instrumentId}`) ?? [];
  }

  putPosition(position: PortfolioPosition): void {
    this.positions.set(`${position.investmentAccountId}:${position.instrumentId}`, position);
  }

  getPosition(
    investmentAccountId: InvestmentAccountId,
    instrumentId: InstrumentId,
  ): PortfolioPosition | undefined {
    return this.positions.get(`${investmentAccountId}:${instrumentId}`);
  }

  listPositions(investmentAccountId: InvestmentAccountId): readonly PortfolioPosition[] {
    return [...this.positions.values()].filter((row) => row.investmentAccountId === investmentAccountId);
  }

  putSettlement(record: InvestmentSettlement): void {
    this.settlements.set(record.settlementId, record);
  }

  getSettlement(id: SettlementId | string): InvestmentSettlement | undefined {
    return this.settlements.get(id);
  }

  getSettlementByFill(fillId: string): InvestmentSettlement | undefined {
    return [...this.settlements.values()].find((row) => row.fillId === fillId);
  }

  listSettlements(investmentAccountId: InvestmentAccountId): readonly InvestmentSettlement[] {
    return [...this.settlements.values()].filter((row) => row.investmentAccountId === investmentAccountId);
  }

  putValuation(snapshot: PortfolioValuationSnapshot): void {
    this.valuations.push(snapshot);
  }

  latestValuation(investmentAccountId: InvestmentAccountId): PortfolioValuationSnapshot | undefined {
    return [...this.valuations].reverse().find((row) => row.investmentAccountId === investmentAccountId);
  }

  listValuations(): readonly PortfolioValuationSnapshot[] {
    return [...this.valuations];
  }

  putCorporateAction(action: CorporateAction): void {
    this.corporateActions.set(action.corporateActionId, action);
  }

  getCorporateAction(id: string): CorporateAction | undefined {
    return this.corporateActions.get(id);
  }

  putReconciliation(row: InvestmentReconciliation): void {
    this.reconciliations.push(row);
  }

  listReconciliations(): readonly InvestmentReconciliation[] {
    return [...this.reconciliations];
  }

  recordRealized(row: RealizedPnL): void {
    this.realized.push(row);
  }

  listRealized(): readonly RealizedPnL[] {
    return [...this.realized];
  }

  rememberFunding(idempotencyKey: string, journalId: string): void {
    this.fundingByIdempotency.set(idempotencyKey, journalId);
  }

  fundingJournalId(idempotencyKey: string): string | undefined {
    return this.fundingByIdempotency.get(idempotencyKey);
  }

  snapshot(): InvestmentSnapshot {
    return Object.freeze({
      profiles: this.listProfiles(),
      instruments: this.listInstruments(),
      orders: this.listOrders(),
      fills: this.listFills(),
      lots: [...this.lots.values()].flat(),
      positions: [...this.positions.values()],
      settlements: [...this.settlements.values()],
      valuations: [...this.valuations],
      corporateActions: [...this.corporateActions.values()],
      reconciliations: [...this.reconciliations],
      realized: [...this.realized],
    });
  }

  hydrate(snapshot: InvestmentSnapshot): void {
    for (const row of snapshot.profiles) {
      this.putProfile(row);
    }
    for (const row of snapshot.instruments) {
      this.putInstrument(row);
    }
    for (const row of snapshot.orders) {
      this.putOrder(row);
    }
    for (const row of snapshot.fills) {
      this.putFill(row);
    }
    const lotsByKey = new Map<string, PositionLot[]>();
    for (const lot of snapshot.lots) {
      const key = `${lot.instrumentId}:${lot.lotId}`;
      const bucket = lotsByKey.get(lot.instrumentId) ?? [];
      bucket.push(lot);
      lotsByKey.set(lot.instrumentId, bucket);
    }
    for (const position of snapshot.positions) {
      this.putPosition(position);
      const lots = snapshot.lots.filter((lot) => lot.instrumentId === position.instrumentId);
      this.replaceLots(position.investmentAccountId, position.instrumentId, lots);
    }
    for (const row of snapshot.settlements) {
      this.putSettlement(row);
    }
    for (const row of snapshot.valuations) {
      this.putValuation(row);
    }
    for (const row of snapshot.corporateActions) {
      this.putCorporateAction(row);
    }
    for (const row of snapshot.reconciliations) {
      this.putReconciliation(row);
    }
    for (const row of snapshot.realized) {
      this.recordRealized(row);
    }
  }
}
