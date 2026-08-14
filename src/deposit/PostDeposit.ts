import { randomUUID } from "node:crypto";
import type { AuthorityIssuer } from "../authority/ExecutionAuthority.ts";
import type { Clock } from "../clock.ts";
import { DomainEventLog, type DepositPostedEvent } from "../events/DomainEvents.ts";
import type { EvidenceVault } from "../evidence/EvidenceVault.ts";
import { assertSimulationOnly } from "../flags/capabilities.ts";
import type { GrowthAttributionLedger } from "../growth/GrowthAttributionLedger.ts";
import {
  ActionType,
  type PostDepositIntent,
} from "../kernel/ActionIntent.ts";
import { Ledger } from "../ledger/journal.ts";
import {
  SIMULATED_CUSTOMER_FUNDING_BRIDGE,
  SIMULATION_FUNDING_SOURCE_ID,
  type Journal,
} from "../ledger/types.ts";
import { Money } from "../money/Money.ts";

export const AUTHORITY_TTL_MS = 15 * 60 * 1000;

export type DepositOutcome =
  | {
      readonly outcome: "POSTED";
      readonly journal: Journal;
      readonly evidenceId: string;
      readonly event: DepositPostedEvent;
      readonly replay: boolean;
    }
  | {
      readonly outcome: "REFUSED";
      readonly reason: string;
      readonly evidenceId: string;
    }
  | {
      readonly outcome: "REJECTED";
      readonly reason: string;
      readonly evidenceId: string;
    };

/**
 * Simulated customer deposit.
 *
 * Flow (no step may be skipped):
 *   intent → Compliance Kernel → Execution Authority → balanced journal
 *   → domain event → evidence sealed
 *
 * Journal (double-entry, single asset):
 *   DEBIT  SIMULATION.FUNDING_SOURCE   (named simulation source; not corporate)
 *   CREDIT customer deposit account
 *
 * Growth attribution:
 *   NOT recorded. This is a principal deposit, not interest. Principal is
 *   not economic improvement.
 */
