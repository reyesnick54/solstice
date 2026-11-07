import { LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED, type Clock } from '@solstice/config';
import { err, ok, type CustomerId, type Result } from '@solstice/domain';
import { localDateKey } from '../../multi-asset/market-calendar/timezone.ts';
import type { HeliosFillId, HeliosOrderId } from '../../order-lifecycle/ids.ts';
import { localDateFromInstant } from './calendar.ts';
import {
  settlementCorrectionIdFor,
  settlementFailureIdFor,
  settlementInstructionIdFor,
  settlementLegIdFor,
  settlementLifecycleIdFor,
  settlementObligationIdFor,
  tradeConfirmationIdFor,
} from './ids.ts';
import {
  actualSettlementEligible,
  contractualSettlementDate,
  resolveActiveSettlementPolicy,
} from './settlement-policy.ts';
import { InMemoryExec09SettlementStore } from './store.ts';
import {
  canTransitionExec09Settlement,
  exec09FillIsNotSettled,
  type Exec09SettlementLifecycleState,
} from './taxonomy.ts';
import type {
  Exec09SettlementDomainFailure,
  ExternalTradeConfirmation,
  OpenSettlementFromFillInput,
  SettlementCorrection,
  SettlementFailure,
  SettlementInstruction,
  SettlementLeg,
  SettlementLifecycle,
  SettlementObligation,
  SettlementCalendarPort,
  VersionedSettlementPolicy,
} from './types.ts';

export const HELIOS_EXEC09_SETTLEMENT_LIFECYCLE = 'HELIOS_EXEC09_SETTLEMENT_LIFECYCLE' as const;

function fail(code: Exec09SettlementDomainFailure['code'], message: string): Result<never, Exec09SettlementDomainFailure> {
  return err({ code, message });
}

function sumDecimalStrings(values: readonly string[]): string {
  return values.reduce((acc, value) => (BigInt(acc) + BigInt(value)).toString(), '0');
}

function transitionObligation(
  obligation: SettlementObligation,
  to: Exec09SettlementLifecycleState,
  extras: Partial<SettlementObligation> = {},
): SettlementObligation {
  if (!canTransitionExec09Settlement(obligation.state, to)) {
    throw new Error(`illegal obligation transition ${obligation.state} → ${to}`);
  }
  return Object.freeze({ ...obligation, ...extras, state: to });
}

function recomputeLifecycleAggregate(
  lifecycle: SettlementLifecycle,
  obligations: readonly SettlementObligation[],
  now: string,
): SettlementLifecycle {
  const settledQuantity = sumDecimalStrings(obligations.map((item) => item.settledQuantityUnits));
  const filledQuantity = lifecycle.filledQuantityUnits;
  let aggregateState: Exec09SettlementLifecycleState = 'PENDING';
  if (obligations.every((item) => item.state === 'CANCELED')) {
    aggregateState = 'CANCELED';
  } else if (obligations.some((item) => item.state === 'FAILED')) {
    aggregateState = 'FAILED';
  } else if (obligations.some((item) => item.state === 'CORRECTED')) {
    aggregateState = 'CORRECTED';
  } else if (BigInt(settledQuantity) > 0n && BigInt(settledQuantity) < BigInt(filledQuantity)) {
    aggregateState = 'PARTIALLY_SETTLED';
  } else if (obligations.length > 0 && obligations.every((item) => item.state === 'SETTLED')) {
    aggregateState = 'SETTLED';
  } else if (obligations.some((item) => item.state === 'SETTLING')) {
    aggregateState = 'SETTLING';
  } else if (obligations.some((item) => item.state === 'AFFIRMED')) {
    aggregateState = 'AFFIRMED';
  } else if (obligations.some((item) => item.state === 'MATCHED')) {
    aggregateState = 'MATCHED';
  }

  const actualDates = obligations
    .map((item) => item.actualSettlementDate)
    .filter((value): value is NonNullable<typeof value> => value !== null);
  const contractualDates = obligations.map((item) => item.contractualSettlementDate);

  return Object.freeze({
    ...lifecycle,
    aggregateState,
    settledQuantityUnits: settledQuantity,
    obligationIds: Object.freeze(obligations.map((item) => item.obligationId)),
    contractualSettlementDate:
      contractualDates.length > 0
        ? contractualDates.sort((left, right) => (left > right ? -1 : 1))[0]!
        : lifecycle.contractualSettlementDate,
    actualSettlementDate:
      actualDates.length > 0 ? actualDates.sort((left, right) => (left > right ? -1 : 1))[0]! : lifecycle.actualSettlementDate,
    updatedAt: now,
  });
}

