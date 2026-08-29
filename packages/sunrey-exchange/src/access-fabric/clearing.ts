import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { Money } from '../../../money/src/money.ts';
import { ACTION_TYPES } from '../../../permissions/src/action-types.ts';
import type { ExecutionAuthority } from '../../../permissions/src/execution-authority.ts';
import { DEMAND_DEPOSIT_TO_PENDING_SETTLEMENT } from '../../../ledger/src/types.ts';
import type { SettlementRails } from '../product/settlement.ts';
import type {
  AccessEntitlementConsiderationLeg,
  AccessEntitlementPort,
  CapacityClearingReceipt,
  ClearingLegReference,
  ConsiderationLeg,
  ConsiderationTerms,
  FiatConsiderationLeg,
  NativeAssetConsiderationLeg,
  RefundSettlementIntent,
  RewardCreditConsiderationLeg,
  RewardCreditPort,
} from './types.ts';
import {
  ACCESS_FABRIC_POSTURE,
  type AccessClearingFailureCode,
  type CapacityClearingOutcome,
  type ConsiderationKind,
} from './taxonomy.ts';
import { compensationIntentFor } from './refunds.ts';

/**
 * Dual-Economy Clearing adapter.
 *
 * Routes each consideration leg to its canonical owner and nowhere else:
 *
 *   FIAT               → canonical Ledger (`Ledger.postJournal`, authority required)
 *   SUNREY_COIN        → canonical custody rail or native chain rail
 *   MOONREY_COIN       → canonical custody rail or native chain rail
 *   ACCESS_ENTITLEMENT → entitlement owner port (consumption reference only)
 *   REWARD_CREDIT      → reward credit owner port (consumption reference only)
 *
 * The adapter holds no balances. It records journal ids, provider transaction
 * references, chain transaction ids, and consumption ids. It never mints either
 * coin, never converts between them, and never introduces a third currency.
 * Legs commit together: if a later leg fails after an earlier one committed, the
 * receipt reports REQUIRES_COMPENSATION and carries compensating intents rather
 * than editing a posting.
 */
export type DualEconomyClearingPorts = {
  readonly rails: SettlementRails;
  readonly entitlements?: AccessEntitlementPort;
  readonly rewards?: RewardCreditPort;
};

export type ClearingRequest = {
  readonly reservationId: string;
  readonly consideration: ConsiderationTerms;
  readonly authority: ExecutionAuthority | null;
  readonly actorId: string;
  readonly at: UtcInstant;
};

export type DeliverySettlementRequest = ClearingRequest & {
  readonly reservedQuantity: bigint;
  readonly deliveredQuantity: bigint;
  readonly deliveryAttested: boolean;
};

export type RefundClearingRequest = ClearingRequest & {
  readonly intent: RefundSettlementIntent;
};

type ClearingDirection = 'RESERVE' | 'CAPTURE' | 'REFUND';

type LegOutcome =
  | { readonly ok: true; readonly reference: ClearingLegReference }
  | {
      readonly ok: false;
      readonly reference: ClearingLegReference;
      readonly failureCode: AccessClearingFailureCode;
    };

const FIAT_MEMO: { readonly [K in ClearingDirection]: string } = Object.freeze({
  RESERVE: 'capacity access consideration reserved against pending settlement',
  CAPTURE: 'capacity access consideration captured on attested delivery',
  REFUND: 'capacity access consideration returned by compensating entry',
});

/**
 * Journal idempotency suffix per phase. The canonical Ledger binds an Execution
 * Authority to a journal key of the form `<authority key>:<known suffix>`, so
 * each phase gets its own journal under one scoped authority.
 */
const FIAT_JOURNAL_SUFFIX: { readonly [K in ClearingDirection]: string } = Object.freeze({
  RESERVE: 'reserve',
  CAPTURE: 'capture-principal',
  REFUND: 'refund',
});

export class DualEconomyClearingAdapter {
  readonly posture = ACCESS_FABRIC_POSTURE;
  private readonly ports: DualEconomyClearingPorts;
  private readonly committedSteps = new Set<string>();