export function executePostDeposit(input: {
  intent: PostDepositIntent;
  ledger: Ledger;
  authorityIssuer: AuthorityIssuer;
  evidence: EvidenceVault;
  events: DomainEventLog;
  growth: GrowthAttributionLedger;
  clock: Clock;
}): DepositOutcome {
  assertSimulationOnly();

  const refusal = complianceRefuse(input.intent, input.ledger);
  if (refusal) {
    const evidence = input.evidence.seal("DEPOSIT_REFUSED", {
      actionType: ActionType.POST_DEPOSIT,
      idempotencyKey: input.intent.idempotencyKey,
      customerAccountId: input.intent.payload.customerAccountId,
      amount: input.intent.payload.amount.toJSON(),
      reason: refusal,
      journalId: null,
    });
    input.events.append({
      type: "DepositRefused",
      customerAccountId: input.intent.payload.customerAccountId,
      reason: refusal,
      occurredAt: input.clock.now().toISOString(),
    });
    return { outcome: "REFUSED", reason: refusal, evidenceId: evidence.evidenceId };
  }

  const existing = input.ledger.getJournalByIdempotencyKey(
    input.intent.idempotencyKey,
  );
  if (existing) {
    const evidence = input.evidence.seal("DEPOSIT_IDEMPOTENT_REPLAY", {
      actionType: ActionType.POST_DEPOSIT,
      idempotencyKey: input.intent.idempotencyKey,
      journalId: existing.id,
    });
    return {
      outcome: "POSTED",
      journal: existing,
      evidenceId: evidence.evidenceId,
      event: {
        type: "DepositPosted",
        journalId: existing.id,
        customerAccountId: input.intent.payload.customerAccountId,
        amountMinorUnits: input.intent.payload.amount.minorUnits.toString(),
        currency: input.intent.payload.amount.currency,
        occurredAt: existing.createdAt,
      },
      replay: true,
    };
  }

  const now = input.clock.now();
  const authority = input.authorityIssuer.issue({
    authorityId: randomUUID(),
    actionType: ActionType.POST_DEPOSIT,
    accountId: input.intent.payload.customerAccountId,
    amount: input.intent.payload.amount,
    idempotencyKey: input.intent.idempotencyKey,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + AUTHORITY_TTL_MS).toISOString(),
  });

  const journal = input.ledger.postJournal({
    idempotencyKey: input.intent.idempotencyKey,
    executionAuthority: authority,
    actionType: ActionType.POST_DEPOSIT,
    classBridge: SIMULATED_CUSTOMER_FUNDING_BRIDGE,
    ...(input.intent.payload.memo !== undefined
      ? { memo: input.intent.payload.memo }
      : {}),
    postings: [
      {
        accountId: SIMULATION_FUNDING_SOURCE_ID,
        direction: "DEBIT",
        amount: input.intent.payload.amount,
      },
      {
        accountId: input.intent.payload.customerAccountId,
        direction: "CREDIT",
        amount: input.intent.payload.amount,
      },
    ],
  });

  // Principal deposit is not economic improvement. Do not write growth.
  input.growth.skipPrincipalDeposit(
    "PRINCIPAL_DEPOSIT_IS_NOT_ECONOMIC_IMPROVEMENT",
  );

  const event = input.events.append({
    type: "DepositPosted",
    journalId: journal.id,
    customerAccountId: input.intent.payload.customerAccountId,
    amountMinorUnits: input.intent.payload.amount.minorUnits.toString(),
    currency: input.intent.payload.amount.currency,
    occurredAt: journal.createdAt,
  });

  const evidence = input.evidence.seal("DEPOSIT_POSTED", {
    actionType: ActionType.POST_DEPOSIT,
    idempotencyKey: input.intent.idempotencyKey,
    journalId: journal.id,
    executionAuthorityId: authority.authorityId,
    customerAccountId: input.intent.payload.customerAccountId,
    amount: input.intent.payload.amount.toJSON(),
    debitAccountId: SIMULATION_FUNDING_SOURCE_ID,
    creditAccountId: input.intent.payload.customerAccountId,
    classBridge: SIMULATED_CUSTOMER_FUNDING_BRIDGE.name,
    growthAttributionRecorded: false,
    growthAttributionReason: "PRINCIPAL_DEPOSIT_IS_NOT_ECONOMIC_IMPROVEMENT",
  });

  return {
    outcome: "POSTED",
    journal,
    evidenceId: evidence.evidenceId,
    event,
    replay: false,
  };
}

function complianceRefuse(
  intent: PostDepositIntent,
  ledger: Ledger,
): string | null {
  if (intent.actionType !== ActionType.POST_DEPOSIT) {
    return `unsupported actionType ${intent.actionType}`;
  }
  if (
    typeof intent.idempotencyKey !== "string" ||
    intent.idempotencyKey.trim().length === 0
  ) {
    return "idempotency key is required";
  }
  if (!(intent.payload.amount instanceof Money)) {
    return "amount must be Money (bigint minor units)";
  }
  if (typeof intent.payload.amount.minorUnits !== "bigint") {
    return "amount minor units must be bigint; floating-point is forbidden";
  }
  if (!intent.payload.amount.isPositive()) {
    return "deposit amount must be a positive integer of minor units";
  }
  if (!ledger.accounts.has(intent.payload.customerAccountId)) {
    return "customer deposit account does not exist";
  }
  const account = ledger.accounts.get(intent.payload.customerAccountId);
  if (account.class !== "CUSTOMER") {
    return "POST_DEPOSIT may credit only a CUSTOMER deposit account";
  }
  if (account.asset !== intent.payload.amount.currency) {
    return "deposit currency does not match the customer account asset";
  }
  if (account.clearance === "BLOCKED") {
    return "compliance clearance is BLOCKED";
  }
  return null;
}