/**
 * Canonical HELIOS EXEC09 institutional post-trade settlement coordinator.
 * Composes with H23 fills; does not mark positions settled on fill alone.
 */
export class Exec09SettlementLifecycleService {
  private readonly clock: Clock;
  private readonly marketTimeZone: string;
  private readonly marketCalendars: Readonly<Record<string, SettlementCalendarPort>>;
  private readonly currencyCalendars: Readonly<Record<string, SettlementCalendarPort>>;
  readonly store: InMemoryExec09SettlementStore;
  private failureSequence = 0;
  private correctionSequence = 0;

  constructor(input: {
    readonly clock: Clock;
    readonly marketTimeZone?: string;
    readonly marketCalendars: Readonly<Record<string, SettlementCalendarPort>>;
    readonly currencyCalendars: Readonly<Record<string, SettlementCalendarPort>>;
    readonly store?: InMemoryExec09SettlementStore;
    readonly seedPolicies?: readonly VersionedSettlementPolicy[];
  }) {
    this.clock = input.clock;
    this.marketTimeZone = input.marketTimeZone ?? 'America/New_York';
    this.marketCalendars = input.marketCalendars;
    this.currencyCalendars = input.currencyCalendars;
    this.store = input.store ?? new InMemoryExec09SettlementStore();
    for (const policy of input.seedPolicies ?? []) {
      this.store.putPolicy(policy);
    }
  }

  registerPolicy(policy: VersionedSettlementPolicy): void {
    this.store.putPolicy(policy);
  }