  constructor(ports: DualEconomyClearingPorts) {
    this.ports = ports;
  }

  /** True when this exact clearing step already committed. Replay is blocked, not repeated. */
  alreadyCommitted(phase: CapacityClearingReceipt['phase'], reservationId: string): boolean {
    return this.committedSteps.has(`${phase}:${reservationId}`);
  }

  /**
   * Reserve consideration. The fiat leg moves buyer cash into a
   * pending-settlement reservation account through the canonical Ledger. Native
   * legs are held on custody or chain. Entitlement and reward legs are consumed
   * at the owning port, which is the only place their granted units live.
   */
  reserveConsideration(request: ClearingRequest): CapacityClearingReceipt {
    return this.execute({
      request,
      phase: 'RESERVE_CONSIDERATION',
      legs: request.consideration.legs,
      direction: 'RESERVE',
    });
  }

  /**
   * Settle attested delivery. Under DELIVERY_VERSUS_PAYMENT nothing commits
   * without attested delivery. For partial delivery the caller supplies the
   * exact prorated consideration and refunds the remainder separately.
   */
  settleDelivery(request: DeliverySettlementRequest): CapacityClearingReceipt {
    if (!request.deliveryAttested) {
      return this.refusal(request, 'SETTLE_DELIVERY', 'DELIVERY_EVIDENCE_MISSING');
    }
    if (request.deliveredQuantity > request.reservedQuantity) {
      return this.refusal(request, 'SETTLE_DELIVERY', 'DELIVERY_EXCEEDS_RESERVED');
    }
    return this.execute({
      request,
      phase: 'SETTLE_DELIVERY',
      legs: request.consideration.legs,
      direction: 'CAPTURE',
    });
  }

  /** Return consideration by compensating entry. Never edits or deletes a posting. */
  refund(request: RefundClearingRequest): CapacityClearingReceipt {
    return this.execute({
      request,
      phase: 'REFUND',
      legs: request.intent.legs,
      direction: 'REFUND',
    });
  }

  private execute(input: {
    readonly request: ClearingRequest;
    readonly phase: CapacityClearingReceipt['phase'];
    readonly legs: readonly ConsiderationLeg[];
    readonly direction: ClearingDirection;
  }): CapacityClearingReceipt {
    const { request, phase, legs, direction } = input;
    if (legs.length === 0) {
      return this.refusal(request, phase, 'CONSIDERATION_EMPTY');
    }
    const stepKey = `${phase}:${request.reservationId}`;
    if (this.committedSteps.has(stepKey)) {
      return this.receipt({
        request,
        phase,
        outcome: 'REFUSED',
        legs: [],
        failureCode: 'DUPLICATE_CLEARING_BLOCKED',
        compensations: [],
      });
    }

    const references: ClearingLegReference[] = [];
    let failure: AccessClearingFailureCode | null = null;
    let failedKind: ConsiderationKind | null = null;

    for (const leg of legs) {
      const outcome = this.executeLeg(leg, request, direction);
      references.push(outcome.reference);
      if (!outcome.ok) {
        failure = outcome.failureCode;
        failedKind = leg.kind;
        break;
      }
    }

    if (failure === null) {
      this.committedSteps.add(stepKey);
      return this.receipt({
        request,
        phase,
        outcome: 'CLEARED',
        legs: references,
        failureCode: null,
        compensations: [],
      });
    }

    const committed = references.filter((reference) => reference.committed);
    if (committed.length === 0) {
      return this.receipt({
        request,
        phase,
        outcome: 'FAILED',
        legs: references,
        failureCode: failure,
        compensations: [],
      });
    }

    const compensations = committed.map((reference) =>
      compensationIntentFor({
        reservationId: request.reservationId,
        leg: legOfKind(legs, reference.kind),
        at: request.at,
      }),
    );
    return this.receipt({
      request,
      phase,
      outcome: 'REQUIRES_COMPENSATION',
      legs: references,
      failureCode: failedKind === null ? failure : 'DVP_LEG_FAILED',
      compensations,
    });
  }

