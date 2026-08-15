import type { Clock } from '../../config/src/clock.ts';
import type { Account } from '../../domain/src/account.ts';
import type { Customer } from '../../domain/src/customer.ts';
import { isOk } from '../../domain/src/result.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import { actionTypesFromCapabilities, type IdentityAuthorityPort } from '../../identity/src/index.ts';
import type { ComplianceKernel } from '../../kernel/src/kernel.ts';
import type { KernelFacts } from '../../kernel/src/proofs.ts';
import type { Ledger } from '../../ledger/src/journal.ts';
import { Money } from '../../money/src/money.ts';
import type {
  CommitTreasuryLiquidityIntent,
  ExecuteTreasuryRebalanceIntent,
  ProposeTreasuryRebalanceIntent,
  ReleaseTreasuryLiquidityIntent,
  ReserveTreasuryLiquidityIntent,
  SetTreasuryKillSwitchIntent,
} from '../../permissions/src/action-types.ts';
import type { ActionIntent } from '../../permissions/src/action-intent.ts';
import type { AuthorizationDecision } from '../../permissions/src/decision.ts';
import type { AuthorityIssuer, ExecutionAuthority } from '../../permissions/src/execution-authority.ts';
import { validateIntentStructure, type StructuralCatalog } from '../../permissions/src/structural.ts';
import type { PaymentRoute, RouteHardConstraints } from '../../payments/src/route.ts';
import type { TreasuryAdvisor, TreasuryAdvisorReserveInput, TreasuryRouteAdvice } from '../../payments/src/treasury-port.ts';
import { concentrationOf, freezeKillSwitch, nextSettlementState, type KillSwitch, type SettlementExposure } from './controls.ts';
import { asConcentrationSnapshotId, asForecastId, asKillSwitchId, asRebalanceProposalId, asReconciliationId, asReservationId, asSettlementExposureId } from './ids.ts';
import { FORECAST_VERSION, freezeForecast, freezeProposal, type CashForecast } from './proposals.ts';
import { applyCommit, applyRelease, applyReplenish, applyReserve, applyTransfer, totalUsableLiquidity } from './position.ts';
import { requiredLiquidityFor } from './prefunding.ts';
import { reconcileTreasury } from './reconciliation.ts';
import { canCommit, canRelease, freezeReservation, type TreasuryLiquidityReservation } from './reservation.ts';
import { enrichRoute, selectTreasuryRoute, type EnrichedRoute, type RouteExplanation, type TreasuryRouteFacts, type TreasuryRouteSelection } from './routing.ts';
import { registerTreasuryLedgerBooks, seedTreasuryStore } from './seed.ts';
import { simulateRoutingScenario, type RoutingScenario } from './simulator.ts';
import { TreasuryStore } from './store.ts';

export type TreasuryCatalogPorts = {
  readonly customers: { get(id: Customer['id']): Customer | undefined };
  readonly accounts: {
    get(id: Account['id']): Account | undefined;
    list(): readonly Account[];
  };
  readonly products: StructuralCatalog['products'];
  readonly legalEntities: StructuralCatalog['legalEntities'];
};

export type TreasuryServiceOutcome<T> =
  | { readonly outcome: 'OK'; readonly value: T; readonly decision: AuthorizationDecision; readonly replay?: boolean }
  | { readonly outcome: 'KERNEL_REFUSED'; readonly decision: AuthorizationDecision }
  | {
      readonly outcome: 'REJECTED';
      readonly code: string;
      readonly message: string;
      readonly decision: AuthorizationDecision | null;
    };

export class TreasuryService implements TreasuryAdvisor {
  private readonly kernel: ComplianceKernel;
  private readonly issuer: AuthorityIssuer;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly clock: Clock;
  private readonly catalog: TreasuryCatalogPorts;
  private readonly identity: IdentityAuthorityPort;
  private readonly ledger: Ledger | undefined;
  readonly store: TreasuryStore;

