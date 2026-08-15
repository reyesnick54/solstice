import type { TreasuryAccount } from './account.ts';
import type { ConcentrationSnapshot, KillSwitch, SettlementExposure } from './controls.ts';
import type { FxInventoryPosition } from './inventory.ts';
import type { TreasuryPosition } from './position.ts';
import type { CashForecast, TreasuryRebalanceProposal } from './proposals.ts';
import type { TreasuryReconciliation } from './reconciliation.ts';
import type { TreasuryLiquidityReservation } from './reservation.ts';
import type { RouteExplanation } from './routing.ts';
import type { ReservationId, TreasuryAccountId } from './ids.ts';

export type TreasurySnapshot = {
  readonly accounts: readonly TreasuryAccount[];
  readonly positions: readonly TreasuryPosition[];
  readonly reservations: readonly TreasuryLiquidityReservation[];
  readonly killSwitches: readonly KillSwitch[];
  readonly concentrations: readonly ConcentrationSnapshot[];
  readonly exposures: readonly SettlementExposure[];
  readonly inventory: readonly FxInventoryPosition[];
  readonly proposals: readonly TreasuryRebalanceProposal[];
  readonly forecasts: readonly CashForecast[];
  readonly reconciliations: readonly TreasuryReconciliation[];
  readonly routeDecisions: Readonly<Record<string, RouteExplanation>>;
};

export class TreasuryStore {
  private readonly accounts = new Map<string, TreasuryAccount>();
  private readonly positions = new Map<string, TreasuryPosition>();
  private readonly reservations = new Map<string, TreasuryLiquidityReservation>();
  private readonly reservationsByIdempotency = new Map<string, ReservationId>();
  private readonly killSwitches = new Map<string, KillSwitch>();
  private readonly concentrations = new Map<string, ConcentrationSnapshot>();
  private readonly exposures = new Map<string, SettlementExposure>();
  private readonly inventory = new Map<string, FxInventoryPosition>();
  private readonly proposals = new Map<string, TreasuryRebalanceProposal>();
  private readonly forecasts = new Map<string, CashForecast>();
  private readonly reconciliations = new Map<string, TreasuryReconciliation>();
  private readonly routeDecisions = new Map<string, RouteExplanation>();
  private readonly locks = new Set<string>();

  putTreasuryAccount(account: TreasuryAccount): void {
    this.accounts.set(account.treasuryAccountId, account);
  }

  getAccount(id: string): TreasuryAccount | undefined {
    return this.accounts.get(id);
  }

  listAccounts(): readonly TreasuryAccount[] {
    return [...this.accounts.values()];
  }

  findPrefundingBook(input: {
    readonly corridorId: string;
    readonly provider: string;
    readonly currency: string;
  }): TreasuryAccount | undefined {
    return [...this.accounts.values()].find(
      (row) =>
        row.kind === 'CORRIDOR_PREFUNDING' &&
        row.corridorId === input.corridorId &&
        row.provider === input.provider &&
        row.currency === input.currency,
    );
  }

  putPosition(position: TreasuryPosition): void {
    this.positions.set(position.treasuryAccountId, position);
  }

  getPosition(treasuryAccountId: string): TreasuryPosition | undefined {
    return this.positions.get(treasuryAccountId);
  }

  listPositions(): readonly TreasuryPosition[] {
    return [...this.positions.values()];
  }

  acquire(treasuryAccountId: string): boolean {
    if (this.locks.has(treasuryAccountId)) {
      return false;
    }
    this.locks.add(treasuryAccountId);
    return true;
  }

  releaseLock(treasuryAccountId: string): void {
    this.locks.delete(treasuryAccountId);
  }

  putReservation(row: TreasuryLiquidityReservation): void {
    this.reservations.set(row.reservationId, row);
    this.reservationsByIdempotency.set(row.idempotencyKey, row.reservationId);
  }

  getReservation(id: string): TreasuryLiquidityReservation | undefined {
    return this.reservations.get(id);
  }

  getReservationByIdempotency(key: string): TreasuryLiquidityReservation | undefined {
    const id = this.reservationsByIdempotency.get(key);
    return id ? this.reservations.get(id) : undefined;
  }

  getReservationByPayment(paymentId: string): TreasuryLiquidityReservation | undefined {
    return [...this.reservations.values()].find((row) => row.paymentId === paymentId);
  }

  listReservations(): readonly TreasuryLiquidityReservation[] {
    return [...this.reservations.values()];
  }