  private executeLeg(
    leg: ConsiderationLeg,
    request: ClearingRequest,
    direction: ClearingDirection,
  ): LegOutcome {
    if (leg.kind === 'FIAT') {
      return this.executeFiatLeg(leg, request, direction);
    }
    if (leg.kind === 'SUNREY_COIN' || leg.kind === 'MOONREY_COIN') {
      return this.executeNativeLeg(leg, request, direction);
    }
    if (leg.kind === 'ACCESS_ENTITLEMENT') {
      return this.executeEntitlementLeg(leg, request, direction);
    }
    return this.executeRewardLeg(leg, request, direction);
  }

  /**
   * Fiat consideration always settles on the canonical Ledger. The Execution
   * Authority must be scoped to the account the journal debits: the buyer's cash
   * account when reserving, the reservation account when capturing or refunding.
   */
  private executeFiatLeg(
    leg: FiatConsiderationLeg,
    request: ClearingRequest,
    direction: ClearingDirection,
  ): LegOutcome {
    const rail = this.ports.rails.ledger;
    if (!rail) {
      return legFailure('FIAT', 'LEDGER_FIAT', 'LEDGER_RAIL_MISSING');
    }
    const authority = request.authority;
    if (!authority) {
      return legFailure('FIAT', 'LEDGER_FIAT', 'AUTHORITY_MISSING');
    }
    if (authority.actionType !== ACTION_TYPES.SETTLE_EXCHANGE_TRADE) {
      return legFailure('FIAT', 'LEDGER_FIAT', 'AUTHORITY_SCOPE_MISMATCH');
    }

    rail.registerAccount({
      id: leg.payerCashAccountId,
      name: 'Capacity access buyer cash',
      accountClass: 'DEMAND_DEPOSIT',
      currency: leg.amount.currency,
      ownerId: leg.payerOwnerId,
    });
    rail.registerAccount({
      id: leg.payeeCashAccountId,
      name: 'Capacity access provider cash',
      accountClass: 'DEMAND_DEPOSIT',
      currency: leg.amount.currency,
      ownerId: leg.payeeOwnerId,
    });
    rail.registerAccount({
      id: leg.reservationCashAccountId,
      name: 'Capacity access reservation pending settlement',
      accountClass: 'PENDING_SETTLEMENT',
      currency: leg.amount.currency,
      ownerId: leg.payerOwnerId,
    });

    const amount = Money.fromMinorUnits(leg.amount.minorUnits, leg.amount.currency);
    const postings =
      direction === 'RESERVE'
        ? [
            { accountId: leg.payerCashAccountId, direction: 'DEBIT' as const, amount },
            { accountId: leg.reservationCashAccountId, direction: 'CREDIT' as const, amount },
          ]
        : direction === 'CAPTURE'
          ? [
              { accountId: leg.reservationCashAccountId, direction: 'DEBIT' as const, amount },
              { accountId: leg.payeeCashAccountId, direction: 'CREDIT' as const, amount },
            ]
          : [
              { accountId: leg.reservationCashAccountId, direction: 'DEBIT' as const, amount },
              { accountId: leg.payerCashAccountId, direction: 'CREDIT' as const, amount },
            ];

    const debited = postings.find((posting) => posting.direction === 'DEBIT');
    if (!debited || authority.accountId !== debited.accountId) {
      return legFailure('FIAT', 'LEDGER_FIAT', 'AUTHORITY_SCOPE_MISMATCH');
    }

    try {
      const journal = rail.ledger.postJournal({
        idempotencyKey: `${authority.idempotencyKey}:${FIAT_JOURNAL_SUFFIX[direction]}`,
        executionAuthority: authority,
        actionType: ACTION_TYPES.SETTLE_EXCHANGE_TRADE,
        sourceDomain: 'exchange',
        reference: request.reservationId,
        classBridge: DEMAND_DEPOSIT_TO_PENDING_SETTLEMENT,
        memo: FIAT_MEMO[direction],
        postings,
      });
      return {
        ok: true,
        reference: reference({
          kind: 'FIAT',
          rail: 'LEDGER_FIAT',
          journalId: journal.id,
          committed: true,
        }),
      };
    } catch {
      return legFailure('FIAT', 'LEDGER_FIAT', 'LEDGER_FAILURE');
    }
  }