  constructor(
    kernel: ComplianceKernel,
    issuer: AuthorityIssuer,
    evidence: EvidenceVault,
    events: DomainEventLog,
    clock: Clock,
    catalog: TreasuryCatalogPorts,
    identity: IdentityAuthorityPort,
    options: { readonly store?: TreasuryStore; readonly ledger?: Ledger; readonly seed?: boolean } = {},
  ) {
    this.kernel = kernel;
    this.issuer = issuer;
    this.evidence = evidence;
    this.events = events;
    this.clock = clock;
    this.catalog = catalog;
    this.identity = identity;
    this.ledger = options.ledger;
    this.store = options.store ?? new TreasuryStore();
    if (options.ledger) {
      registerTreasuryLedgerBooks(options.ledger.accounts);
    }
    if (options.seed !== false && this.store.listAccounts().length === 0) {
      seedTreasuryStore(this.store);
    }
  }

  selectForPayment(
    candidates: readonly PaymentRoute[],
    constraints: RouteHardConstraints,
    facts: TreasuryRouteFacts,
  ): TreasuryRouteSelection {
    const enriched: EnrichedRoute[] = candidates.map((route) => {
      const book = this.store.findPrefundingBook({
        corridorId: route.corridorId,
        provider: route.provider,
        currency: facts.destinationCurrency,
      });
      const position = book ? this.store.getPosition(book.treasuryAccountId) : undefined;
      const concentration = this.store.getConcentration('provider', route.provider);
      return enrichRoute(
        route,
        facts,
        book,
        position,
        concentration?.ratioBps ?? 0n,
        this.store.getExposure('PROVIDER', route.provider)?.state ?? 'NORMAL',
      );
    });
    const concentrations = new Map(
      this.store.listConcentrations().map((row) => [row.key, row] as const),
    );
    const exposures = new Map(
      this.store.listExposures().map((row) => [`${row.kind}:${row.key}`, row] as const),
    );
    const selection = selectTreasuryRoute(
      enriched,
      constraints,
      facts,
      this.store.listKillSwitches(),
      concentrations,
      exposures,
      null,
    );
    return selection;
  }

  rememberDecision(paymentId: string, explanation: TreasuryRouteAdvice['explanation']): void {
    const recorded: RouteExplanation =
      'scoreComponents' in explanation
        ? (explanation as RouteExplanation)
        : {
            routingVersion: explanation.routingVersion,
            selectedRouteId: explanation.selectedRouteId,
            eligible: explanation.eligible,
            rejected: explanation.rejected,
            whySelected: explanation.whySelected,
            scoreComponents: Object.freeze({}),
            liquiditySnapshotId: null,
          };
    this.store.putRouteDecision(paymentId, recorded);
    this.emit('TreasuryRouteSelected', paymentId, {
      paymentId,
      selectedRouteId: explanation.selectedRouteId,
      routingVersion: explanation.routingVersion,
      whySelected: explanation.whySelected,
    });
    this.evidence.seal('TREASURY_ROUTE_SELECTED', {
      paymentId,
      selectedRouteId: explanation.selectedRouteId,
      routingVersion: explanation.routingVersion,
      rejected: explanation.rejected,
      eligible: explanation.eligible,
    });
  }