  openFromFill(input: OpenSettlementFromFillInput): Result<
    {
      readonly lifecycle: SettlementLifecycle;
      readonly obligation: SettlementObligation;
      readonly confirmation: ExternalTradeConfirmation;
      readonly instruction: SettlementInstruction;
      readonly duplicate: boolean;
    },
    Exec09SettlementDomainFailure
  > {
    if (LIVE_INVESTMENT_EXECUTION || LIVE_TRADING_ENABLED) {
      return fail('LIVE_GATE_BLOCKED', 'live execution gates must remain explicit and disabled');
    }

    const existingObligation = this.store.getObligationByFill(input.fillId);
    if (existingObligation) {
      const lifecycle = this.store.getLifecycle(existingObligation.lifecycleId);
      const confirmation = this.store.getConfirmation(existingObligation.confirmationId);
      if (!lifecycle || !confirmation) {
        return fail('LIFECYCLE_NOT_FOUND', 'existing obligation missing lifecycle artifacts');
      }
      const instruction = [...this.store.snapshot().instructions].find(
        (item) => item.obligationId === existingObligation.obligationId,
      );
      if (!instruction) {
        return fail('OBLIGATION_NOT_FOUND', 'existing obligation missing instruction');
      }
      return ok({
        lifecycle,
        obligation: existingObligation,
        confirmation,
        instruction,
        duplicate: true,
      });
    }

    const policy = resolveActiveSettlementPolicy(this.store.listPolicies(), {
      market: input.market,
      assetClass: input.assetClass,
      jurisdiction: input.jurisdiction,
      tradeTimestamp: input.tradeTimestamp,
      marketTimeZone: this.marketTimeZone,
    });
    if (!policy) {
      return fail('POLICY_NOT_FOUND', 'no versioned settlement policy matched trade');
    }

    const marketCalendar = this.marketCalendars[policy.marketCalendarId];
    const currencyCalendar = this.currencyCalendars[policy.currencyCalendarId];
    if (!marketCalendar || !currencyCalendar) {
      return fail('POLICY_NOT_FOUND', 'settlement policy references unknown calendars');
    }

    const tradeDate = localDateFromInstant(input.tradeTimestamp, this.marketTimeZone);
    const contractualDate = contractualSettlementDate({
      tradeTimestamp: input.tradeTimestamp,
      marketTimeZone: this.marketTimeZone,
      policy,
      marketCalendar,
      currencyCalendar,
    });

    const now = this.clock.now();
    const lifecycleId = settlementLifecycleIdFor(input.orderId);
    let lifecycle = this.store.getLifecycle(lifecycleId);
    if (!lifecycle) {
      lifecycle = Object.freeze({
        lifecycleId,
        orderId: input.orderId,
        customerId: input.customerId,
        providerId: input.providerId,
        market: input.market,
        assetClass: input.assetClass,
        jurisdiction: input.jurisdiction,
        tradeDate,
        aggregateState: 'PENDING',
        obligationIds: Object.freeze([]),
        filledQuantityUnits: '0',
        settledQuantityUnits: '0',
        contractualSettlementDate: contractualDate,
        actualSettlementDate: null,
        createdAt: now,
        updatedAt: now,
        simulation: true,
      });
    }

    const confirmationId = tradeConfirmationIdFor(input.providerTradeId);
    const confirmation: ExternalTradeConfirmation = Object.freeze({
      confirmationId,
      providerId: input.providerId,
      providerTradeId: input.providerTradeId,
      orderId: input.orderId,
      customerId: input.customerId,
      instrumentId: input.instrumentId,
      assetClass: input.assetClass,
      market: input.market,
      jurisdiction: input.jurisdiction,
      side: input.side,
      tradeDate,
      tradeTimestamp: input.tradeTimestamp,
      quantityUnits: input.quantityUnits,
      priceMinorUnits: input.priceMinorUnits,
      notionalMinorUnits: input.notionalMinorUnits,
      feeMinorUnits: input.feeMinorUnits,
      currency: input.currency,
      providerPayloadRef: input.providerPayloadRef ?? null,
      busted: false,
      simulation: true,
    });

    const obligationId = settlementObligationIdFor(input.orderId, input.fillId);
    const instructionId = settlementInstructionIdFor(obligationId);
    const assetLegId = settlementLegIdFor(obligationId, 'ASSET');
    const cashLegId = settlementLegIdFor(obligationId, 'CASH');
    const feeLegId = BigInt(input.feeMinorUnits) > 0n ? settlementLegIdFor(obligationId, 'FEE') : null;

    const legs: SettlementLeg[] = [
      Object.freeze({
        legId: assetLegId,
        obligationId,
        kind: 'ASSET',
        settlementInstructionId: instructionId,
        quantityUnits: input.quantityUnits,
        amountMinorUnits: null,
        currency: null,
        instrumentId: input.instrumentId,
        settledQuantityUnits: '0',
        settledAmountMinorUnits: '0',
        lifecycleState: 'PENDING',
      }),
      Object.freeze({
        legId: cashLegId,
        obligationId,
        kind: 'CASH',
        settlementInstructionId: instructionId,
        quantityUnits: null,
        amountMinorUnits: input.notionalMinorUnits,
        currency: input.currency,
        instrumentId: null,
        settledQuantityUnits: '0',
        settledAmountMinorUnits: '0',
        lifecycleState: 'PENDING',
      }),
    ];
    if (feeLegId) {
      legs.push(
        Object.freeze({
          legId: feeLegId,
          obligationId,
          kind: 'FEE',
          settlementInstructionId: instructionId,
          quantityUnits: null,
          amountMinorUnits: input.feeMinorUnits,
          currency: input.currency,
          instrumentId: null,
          settledQuantityUnits: '0',
          settledAmountMinorUnits: '0',
          lifecycleState: 'PENDING',
        }),
      );
    }

    const obligation: SettlementObligation = Object.freeze({
      obligationId,
      lifecycleId,
      instructionId,
      confirmationId,
      orderId: input.orderId,
      fillId: input.fillId,
      customerId: input.customerId,
      providerId: input.providerId,
      tradeDate,
      contractualSettlementDate: contractualDate,
      actualSettlementDate: null,
      assetLegId,
      cashLegId,
      feeLegId,
      state: 'PENDING',
      quantityUnits: input.quantityUnits,
      settledQuantityUnits: '0',
      notionalMinorUnits: input.notionalMinorUnits,
      settledNotionalMinorUnits: '0',
      feeMinorUnits: input.feeMinorUnits,
      currency: input.currency,
      dvpModel: policy.dvpModel,
      providerSuppliesAtomicDvp: policy.providerSuppliesAtomicDvp,
      createdAt: now,
      updatedAt: now,
      simulation: true,
    });

    const instruction: SettlementInstruction = Object.freeze({
      instructionId,
      obligationId,
      lifecycleId,
      customerId: input.customerId,
      providerId: input.providerId,
      legRefs: Object.freeze(legs.map((leg) => leg.legId)),
      contractualSettlementDate: contractualDate,
      currencyCalendarId: policy.currencyCalendarId,
      marketCalendarId: policy.marketCalendarId,
      policyId: policy.policyId,
      policyVersion: policy.version,
      dvpModel: policy.dvpModel,
      atomicDvpClaimedByProvider: policy.providerSuppliesAtomicDvp,
      createdAt: now,
      simulation: true,
    });

    const existingObligations = lifecycle.obligationIds
      .map((id) => this.store.getObligation(id))
      .filter((item): item is SettlementObligation => item !== null);
    const nextFilled = (BigInt(lifecycle.filledQuantityUnits) + BigInt(input.quantityUnits)).toString();
    const updatedLifecycle = recomputeLifecycleAggregate(
      Object.freeze({
        ...lifecycle,
        filledQuantityUnits: nextFilled,
        obligationIds: Object.freeze([...lifecycle.obligationIds, obligationId]),
        contractualSettlementDate: contractualDate,
        updatedAt: now,
      }),
      [...existingObligations, obligation],
      now,
    );

    this.store.putConfirmation(confirmation);
    this.store.putInstruction(instruction);
    for (const leg of legs) {
      this.store.putLeg(leg);
    }
    this.store.putObligation(obligation);
    this.store.putLifecycle(updatedLifecycle);

    return ok({
      lifecycle: updatedLifecycle,
      obligation,
      confirmation,
      instruction,
      duplicate: false,
    });
  }