  /** Native coin consideration always moves on a canonical custody or chain rail. */
  private executeNativeLeg(
    leg: NativeAssetConsiderationLeg,
    request: ClearingRequest,
    direction: ClearingDirection,
  ): LegOutcome {
    if (leg.rail === 'CUSTODY_ASSET') {
      return this.executeCustodyLeg(leg, direction);
    }
    return this.executeChainLeg(leg, request, direction);
  }

  private executeCustodyLeg(
    leg: NativeAssetConsiderationLeg,
    direction: ClearingDirection,
  ): LegOutcome {
    const custody = this.ports.rails.custody;
    if (!custody) {
      return legFailure(leg.kind, 'CUSTODY_ASSET', 'CUSTODY_RAIL_MISSING');
    }
    const vaultId =
      direction === 'REFUND'
        ? (leg.payeeVaultId ?? leg.payeeRef)
        : (leg.payerVaultId ?? leg.payerRef);
    const reserved = custody.reserve({
      vaultId,
      assetId: leg.amount.assetId,
      quantity: leg.amount.scaledUnits,
    });
    if (!reserved.ok) {
      return legFailure(leg.kind, 'CUSTODY_ASSET', 'CUSTODY_UNAVAILABLE');
    }
    if (direction === 'RESERVE') {
      return {
        ok: true,
        reference: reference({
          kind: leg.kind,
          rail: 'CUSTODY_ASSET',
          consumptionId: reserved.reservationId,
          committed: true,
        }),
      };
    }
    const debited = custody.debit({
      reservationId: reserved.reservationId,
      assetId: leg.amount.assetId,
      quantity: leg.amount.scaledUnits,
    });
    if (!debited.ok) {
      return legFailure(leg.kind, 'CUSTODY_ASSET', 'CUSTODY_UNAVAILABLE');
    }
    const finality = custody.queryFinality(debited.providerTxRef);
    const committedReference = reference({
      kind: leg.kind,
      rail: 'CUSTODY_ASSET',
      providerTxRef: debited.providerTxRef,
      consumptionId: reserved.reservationId,
      committed: true,
    });
    if (finality !== 'CONFIRMED') {
      return { ok: false, reference: committedReference, failureCode: 'CUSTODY_UNAVAILABLE' };
    }
    return { ok: true, reference: committedReference };
  }

  private executeChainLeg(
    leg: NativeAssetConsiderationLeg,
    request: ClearingRequest,
    direction: ClearingDirection,
  ): LegOutcome {
    const chain = this.ports.rails.native;
    if (!chain) {
      return legFailure(leg.kind, 'NATIVE_CHAIN', 'CHAIN_RAIL_MISSING');
    }
    const amount = AssetQuantity.fromScaledUnits(leg.amount.scaledUnits, leg.amount.assetId);
    const lockId = `alk_${request.reservationId}_${leg.kind.toLowerCase()}`;

    if (direction === 'RESERVE') {
      const held = chain.port.hold({
        lockId,
        owner: leg.payerRef,
        amount,
        purpose: 'RESOURCE_PURCHASE',
      });
      if (!held.ok) {
        return legFailure(leg.kind, 'NATIVE_CHAIN', 'CHAIN_UNAVAILABLE');
      }
      return {
        ok: true,
        reference: reference({
          kind: leg.kind,
          rail: 'NATIVE_CHAIN',
          chainTxId: held.value.lockId,
          committed: true,
        }),
      };
    }

    const released = chain.port.release(lockId);
    if (direction === 'REFUND' && released.ok) {
      // The reservation lock returned to the payer; no transfer is required.
      return {
        ok: true,
        reference: reference({
          kind: leg.kind,
          rail: 'NATIVE_CHAIN',
          chainTxId: lockId,
          committed: true,
        }),
      };
    }

    const sender = direction === 'CAPTURE' ? leg.payerRef : leg.payeeRef;
    const recipient = direction === 'CAPTURE' ? leg.payeeRef : leg.payerRef;
    const moved = chain.port.transfer({ sender, recipient, amount });
    if (!moved.ok) {
      return legFailure(leg.kind, 'NATIVE_CHAIN', 'CHAIN_UNAVAILABLE');
    }
    const txId = `atx_${request.reservationId}_${leg.kind.toLowerCase()}_${direction.toLowerCase()}`;
    chain.recordTx?.(txId);
    const committedReference = reference({
      kind: leg.kind,
      rail: 'NATIVE_CHAIN',
      chainTxId: txId,
      committed: true,
    });
    if (chain.queryFinality(txId) !== 'BFT_FINALIZED') {
      return { ok: false, reference: committedReference, failureCode: 'CHAIN_UNAVAILABLE' };
    }
    return { ok: true, reference: committedReference };
  }