  putKillSwitch(row: KillSwitch): void {
    this.killSwitches.set(row.killSwitchId, row);
  }

  listKillSwitches(): readonly KillSwitch[] {
    return [...this.killSwitches.values()];
  }

  putConcentration(row: ConcentrationSnapshot): void {
    this.concentrations.set(`${row.dimension}:${row.key}`, row);
  }

  getConcentration(dimension: string, key: string): ConcentrationSnapshot | undefined {
    return this.concentrations.get(`${dimension}:${key}`);
  }

  listConcentrations(): readonly ConcentrationSnapshot[] {
    return [...this.concentrations.values()];
  }

  putExposure(row: SettlementExposure): void {
    this.exposures.set(`${row.kind}:${row.key}`, row);
  }

  getExposure(kind: string, key: string): SettlementExposure | undefined {
    return this.exposures.get(`${kind}:${key}`);
  }

  listExposures(): readonly SettlementExposure[] {
    return [...this.exposures.values()];
  }

  putInventory(row: FxInventoryPosition): void {
    this.inventory.set(row.currency, row);
  }

  getInventory(currency: string): FxInventoryPosition | undefined {
    return this.inventory.get(currency);
  }

  listInventory(): readonly FxInventoryPosition[] {
    return [...this.inventory.values()];
  }

  putProposal(row: TreasuryRebalanceProposal): void {
    this.proposals.set(row.proposalId, row);
  }

  getProposal(id: string): TreasuryRebalanceProposal | undefined {
    return this.proposals.get(id);
  }

  listProposals(): readonly TreasuryRebalanceProposal[] {
    return [...this.proposals.values()];
  }

  putForecast(row: CashForecast): void {
    this.forecasts.set(row.forecastId, row);
  }

  listForecasts(): readonly CashForecast[] {
    return [...this.forecasts.values()];
  }

  putReconciliation(row: TreasuryReconciliation): void {
    this.reconciliations.set(row.reconciliationId, row);
  }

  listReconciliations(): readonly TreasuryReconciliation[] {
    return [...this.reconciliations.values()];
  }

  putRouteDecision(paymentId: string, explanation: RouteExplanation): void {
    this.routeDecisions.set(paymentId, explanation);
  }

  getRouteDecision(paymentId: string): RouteExplanation | undefined {
    return this.routeDecisions.get(paymentId);
  }

  snapshot(): TreasurySnapshot {
    return Object.freeze({
      accounts: this.listAccounts(),
      positions: this.listPositions(),
      reservations: this.listReservations(),
      killSwitches: this.listKillSwitches(),
      concentrations: this.listConcentrations(),
      exposures: this.listExposures(),
      inventory: this.listInventory(),
      proposals: this.listProposals(),
      forecasts: this.listForecasts(),
      reconciliations: this.listReconciliations(),
      routeDecisions: Object.freeze(Object.fromEntries(this.routeDecisions)),
    });
  }

  hydrate(snapshot: TreasurySnapshot): void {
    this.accounts.clear();
    this.positions.clear();
    this.reservations.clear();
    this.reservationsByIdempotency.clear();
    this.killSwitches.clear();
    this.concentrations.clear();
    this.exposures.clear();
    this.inventory.clear();
    this.proposals.clear();
    this.forecasts.clear();
    this.reconciliations.clear();
    this.routeDecisions.clear();
    for (const row of snapshot.accounts) {
      this.putTreasuryAccount(row);
    }
    for (const row of snapshot.positions) {
      this.putPosition(row);
    }
    for (const row of snapshot.reservations) {
      this.putReservation(row);
    }
    for (const row of snapshot.killSwitches) {
      this.putKillSwitch(row);
    }
    for (const row of snapshot.concentrations) {
      this.putConcentration(row);
    }
    for (const row of snapshot.exposures) {
      this.putExposure(row);
    }
    for (const row of snapshot.inventory) {
      this.putInventory(row);
    }
    for (const row of snapshot.proposals) {
      this.putProposal(row);
    }
    for (const row of snapshot.forecasts) {
      this.putForecast(row);
    }
    for (const row of snapshot.reconciliations) {
      this.putReconciliation(row);
    }
    for (const [paymentId, explanation] of Object.entries(snapshot.routeDecisions)) {
      this.putRouteDecision(paymentId, explanation);
    }
  }

  positionKey(_id: TreasuryAccountId): string {
    return _id;
  }
}