  matchObligation(
    obligationId: SettlementObligation['obligationId'],
    customerId: CustomerId,
  ): Result<SettlementObligation, Exec09SettlementDomainFailure> {
    const obligation = this.store.getObligation(obligationId);
    if (!obligation) return fail('OBLIGATION_NOT_FOUND', 'obligation not found');
    if (obligation.customerId !== customerId) return fail('CUSTOMER_MISMATCH', 'customer mismatch');
    if (obligation.state !== 'PENDING') return ok(obligation);
    const now = this.clock.now();
    const matched = transitionObligation(obligation, 'MATCHED', { updatedAt: now });
    this.store.putObligation(matched);
    this.refreshLifecycle(matched.lifecycleId);
    return ok(matched);
  }

  affirmObligation(
    obligationId: SettlementObligation['obligationId'],
    customerId: CustomerId,
  ): Result<SettlementObligation, Exec09SettlementDomainFailure> {
    const obligation = this.store.getObligation(obligationId);
    if (!obligation) return fail('OBLIGATION_NOT_FOUND', 'obligation not found');
    if (obligation.customerId !== customerId) return fail('CUSTOMER_MISMATCH', 'customer mismatch');
    if (obligation.state === 'AFFIRMED' || obligation.state === 'SETTLING' || obligation.state === 'SETTLED') {
      return ok(obligation);
    }
    if (obligation.state !== 'MATCHED') {
      return fail('INVALID_TRANSITION', `cannot affirm from ${obligation.state}`);
    }
    const now = this.clock.now();
    const affirmed = transitionObligation(obligation, 'AFFIRMED', { updatedAt: now });
    this.store.putObligation(affirmed);
    this.refreshLifecycle(affirmed.lifecycleId);
    return ok(affirmed);
  }