  /**
   * Entitlement consumption. Units are consumed once, when the reservation is
   * confirmed; delivery does not consume again. The granted amount stays with
   * the entitlement owner and is never copied here.
   */
  private executeEntitlementLeg(
    leg: AccessEntitlementConsiderationLeg,
    request: ClearingRequest,
    direction: ClearingDirection,
  ): LegOutcome {
    const port = this.ports.entitlements;
    if (!port) {
      return legFailure('ACCESS_ENTITLEMENT', 'ENTITLEMENT_PORT', 'ENTITLEMENT_PORT_MISSING');
    }
    const consumptionId = `ent_${request.reservationId}`;
    if (direction === 'CAPTURE') {
      return {
        ok: true,
        reference: reference({
          kind: 'ACCESS_ENTITLEMENT',
          rail: 'ENTITLEMENT_PORT',
          consumptionId,
          committed: false,
        }),
      };
    }
    if (direction === 'REFUND') {
      const restored = port.restore({ consumptionId });
      if (!restored.ok) {
        return legFailure('ACCESS_ENTITLEMENT', 'ENTITLEMENT_PORT', restored.error.code);
      }
      return {
        ok: true,
        reference: reference({
          kind: 'ACCESS_ENTITLEMENT',
          rail: 'ENTITLEMENT_PORT',
          consumptionId,
          committed: true,
        }),
      };
    }
    if (leg.unit !== leg.unit.trim() || leg.unit.length === 0) {
      return legFailure('ACCESS_ENTITLEMENT', 'ENTITLEMENT_PORT', 'ENTITLEMENT_UNIT_MISMATCH');
    }
    const granted = port.grantedUnits({
      entitlementId: leg.entitlementId,
      holderId: leg.holderId,
      unit: leg.unit,
    });
    if (granted < leg.units) {
      return legFailure('ACCESS_ENTITLEMENT', 'ENTITLEMENT_PORT', 'ENTITLEMENT_INSUFFICIENT');
    }
    const consumed = port.consume({
      entitlementId: leg.entitlementId,
      holderId: leg.holderId,
      units: leg.units,
      unit: leg.unit,
      reservationId: request.reservationId,
    });
    if (!consumed.ok) {
      return legFailure('ACCESS_ENTITLEMENT', 'ENTITLEMENT_PORT', consumed.error.code);
    }
    return {
      ok: true,
      reference: reference({
        kind: 'ACCESS_ENTITLEMENT',
        rail: 'ENTITLEMENT_PORT',
        consumptionId: consumed.value.consumptionId,
        committed: true,
      }),
    };
  }