  reserveForPayment(input: TreasuryAdvisorReserveInput): { ok: true; reservationId: string } | { ok: false; code: string; message: string } {
    const existing = this.store.getReservationByIdempotency(input.idempotencyKey);
    if (existing) {
      return { ok: true, reservationId: existing.reservationId };
    }
    const halt = this.store.listKillSwitches().find((row) => row.enabled && (row.scope === 'HALT_RESERVATIONS' || row.scope === 'RECONCILIATION_ONLY'));
    if (halt) {
      return { ok: false, code: 'TREASURY_HALTED', message: halt.scope };
    }
    const book = this.store.findPrefundingBook({
      corridorId: input.corridorId,
      provider: input.provider,
      currency: input.requiredLiquidity.currency,
    });
    if (!book) {
      return { ok: false, code: 'NO_PREFUNDING_BOOK', message: 'no destination prefunding book' };
    }
    if (!this.store.acquire(book.treasuryAccountId)) {
      return { ok: false, code: 'TREASURY_BUSY', message: 'position locked' };
    }
    try {
      const position = this.store.getPosition(book.treasuryAccountId);
      if (!position) {
        return { ok: false, code: 'NO_POSITION', message: 'missing treasury position' };
      }
      const reserved = applyReserve(position, input.requiredLiquidity, this.clock.now());
      this.store.putPosition(reserved);
      const reservation = freezeReservation({
        reservationId: asReservationId(`tres_${input.paymentId}`),
        treasuryAccountId: book.treasuryAccountId,
        paymentId: input.paymentId,
        amount: input.requiredLiquidity,
        currency: input.requiredLiquidity.currency,
        state: 'ACTIVE',
        idempotencyKey: input.idempotencyKey,
        authorityId: input.authority.authorityId,
        createdAt: this.clock.now(),
        updatedAt: this.clock.now(),
        expiresAt: null,
      });
      this.store.putReservation(reservation);
      this.recordExposure(input.paymentId, input.provider, input.corridorId, input.requiredLiquidity, 'SUBMITTED_UNSETTLED');
      this.emit('TreasuryLiquidityReserved', reservation.reservationId, {
        reservationId: reservation.reservationId,
        paymentId: input.paymentId,
        treasuryAccountId: book.treasuryAccountId,
        amountMinorUnits: input.requiredLiquidity.minorUnits.toString(),
        currency: input.requiredLiquidity.currency,
      });
      this.evidence.seal('TREASURY_LIQUIDITY_RESERVED', {
        paymentId: input.paymentId,
        reservationId: reservation.reservationId,
        treasuryAccountId: book.treasuryAccountId,
        authorityId: input.authority.authorityId,
        amountMinorUnits: input.requiredLiquidity.minorUnits.toString(),
        currency: input.requiredLiquidity.currency,
      });
      return { ok: true, reservationId: reservation.reservationId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'reserve_failed';
      return { ok: false, code: message === 'INSUFFICIENT_TREASURY_LIQUIDITY' ? 'INSUFFICIENT_TREASURY_LIQUIDITY' : 'RESERVE_FAILED', message };
    } finally {
      this.store.releaseLock(book.treasuryAccountId);
    }
  }

  onPaymentSettled(paymentId: string, authority: ExecutionAuthority): void {
    const reservation = this.store.getReservationByPayment(paymentId);
    if (!reservation || !canCommit(reservation.state)) {
      return;
    }
    this.commitInternal(reservation, authority);
  }

  onPaymentFailed(paymentId: string, authority: ExecutionAuthority, _reason: string): void {
    const reservation = this.store.getReservationByPayment(paymentId);
    if (!reservation || !canRelease(reservation.state)) {
      return;
    }
    this.releaseInternal(reservation, authority, 'RELEASED');
  }

  onSubmissionUnknown(paymentId: string): void {
    const reservation = this.store.getReservationByPayment(paymentId);
    if (!reservation) {
      return;
    }
    this.recordExposure(paymentId, 'unknown', 'unknown', reservation.amount, 'SUBMISSION_UNKNOWN');
    this.emit('TreasuryExposureElevated', paymentId, {
      paymentId,
      reservationId: reservation.reservationId,
      state: 'ELEVATED',
      kind: 'SUBMISSION_UNKNOWN',
    });
  }

  reserveLiquidity(intent: ReserveTreasuryLiquidityIntent): TreasuryServiceOutcome<TreasuryLiquidityReservation> {
    const replayed = this.store.getReservationByIdempotency(intent.idempotencyKey);
    if (replayed) {
      return { outcome: 'OK', value: replayed, decision: this.emptyDecision(intent.actionType, intent.id), replay: true };
    }
    const gated = this.gate(intent);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const reserved = this.reserveForPayment({
      paymentId: intent.payload.paymentId,
      corridorId: intent.payload.corridorId,
      provider: intent.payload.provider,
      requiredLiquidity: intent.payload.amount,
      authority: gated.authority,
      idempotencyKey: intent.idempotencyKey,
    });
    if (!reserved.ok) {
      return { outcome: 'REJECTED', code: reserved.code, message: reserved.message, decision: gated.decision };
    }
    return { outcome: 'OK', value: this.store.getReservation(reserved.reservationId)!, decision: gated.decision };
  }

  releaseReservation(intent: ReleaseTreasuryLiquidityIntent): TreasuryServiceOutcome<TreasuryLiquidityReservation> {
    const gated = this.gate(intent);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const reservation = this.store.getReservation(intent.payload.reservationId);
    if (!reservation) {
      return { outcome: 'REJECTED', code: 'RESERVATION_NOT_FOUND', message: 'reservation does not exist', decision: gated.decision };
    }
    if (reservation.state === 'RELEASED' || reservation.state === 'CANCELLED') {
      return { outcome: 'OK', value: reservation, decision: gated.decision, replay: true };
    }
    if (!canRelease(reservation.state)) {
      return { outcome: 'REJECTED', code: 'RESERVATION_NOT_RELEASABLE', message: reservation.state, decision: gated.decision };
    }
    return { outcome: 'OK', value: this.releaseInternal(reservation, gated.authority, 'RELEASED'), decision: gated.decision };
  }

  commitReservation(intent: CommitTreasuryLiquidityIntent): TreasuryServiceOutcome<TreasuryLiquidityReservation> {
    const gated = this.gate(intent);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const reservation = this.store.getReservation(intent.payload.reservationId);
    if (!reservation) {
      return { outcome: 'REJECTED', code: 'RESERVATION_NOT_FOUND', message: 'reservation does not exist', decision: gated.decision };
    }
    if (reservation.state === 'COMMITTED') {
      return { outcome: 'OK', value: reservation, decision: gated.decision, replay: true };
    }
    if (!canCommit(reservation.state)) {
      return { outcome: 'REJECTED', code: 'RESERVATION_NOT_COMMITTING', message: reservation.state, decision: gated.decision };
    }
    return { outcome: 'OK', value: this.commitInternal(reservation, gated.authority), decision: gated.decision };
  }

  proposeRebalance(intent: ProposeTreasuryRebalanceIntent): TreasuryServiceOutcome<ReturnType<typeof freezeProposal>> {
    const existing = this.store.getProposal(intent.payload.proposalId);
    if (existing) {
      return { outcome: 'OK', value: existing, decision: this.emptyDecision(intent.actionType, intent.id), replay: true };
    }
    const gated = this.gate(intent);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const proposal = freezeProposal({
      proposalId: asRebalanceProposalId(intent.payload.proposalId),
      sourceTreasuryAccountId: intent.payload.sourceTreasuryAccountId as never,
      destinationTreasuryAccountId: intent.payload.destinationTreasuryAccountId as never,
      amount: intent.payload.amount,
      narrative: intent.payload.narrative,
      state: 'PROPOSED',
      executable: false,
      authorityId: gated.authority.authorityId,
      createdAt: this.clock.now(),
      updatedAt: this.clock.now(),
    });
    this.store.putProposal(proposal);
    this.emit('TreasuryRebalanceProposed', proposal.proposalId, {
      proposalId: proposal.proposalId,
      sourceTreasuryAccountId: proposal.sourceTreasuryAccountId,
      destinationTreasuryAccountId: proposal.destinationTreasuryAccountId,
      amountMinorUnits: proposal.amount.minorUnits.toString(),
      currency: proposal.amount.currency,
    });
    return { outcome: 'OK', value: proposal, decision: gated.decision };
  }

  executeRebalance(intent: ExecuteTreasuryRebalanceIntent): TreasuryServiceOutcome<ReturnType<typeof freezeProposal>> {
    const gated = this.gate(intent);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const proposal = this.store.getProposal(intent.payload.proposalId);
    if (!proposal) {
      return { outcome: 'REJECTED', code: 'PROPOSAL_NOT_FOUND', message: 'proposal does not exist', decision: gated.decision };
    }
    if (proposal.state === 'EXECUTED') {
      return { outcome: 'OK', value: proposal, decision: gated.decision, replay: true };
    }
    if (proposal.state !== 'PROPOSED') {
      return { outcome: 'REJECTED', code: 'PROPOSAL_NOT_EXECUTABLE', message: proposal.state, decision: gated.decision };
    }
    const source = this.store.getPosition(proposal.sourceTreasuryAccountId);
    const destination = this.store.getPosition(proposal.destinationTreasuryAccountId);
    if (!source || !destination) {
      return { outcome: 'REJECTED', code: 'POSITION_MISSING', message: 'source or destination position missing', decision: gated.decision };
    }
    try {
      const moved = applyTransfer(source, destination, proposal.amount, this.clock.now());
      this.store.putPosition(moved.source);
      this.store.putPosition(moved.destination);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'transfer_failed';
      return { outcome: 'REJECTED', code: message, message, decision: gated.decision };
    }
    if (this.ledger) {
      const sourceAccount = this.store.getAccount(proposal.sourceTreasuryAccountId);
      const destAccount = this.store.getAccount(proposal.destinationTreasuryAccountId);
      if (sourceAccount?.ledgerAccountId && destAccount?.ledgerAccountId) {
        this.ledger.postJournal({
          idempotencyKey: gated.authority.idempotencyKey,
          executionAuthority: gated.authority,
          actionType: intent.actionType,
          memo: 'TREASURY_REBALANCE',
          postings: [
            { accountId: destAccount.ledgerAccountId, direction: 'DEBIT', amount: proposal.amount },
            { accountId: sourceAccount.ledgerAccountId, direction: 'CREDIT', amount: proposal.amount },
          ],
        });
      }
    }
    const executed = freezeProposal({
      ...proposal,
      state: 'EXECUTED',
      executable: true,
      authorityId: gated.authority.authorityId,
      updatedAt: this.clock.now(),
    });
    this.store.putProposal(executed);
    return { outcome: 'OK', value: executed, decision: gated.decision };
  }

  setKillSwitch(intent: SetTreasuryKillSwitchIntent): TreasuryServiceOutcome<KillSwitch> {
    const gated = this.gate(intent);
    if (gated.outcome !== 'ALLOWED') {
      return gated.result;
    }
    const row = freezeKillSwitch({
      killSwitchId: asKillSwitchId(intent.payload.killSwitchId),
      scope: intent.payload.scope,
      target: intent.payload.target,
      enabled: intent.payload.enabled,
      reason: intent.payload.reason,
      createdAt: this.clock.now(),
      updatedAt: this.clock.now(),
    });
    this.store.putKillSwitch(row);
    const eventType = row.scope === 'CORRIDOR' && row.enabled ? 'TreasuryCorridorHalted' : 'TreasuryProviderRestricted';
    this.emit(eventType, row.killSwitchId, {
      killSwitchId: row.killSwitchId,
      scope: row.scope,
      target: row.target,
      enabled: row.enabled,
    });
    return { outcome: 'OK', value: row, decision: gated.decision };
  }

  replenish(treasuryAccountId: string, amount: Money): void {
    const position = this.store.getPosition(treasuryAccountId);
    if (!position) {
      throw new Error('position missing');
    }
    this.store.putPosition(applyReplenish(position, amount, this.clock.now()));
  }

  forecast(currency: string, horizonMs: bigint): CashForecast {
    const positions = this.store.listPositions().filter((row) => row.currency === currency);
    const opening = positions.reduce((sum, row) => sum.plus(totalUsableLiquidity(row)), Money.zero(currency));
    const reserved = positions.reduce((sum, row) => sum.plus(row.reserved), Money.zero(currency));
    const inbound = positions.reduce((sum, row) => sum.plus(row.pendingInbound), Money.zero(currency));
    const outbound = positions.reduce((sum, row) => sum.plus(row.pendingOutbound), Money.zero(currency));
    const projected = opening.plus(inbound).minus(outbound);
    const row = freezeForecast({
      forecastId: asForecastId(`tf_${currency}_${horizonMs.toString()}`),
      horizonMs,
      currency,
      openingAvailable: opening,
      projectedAvailable: projected,
      pendingInbound: inbound,
      pendingOutbound: outbound,
      reserved,
      sourceFacts: Object.freeze([
        `positions:${positions.length}`,
        `reservations:${this.store.listReservations().filter((r) => r.currency === currency && r.state === 'ACTIVE').length}`,
      ]),
      assumptions: Object.freeze([
        { key: 'no_llm', value: 'deterministic arithmetic only' },
        { key: 'historicalVolumes', value: 'simulation seed, not a yield' },
      ]),
      version: FORECAST_VERSION,
      generatedAt: this.clock.now(),
    });
    this.store.putForecast(row);
    return row;
  }

  reconcilePayment(input: {
    readonly paymentId: string;
    readonly paymentStatus: string | null;
    readonly ledgerJournalIds: readonly string[];
    readonly providerBalanceMinor: bigint | null;
    readonly railReportPresent: boolean;
  }): ReturnType<typeof reconcileTreasury> {
    const reservation = this.store.getReservationByPayment(input.paymentId);
    const position = reservation ? this.store.getPosition(reservation.treasuryAccountId) : undefined;
    const result = reconcileTreasury({
      reconciliationId: asReconciliationId(`trrec_${input.paymentId}`),
      subjectId: input.paymentId,
      paymentId: input.paymentId,
      reservationId: reservation?.reservationId ?? null,
      reservationState: reservation?.state ?? null,
      paymentStatus: input.paymentStatus,
      ledgerJournalIds: input.ledgerJournalIds,
      providerBalanceMinor: input.providerBalanceMinor,
      internalAvailableMinor: position ? totalUsableLiquidity(position).minorUnits : null,
      railReportPresent: input.railReportPresent,
      now: this.clock.now(),
    });
    this.store.putReconciliation(result);
    if (result.status === 'MISMATCH' || result.status === 'INVESTIGATION_REQUIRED') {
      this.emit('TreasuryReconciliationMismatch', result.reconciliationId, {
        reconciliationId: result.reconciliationId,
        paymentId: input.paymentId,
        status: result.status,
        mismatches: result.mismatches,
      });
    }
    return result;
  }

  simulate(input: {
    readonly candidates: readonly EnrichedRoute[];
    readonly constraints: RouteHardConstraints;
    readonly facts: TreasuryRouteFacts;
    readonly scenario: RoutingScenario;
  }): TreasuryRouteSelection {
    return simulateRoutingScenario({
      candidates: input.candidates,
      constraints: input.constraints,
      facts: input.facts,
      switches: this.store.listKillSwitches(),
      scenario: input.scenario,
      now: this.clock.now(),
    });
  }

  snapshotConcentration(provider: string, exposure: Money, thresholdMinorUnits: bigint): void {
    this.store.putConcentration(
      concentrationOf(
        asConcentrationSnapshotId(`conc_${provider}_${exposure.currency}`),
        'provider',
        provider,
        exposure,
        thresholdMinorUnits,
        this.clock.now(),
      ),
    );
  }

  requiredLiquidityFor = requiredLiquidityFor;

  private commitInternal(
    reservation: TreasuryLiquidityReservation,
    authority: ExecutionAuthority,
  ): TreasuryLiquidityReservation {
    const position = this.store.getPosition(reservation.treasuryAccountId);
    if (!position) {
      throw new Error('position missing');
    }
    this.store.putPosition(applyCommit(position, reservation.amount, this.clock.now()));
    const next = freezeReservation({
      ...reservation,
      state: 'COMMITTED',
      authorityId: authority.authorityId,
      updatedAt: this.clock.now(),
    });
    this.store.putReservation(next);
    this.emit('TreasuryLiquidityCommitted', next.reservationId, {
      reservationId: next.reservationId,
      paymentId: next.paymentId,
    });
    return next;
  }

  private releaseInternal(
    reservation: TreasuryLiquidityReservation,
    authority: ExecutionAuthority,
    state: 'RELEASED' | 'CANCELLED',
  ): TreasuryLiquidityReservation {
    const position = this.store.getPosition(reservation.treasuryAccountId);
    if (!position) {
      throw new Error('position missing');
    }
    this.store.putPosition(applyRelease(position, reservation.amount, this.clock.now()));
    const next = freezeReservation({
      ...reservation,
      state,
      authorityId: authority.authorityId,
      updatedAt: this.clock.now(),
    });
    this.store.putReservation(next);
    this.emit('TreasuryLiquidityReleased', next.reservationId, {
      reservationId: next.reservationId,
      paymentId: next.paymentId,
      state,
    });
    return next;
  }

  private recordExposure(
    paymentId: string,
    provider: string,
    corridorId: string,
    amount: Money,
    kind: SettlementExposure['kind'],
  ): void {
    const current = this.store.getExposure(kind, paymentId);
    const state = nextSettlementState(current?.state ?? 'NORMAL', kind === 'SUBMISSION_UNKNOWN' ? 'ELEVATE' : 'NORMALIZE');
    this.store.putExposure({
      exposureId: asSettlementExposureId(`texp_${kind}_${paymentId}`),
      kind,
      key: paymentId,
      amount,
      state,
      paymentId,
      updatedAt: this.clock.now(),
    });
    this.store.putExposure({
      exposureId: asSettlementExposureId(`texp_provider_${provider}`),
      kind: 'PROVIDER',
      key: provider,
      amount,
      state,
      paymentId,
      updatedAt: this.clock.now(),
    });
    this.store.putExposure({
      exposureId: asSettlementExposureId(`texp_corridor_${corridorId}`),
      kind: 'CORRIDOR',
      key: corridorId,
      amount,
      state,
      paymentId,
      updatedAt: this.clock.now(),
    });
  }

  private gate(intent: ActionIntent):
    | { readonly outcome: 'ALLOWED'; readonly decision: AuthorizationDecision; readonly authority: ExecutionAuthority }
    | { readonly outcome: 'REFUSED'; readonly result: TreasuryServiceOutcome<never> } {
    const account = this.catalog.accounts.get((intent.payload as { accountId?: Account['id'] }).accountId as Account['id']);
    const customer = account ? this.catalog.customers.get(account.ownerId) : undefined;
    const resolved = this.identity.resolveActorContext(intent.actorId);
    const product = account ? this.catalog.products.get(account.productId) : undefined;
    const legalEntity = account ? this.catalog.legalEntities.get(account.legalEntityId) : undefined;
    const facts: KernelFacts = {
      actor: {
        id: intent.actorId,
        capabilities: resolved.ok ? actionTypesFromCapabilities(resolved.value.authorizedCapabilities) : [],
      },
      identity: this.identity.identityFactsFor(intent.actorId),
      ...(customer ? { customer } : {}),
      ...(legalEntity ? { legalEntity } : {}),
      ...(product ? { product } : {}),
      ...(account ? { sourceAccount: account, jurisdiction: account.jurisdiction } : {}),
      ...((intent.payload as { amount?: Money }).amount ? { amount: (intent.payload as { amount: Money }).amount } : {}),
    };
    const decision = this.kernel.submit(intent, facts);
    this.emit('KernelDecisionRecorded', intent.id, {
      intentId: intent.id,
      actionType: intent.actionType,
      status: decision.status,
      evidenceRecordId: decision.evidenceRecordId,
      executionAuthorityId: decision.executionAuthority?.authorityId ?? null,
    });
    if (decision.status !== 'ALLOW') {
      this.evidence.seal(`${intent.actionType}_KERNEL_REFUSED`, {
        intentId: intent.id,
        status: decision.status,
        posted: false,
      });
      return { outcome: 'REFUSED', result: { outcome: 'KERNEL_REFUSED', decision } };
    }
    const structural = validateIntentStructure(intent, {
      products: this.catalog.products,
      legalEntities: this.catalog.legalEntities,
      accounts: this.catalog.accounts,
    });
    if (!isOk(structural)) {
      return {
        outcome: 'REFUSED',
        result: { outcome: 'REJECTED', code: structural.error.code, message: structural.error.message, decision },
      };
    }
    if (!decision.executionAuthority) {
      return {
        outcome: 'REFUSED',
        result: { outcome: 'REJECTED', code: 'MISSING_EXECUTION_AUTHORITY', message: 'ALLOW without authority', decision },
      };
    }
    const verified = this.issuer.verify(
      decision.executionAuthority,
      {
        actionType: intent.actionType,
        accountId: String((intent.payload as { accountId?: string }).accountId ?? intent.id),
        intentId: intent.id,
      },
      this.clock,
    );
    if (!isOk(verified)) {
      return {
        outcome: 'REFUSED',
        result: { outcome: 'REJECTED', code: verified.error.code, message: verified.error.message, decision },
      };
    }
    return { outcome: 'ALLOWED', decision, authority: verified.value };
  }

  private emptyDecision(actionType: string, intentId: string): AuthorizationDecision {
    return Object.freeze({
      intentId,
      actionType,
      status: 'ALLOW',
      decidedAt: this.clock.now(),
      proofs: Object.freeze([]),
      evidenceRecordId: 'replay',
      executionAuthority: null,
    }) as AuthorizationDecision;
  }

  private emit(eventType: string, aggregateId: string, payload: Record<string, unknown>): void {
    this.events.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
      aggregateType: eventType.startsWith('Treasury') ? 'treasury' : 'intent',
      aggregateId,
    } as never);
  }
}