  beginSettling(
    obligationId: SettlementObligation['obligationId'],
    customerId: CustomerId,
  ): Result<SettlementObligation, Exec09SettlementDomainFailure> {
    const obligation = this.store.getObligation(obligationId);
    if (!obligation) return fail('OBLIGATION_NOT_FOUND', 'obligation not found');
    if (obligation.customerId !== customerId) return fail('CUSTOMER_MISMATCH', 'customer mismatch');
    if (obligation.state === 'SETTLING' || obligation.state === 'SETTLED' || obligation.state === 'PARTIALLY_SETTLED') {
      return ok(obligation);
    }
    if (obligation.state !== 'AFFIRMED' && obligation.state !== 'FAILED') {
      return fail('INVALID_TRANSITION', `cannot begin settling from ${obligation.state}`);
    }

    const instruction = [...this.store.snapshot().instructions].find((item) => item.obligationId === obligationId);
    if (!instruction) {
      return fail('OBLIGATION_NOT_FOUND', 'instruction missing');
    }
    const currencyCalendar = this.currencyCalendars[instruction.currencyCalendarId];
    if (!currencyCalendar) {
      return fail('POLICY_NOT_FOUND', 'currency calendar missing');
    }
    const now = this.clock.now();
    if (
      !actualSettlementEligible({
        contractualSettlementDate: obligation.contractualSettlementDate,
        now,
        marketTimeZone: this.marketTimeZone,
        currencyCalendar,
      })
    ) {
      return ok(obligation);
    }

    const settling = transitionObligation(obligation, 'SETTLING', { updatedAt: now });
    this.store.putObligation(settling);
    this.refreshLifecycle(settling.lifecycleId);
    return ok(settling);
  }

  completeObligationSettlement(input: {
    readonly obligationId: SettlementObligation['obligationId'];
    readonly customerId: CustomerId;
    readonly settledQuantityUnits?: string;
    readonly settledNotionalMinorUnits?: string;
    readonly evidenceRef?: string | null;
  }): Result<SettlementObligation, Exec09SettlementDomainFailure> {
    const obligation = this.store.getObligation(input.obligationId);
    if (!obligation) return fail('OBLIGATION_NOT_FOUND', 'obligation not found');
    if (obligation.customerId !== input.customerId) return fail('CUSTOMER_MISMATCH', 'customer mismatch');
    const confirmation = this.store.getConfirmation(obligation.confirmationId);
    if (!confirmation || confirmation.busted) {
      return fail('CONFIRMATION_BUSTED', 'trade confirmation is busted');
    }

    const targetQuantity = input.settledQuantityUnits ?? obligation.quantityUnits;
    const targetNotional = input.settledNotionalMinorUnits ?? obligation.notionalMinorUnits;
    const now = this.clock.now();
    const actualDate = localDateKey(now, this.marketTimeZone);

    const partial = BigInt(targetQuantity) < BigInt(obligation.quantityUnits);
    const nextState: Exec09SettlementLifecycleState = partial ? 'PARTIALLY_SETTLED' : 'SETTLED';
    if (obligation.state !== 'SETTLING' && obligation.state !== 'PARTIALLY_SETTLED' && obligation.state !== 'AFFIRMED') {
      return fail('INVALID_TRANSITION', `cannot complete settlement from ${obligation.state}`);
    }

    const updated = transitionObligation(obligation, nextState, {
      settledQuantityUnits: targetQuantity,
      settledNotionalMinorUnits: targetNotional,
      actualSettlementDate: actualDate,
      updatedAt: now,
    });
    this.store.putObligation(updated);
    this.updateLegSettlement(updated, targetQuantity, targetNotional, nextState);
    this.refreshLifecycle(updated.lifecycleId);
    return ok(updated);
  }