  /** Permitted reward credit consumption. Not money and not redeemable for money. */
  private executeRewardLeg(
    leg: RewardCreditConsiderationLeg,
    request: ClearingRequest,
    direction: ClearingDirection,
  ): LegOutcome {
    const port = this.ports.rewards;
    if (!port) {
      return legFailure('REWARD_CREDIT', 'REWARD_PORT', 'REWARD_PORT_MISSING');
    }
    const consumptionId = `rwd_${request.reservationId}`;
    if (direction === 'CAPTURE') {
      return {
        ok: true,
        reference: reference({
          kind: 'REWARD_CREDIT',
          rail: 'REWARD_PORT',
          consumptionId,
          committed: false,
        }),
      };
    }
    if (direction === 'REFUND') {
      const restored = port.restore({ consumptionId });
      if (!restored.ok) {
        return legFailure('REWARD_CREDIT', 'REWARD_PORT', restored.error.code);
      }
      return {
        ok: true,
        reference: reference({
          kind: 'REWARD_CREDIT',
          rail: 'REWARD_PORT',
          consumptionId,
          committed: true,
        }),
      };
    }
    const permitted = port.permittedUnits({
      programId: leg.programId,
      holderId: leg.holderId,
      permittedUse: leg.permittedUse,
    });
    if (permitted < leg.units) {
      return legFailure('REWARD_CREDIT', 'REWARD_PORT', 'REWARD_NOT_PERMITTED');
    }
    const consumed = port.consume({
      programId: leg.programId,
      holderId: leg.holderId,
      units: leg.units,
      permittedUse: leg.permittedUse,
      reservationId: request.reservationId,
    });
    if (!consumed.ok) {
      return legFailure('REWARD_CREDIT', 'REWARD_PORT', consumed.error.code);
    }
    return {
      ok: true,
      reference: reference({
        kind: 'REWARD_CREDIT',
        rail: 'REWARD_PORT',
        consumptionId: consumed.value.consumptionId,
        committed: true,
      }),
    };
  }

  private refusal(
    request: ClearingRequest,
    phase: CapacityClearingReceipt['phase'],
    failureCode: AccessClearingFailureCode,
  ): CapacityClearingReceipt {
    return this.receipt({ request, phase, outcome: 'FAILED', legs: [], failureCode, compensations: [] });
  }

  private receipt(input: {
    readonly request: ClearingRequest;
    readonly phase: CapacityClearingReceipt['phase'];
    readonly outcome: CapacityClearingOutcome;
    readonly legs: readonly ClearingLegReference[];
    readonly failureCode: AccessClearingFailureCode | null;
    readonly compensations: readonly RefundSettlementIntent[];
  }): CapacityClearingReceipt {
    return Object.freeze({
      receiptId: `xacr_${randomUUID().replace(/-/g, '')}`,
      reservationId: input.request.reservationId,
      outcome: input.outcome,
      phase: input.phase,
      semantics: input.request.consideration.semantics,
      legs: Object.freeze([...input.legs]),
      failureCode: input.failureCode,
      refusalCodes: Object.freeze([]),
      compensations: Object.freeze([...input.compensations]),
      mintsCoin: false,
      productionActivated: false,
      at: input.request.at,
    });
  }
}

function reference(input: {
  readonly kind: ConsiderationKind;
  readonly rail: ClearingLegReference['rail'];
  readonly journalId?: string | null;
  readonly providerTxRef?: string | null;
  readonly chainTxId?: string | null;
  readonly consumptionId?: string | null;
  readonly committed: boolean;
}): ClearingLegReference {
  return Object.freeze({
    kind: input.kind,
    rail: input.rail,
    journalId: input.journalId ?? null,
    providerTxRef: input.providerTxRef ?? null,
    chainTxId: input.chainTxId ?? null,
    consumptionId: input.consumptionId ?? null,
    committed: input.committed,
  });
}

function legFailure(
  kind: ConsiderationKind,
  rail: ClearingLegReference['rail'],
  failureCode: AccessClearingFailureCode,
): LegOutcome {
  return { ok: false, reference: reference({ kind, rail, committed: false }), failureCode };
}

function legOfKind(legs: readonly ConsiderationLeg[], kind: ConsiderationKind): ConsiderationLeg {
  const found = legs.find((leg) => leg.kind === kind);
  if (!found) {
    throw new TypeError(`no consideration leg of kind ${kind}`);
  }
  return found;
}