  recordFailure(input: {
    readonly obligationId: SettlementObligation['obligationId'];
    readonly customerId: CustomerId;
    readonly kind: SettlementFailure['kind'];
    readonly description: string;
    readonly recoverable: boolean;
    readonly evidenceRef?: string | null;
  }): Result<{ readonly obligation: SettlementObligation; readonly failure: SettlementFailure }, Exec09SettlementDomainFailure> {
    const obligation = this.store.getObligation(input.obligationId);
    if (!obligation) return fail('OBLIGATION_NOT_FOUND', 'obligation not found');
    if (obligation.customerId !== input.customerId) return fail('CUSTOMER_MISMATCH', 'customer mismatch');
    const now = this.clock.now();
    const failureId = settlementFailureIdFor(input.obligationId, (this.failureSequence += 1));
    const failure: SettlementFailure = Object.freeze({
      failureId,
      obligationId: input.obligationId,
      lifecycleId: obligation.lifecycleId,
      kind: input.kind,
      description: input.description,
      recoverable: input.recoverable,
      occurredAt: now,
      evidenceRef: input.evidenceRef ?? null,
      simulation: true,
    });
    this.store.putFailure(failure);

    const failed =
      obligation.state === 'FAILED'
        ? obligation
        : transitionObligation(obligation, 'FAILED', { updatedAt: now });
    this.store.putObligation(failed);
    this.refreshLifecycle(failed.lifecycleId);
    return ok({ obligation: failed, failure });
  }

  applyCorrection(input: {
    readonly obligationId: SettlementObligation['obligationId'];
    readonly customerId: CustomerId;
    readonly kind: SettlementCorrection['kind'];
    readonly description: string;
    readonly quantityDeltaUnits?: string | null;
    readonly notionalDeltaMinorUnits?: string | null;
    readonly feeDeltaMinorUnits?: string | null;
    readonly evidenceRef?: string | null;
  }): Result<{ readonly obligation: SettlementObligation; readonly correction: SettlementCorrection }, Exec09SettlementDomainFailure> {
    const obligation = this.store.getObligation(input.obligationId);
    if (!obligation) return fail('OBLIGATION_NOT_FOUND', 'obligation not found');
    if (obligation.customerId !== input.customerId) return fail('CUSTOMER_MISMATCH', 'customer mismatch');
    const now = this.clock.now();
    const correctionId = settlementCorrectionIdFor(input.obligationId, (this.correctionSequence += 1));
    const correction: SettlementCorrection = Object.freeze({
      correctionId,
      obligationId: input.obligationId,
      lifecycleId: obligation.lifecycleId,
      kind: input.kind,
      priorState: obligation.state,
      quantityDeltaUnits: input.quantityDeltaUnits ?? null,
      notionalDeltaMinorUnits: input.notionalDeltaMinorUnits ?? null,
      feeDeltaMinorUnits: input.feeDeltaMinorUnits ?? null,
      description: input.description,
      correctedAt: now,
      evidenceRef: input.evidenceRef ?? null,
      simulation: true,
    });
    this.store.putCorrection(correction);

    const quantity = input.quantityDeltaUnits
      ? (BigInt(obligation.quantityUnits) + BigInt(input.quantityDeltaUnits)).toString()
      : obligation.quantityUnits;
    const notional = input.notionalDeltaMinorUnits
      ? (BigInt(obligation.notionalMinorUnits) + BigInt(input.notionalDeltaMinorUnits)).toString()
      : obligation.notionalMinorUnits;
    const fee = input.feeDeltaMinorUnits
      ? (BigInt(obligation.feeMinorUnits) + BigInt(input.feeDeltaMinorUnits)).toString()
      : obligation.feeMinorUnits;

    const corrected = transitionObligation(obligation, 'CORRECTED', {
      quantityUnits: quantity,
      notionalMinorUnits: notional,
      feeMinorUnits: fee,
      settledQuantityUnits: '0',
      settledNotionalMinorUnits: '0',
      actualSettlementDate: null,
      updatedAt: now,
    });
    this.store.putObligation(corrected);
    this.refreshLifecycle(corrected.lifecycleId);
    return ok({ obligation: corrected, correction });
  }

  bustTradeConfirmation(
    obligationId: SettlementObligation['obligationId'],
    customerId: CustomerId,
  ): Result<SettlementObligation, Exec09SettlementDomainFailure> {
    const obligation = this.store.getObligation(obligationId);
    if (!obligation) return fail('OBLIGATION_NOT_FOUND', 'obligation not found');
    if (obligation.customerId !== customerId) return fail('CUSTOMER_MISMATCH', 'customer mismatch');
    const confirmation = this.store.getConfirmation(obligation.confirmationId);
    if (!confirmation) return fail('OBLIGATION_NOT_FOUND', 'confirmation missing');
    const now = this.clock.now();
    this.store.putConfirmation(Object.freeze({ ...confirmation, busted: true }));
    const canceled = transitionObligation(obligation, 'CANCELED', {
      settledQuantityUnits: '0',
      settledNotionalMinorUnits: '0',
      actualSettlementDate: null,
      updatedAt: now,
    });
    this.store.putObligation(canceled);
    this.refreshLifecycle(canceled.lifecycleId);
    return ok(canceled);
  }

  fillIsNotSettled(orderId: HeliosOrderId, orderFilled: boolean): boolean {
    const lifecycle = this.store.getLifecycleByOrder(orderId);
    return exec09FillIsNotSettled({
      orderFilled,
      lifecycleState: lifecycle?.aggregateState ?? null,
    });
  }

  private refreshLifecycle(lifecycleId: SettlementLifecycle['lifecycleId']): void {
    const lifecycle = this.store.getLifecycle(lifecycleId);
    if (!lifecycle) return;
    const obligations = this.store.listObligationsForLifecycle(lifecycleId);
    const updated = recomputeLifecycleAggregate(lifecycle, obligations, this.clock.now());
    this.store.putLifecycle(updated);
  }

  private updateLegSettlement(
    obligation: SettlementObligation,
    settledQuantity: string,
    settledNotional: string,
    state: Exec09SettlementLifecycleState,
  ): void {
    const assetLeg = this.store.getLeg(obligation.assetLegId);
    const cashLeg = this.store.getLeg(obligation.cashLegId);
    if (assetLeg) {
      this.store.putLeg(
        Object.freeze({
          ...assetLeg,
          settledQuantityUnits: settledQuantity,
          lifecycleState: state,
        }),
      );
    }
    if (cashLeg) {
      this.store.putLeg(
        Object.freeze({
          ...cashLeg,
          settledAmountMinorUnits: settledNotional,
          lifecycleState: state,
        }),
      );
    }
    if (obligation.feeLegId) {
      const feeLeg = this.store.getLeg(obligation.feeLegId);
      if (feeLeg) {
        this.store.putLeg(
          Object.freeze({
            ...feeLeg,
            settledAmountMinorUnits: obligation.feeMinorUnits,
            lifecycleState: state,
          }),
        );
      }
    }
  }
}
