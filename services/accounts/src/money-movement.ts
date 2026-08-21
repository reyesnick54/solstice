import { isErr, isOk } from '../../../packages/domain/src/result.ts';
import type { Clock } from '../../../packages/config/src/clock.ts';
import type { EvidenceVault } from '../../../packages/evidence/src/vault.ts';
import type { DomainEventLog } from '../../../packages/events/src/events.ts';
import type { ComplianceFabric } from '../../../packages/kernel/src/compliance/fabric.ts';
import type { ComplianceKernel } from '../../../packages/kernel/src/kernel.ts';
import type { KernelFacts } from '../../../packages/kernel/src/proofs.ts';
import type { GrowthAttributionLedger } from '../../../packages/ledger/src/growth.ts';
import {
  existingJournalFingerprint,
  journalFingerprint,
} from '../../../packages/ledger/src/invariants.ts';
import type { Ledger } from '../../../packages/ledger/src/journal.ts';
import {
  findClassBridge,
  LedgerInvariantError,
  SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
  SIMULATED_FUNDING_TO_SAVINGS_DEPOSIT,
  simulationFundingSourceId,
  type ClassBridge,
  type Journal,
} from '../../../packages/ledger/src/types.ts';
import { Money } from '../../../packages/money/src/money.ts';
import type {
  InternalTransferIntent,
  PostDepositIntent,
  PostWithdrawalIntent,
} from '../../../packages/permissions/src/action-types.ts';
import type { AuthorizationDecision } from '../../../packages/permissions/src/decision.ts';
import type { AuthorityIssuer } from '../../../packages/permissions/src/execution-authority.ts';
import { validateIntentStructure } from '../../../packages/permissions/src/structural.ts';
import {
  actionTypesFromCapabilities,
  type IdentityAuthorityPort,
} from '../../../packages/identity/src/index.ts';
import { assertSufficientAvailable, projectBankingPosition } from './available-funds.ts';
import { recordKernelDecisionEvent } from './event-trace.ts';
import { HoldStore } from './hold-store.ts';
import { assertMovementAllowed } from './restriction-enforcement.ts';
import type { RestrictionStore } from './restriction-store.ts';
import type { AccountStore, CustomerStore, LegalEntityStore, ProductStore } from './stores.ts';

export type MoneyMovementOutcome =
  | {
      readonly outcome: 'POSTED';
      readonly journal: Journal;
      readonly decision: AuthorizationDecision;
      readonly replay: boolean;
    }
  | {
      readonly outcome: 'KERNEL_REFUSED';
      readonly decision: AuthorizationDecision;
    }
  | {
      readonly outcome: 'REJECTED';
      readonly code: string;
      readonly message: string;
      readonly decision: AuthorizationDecision | null;
      readonly evidenceId: string;
    };

/**
 * Deposit, withdrawal, and internal transfer.
 * Each follows: intent → Kernel → Execution Authority → balanced journal
 * → domain event → evidence sealed. No step is skippable.
 */
export class MoneyMovementService {
  private readonly kernel: ComplianceKernel;
  private readonly issuer: AuthorityIssuer;
  private readonly ledger: Ledger;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly growth: GrowthAttributionLedger;
  private readonly clock: Clock;
  private readonly customers: CustomerStore;
  private readonly accounts: AccountStore;
  private readonly products: ProductStore;
  private readonly legalEntities: LegalEntityStore;
  private readonly identity: IdentityAuthorityPort;
  private readonly holds: HoldStore;
  private readonly compliance: ComplianceFabric | undefined;
  private readonly restrictions: RestrictionStore | undefined;

  constructor(
    kernel: ComplianceKernel,
    issuer: AuthorityIssuer,
    ledger: Ledger,
    evidence: EvidenceVault,
    events: DomainEventLog,
    growth: GrowthAttributionLedger,
    clock: Clock,
    customers: CustomerStore,
    accounts: AccountStore,
    products: ProductStore,
    legalEntities: LegalEntityStore,
    identity: IdentityAuthorityPort,
    holds: HoldStore = new HoldStore(),
    compliance?: ComplianceFabric,
    restrictions?: RestrictionStore,
  ) {
    this.kernel = kernel;
    this.issuer = issuer;
    this.ledger = ledger;
    this.evidence = evidence;
    this.events = events;
    this.growth = growth;
    this.clock = clock;
    this.customers = customers;
    this.accounts = accounts;
    this.products = products;
    this.legalEntities = legalEntities;
    this.identity = identity;
    this.holds = holds;
    this.compliance = compliance;
    this.restrictions = restrictions;
  }

  deposit(intent: PostDepositIntent): MoneyMovementOutcome {
    return this.move({
      intent,
      kind: 'DEPOSIT',
      amount: intent.payload.amount,
      accountId: intent.payload.accountId,
      buildPostings: (amount) => {
        const account = this.accounts.get(intent.payload.accountId);
        const bridge = fundingBridge(account?.accountClass);
        return {
          postings: [
            {
              accountId: simulationFundingSourceId(amount.currency),
              direction: 'DEBIT' as const,
              amount,
            },
            {
              accountId: intent.payload.accountId,
              direction: 'CREDIT' as const,
              amount,
            },
          ],
          classBridge: bridge,
        };
      },
      onPosted: (journal, amount, decision) => {
        // Principal deposit is not economic improvement. Do not write growth.
        this.growth.skipPrincipalMovement('PRINCIPAL_DEPOSIT_IS_NOT_ECONOMIC_IMPROVEMENT');
        this.events.append({
          eventType: 'DepositPosted',
          schemaVersion: 1,
          occurredAt: journal.createdAt as typeof intent.requestedAt,
          intentId: intent.id,
          correlationId: intent.id,
          causationId: decision.evidenceRecordId,
          evidenceId: decision.evidenceRecordId,
          aggregateType: 'account',
          aggregateId: intent.payload.accountId,
          payload: {
            journalId: journal.id,
            accountId: intent.payload.accountId,
            amountMinorUnits: amount.minorUnits.toString(),
            currency: amount.currency,
          },
        });
      },
    });
  }

  withdraw(intent: PostWithdrawalIntent): MoneyMovementOutcome {
    return this.move({
      intent,
      kind: 'WITHDRAWAL',
      amount: intent.payload.amount,
      accountId: intent.payload.accountId,
      precheck: () => {
        const account = this.accounts.get(intent.payload.accountId);
        if (!account) {
          return { code: 'ACCOUNT_NOT_FOUND', message: 'account does not exist' };
        }
        const position = projectBankingPosition(
          this.ledger,
          account,
          this.holds,
          this.clock.now(),
        );
        if (isErr(position)) {
          return { code: position.error.code, message: 'cannot read available funds' };
        }
        const enough = assertSufficientAvailable(position.value, intent.payload.amount);
        if (isErr(enough)) {
          return {
            code: enough.error.code,
            message: 'withdrawal exceeds available balance; nothing posted',
          };
        }
        return null;
      },
      buildPostings: (amount) => {
        const account = this.accounts.get(intent.payload.accountId);
        const bridge = fundingBridge(account?.accountClass);
        return {
          postings: [
            {
              accountId: intent.payload.accountId,
              direction: 'DEBIT' as const,
              amount,
            },
            {
              accountId: simulationFundingSourceId(amount.currency),
              direction: 'CREDIT' as const,
              amount,
            },
          ],
          classBridge: bridge,
        };
      },
      onPosted: (journal, amount, decision) => {
        this.growth.skipPrincipalMovement('PRINCIPAL_WITHDRAWAL_IS_NOT_ECONOMIC_IMPROVEMENT');
        this.events.append({
          eventType: 'WithdrawalPosted',
          schemaVersion: 1,
          occurredAt: journal.createdAt as typeof intent.requestedAt,
          intentId: intent.id,
          correlationId: intent.id,
          causationId: decision.evidenceRecordId,
          evidenceId: decision.evidenceRecordId,
          aggregateType: 'account',
          aggregateId: intent.payload.accountId,
          payload: {
            journalId: journal.id,
            accountId: intent.payload.accountId,
            amountMinorUnits: amount.minorUnits.toString(),
            currency: amount.currency,
          },
        });
      },
    });
  }

  transfer(intent: InternalTransferIntent): MoneyMovementOutcome {
    return this.move({
      intent,
      kind: 'INTERNAL_TRANSFER',
      amount: intent.payload.amount,
      accountId: intent.payload.sourceAccountId,
      precheck: () => {
        const source = this.accounts.get(intent.payload.sourceAccountId);
        const dest = this.accounts.get(intent.payload.destinationAccountId);
        if (!source || !dest) {
          return { code: 'ACCOUNT_NOT_FOUND', message: 'account does not exist' };
        }
        if (source.ownerId !== dest.ownerId) {
          return { code: 'OWNER_MISMATCH', message: 'internal transfer requires the same owner' };
        }
        if (source.accountClass !== dest.accountClass) {
          const bridge = findClassBridge(source.accountClass, dest.accountClass);
          if (!bridge) {
            return {
              code: 'CLASS_BRIDGE_UNDEFINED',
              message: `no disclosed class bridge is defined for ${source.accountClass} ↔ ${dest.accountClass}; transfer refused`,
            };
          }
        }
        const position = projectBankingPosition(
          this.ledger,
          source,
          this.holds,
          this.clock.now(),
        );
        if (isErr(position)) {
          return { code: position.error.code, message: 'cannot read source available funds' };
        }
        const enough = assertSufficientAvailable(position.value, intent.payload.amount);
        if (isErr(enough)) {
          return {
            code: enough.error.code,
            message: 'transfer exceeds available source balance; nothing posted',
          };
        }
        return null;
      },
      buildPostings: (amount) => {
        const source = this.accounts.get(intent.payload.sourceAccountId)!;
        const dest = this.accounts.get(intent.payload.destinationAccountId)!;
        const bridge =
          source.accountClass === dest.accountClass
            ? undefined
            : findClassBridge(source.accountClass, dest.accountClass);
        return {
          postings: [
            {
              accountId: intent.payload.sourceAccountId,
              direction: 'DEBIT' as const,
              amount,
            },
            {
              accountId: intent.payload.destinationAccountId,
              direction: 'CREDIT' as const,
              amount,
            },
          ],
          classBridge: bridge,
        };
      },
      onPosted: (journal, amount, decision) => {
        this.growth.skipPrincipalMovement('PRINCIPAL_TRANSFER_IS_NOT_ECONOMIC_IMPROVEMENT');
        const source = this.accounts.get(intent.payload.sourceAccountId)!;
        const dest = this.accounts.get(intent.payload.destinationAccountId)!;
        const bridge =
          source.accountClass === dest.accountClass
            ? null
            : (findClassBridge(source.accountClass, dest.accountClass)?.name ?? null);
        this.events.append({
          eventType: 'InternalTransferPosted',
          schemaVersion: 1,
          occurredAt: journal.createdAt as typeof intent.requestedAt,
          intentId: intent.id,
          correlationId: intent.id,
          causationId: decision.evidenceRecordId,
          evidenceId: decision.evidenceRecordId,
          aggregateType: 'account',
          aggregateId: intent.payload.sourceAccountId,
          payload: {
            journalId: journal.id,
            sourceAccountId: intent.payload.sourceAccountId,
            destinationAccountId: intent.payload.destinationAccountId,
            amountMinorUnits: amount.minorUnits.toString(),
            currency: amount.currency,
            classBridgeName: bridge,
          },
        });
      },
    });
  }

  private move(input: {
    intent: PostDepositIntent | PostWithdrawalIntent | InternalTransferIntent;
    kind: 'DEPOSIT' | 'WITHDRAWAL' | 'INTERNAL_TRANSFER';
    amount: Money;
    accountId: string;
    precheck?: () => { code: string; message: string } | null;
    buildPostings: (amount: Money) => {
      postings: readonly {
        accountId: string;
        direction: 'DEBIT' | 'CREDIT';
        amount: Money;
      }[];
      classBridge: ClassBridge | undefined;
    };
    onPosted: (journal: Journal, amount: Money, decision: AuthorizationDecision) => void;
  }): MoneyMovementOutcome {
    const existing = this.ledger.getJournalByIdempotencyKey(input.intent.idempotencyKey);
    if (existing) {
      const replayPostings = input.buildPostings(input.amount).postings;
      const next = journalFingerprint({
        actionType: input.intent.actionType,
        postings: replayPostings,
      });
      if (next !== existingJournalFingerprint(existing)) {
        throw new LedgerInvariantError(
          'IDEMPOTENCY',
          'idempotency key already bound to a different journal',
        );
      }
      this.evidence.seal(`${input.kind}_IDEMPOTENT_REPLAY`, {
        intentId: input.intent.id,
        journalId: existing.id,
      });
      return {
        outcome: 'POSTED',
        journal: existing,
        decision: {
          status: 'ALLOW',
          intentId: input.intent.id,
          actionType: input.intent.actionType,
          proofs: [],
          executionAuthority: null,
          evidenceRecordId: '',
          decidedAt: this.clock.now(),
        },
        replay: true,
      };
    }

    const customerAccount =
      this.accounts.get(input.accountId as never) ??
      this.accounts.list().find((a) => a.id === input.accountId);
    const customer = customerAccount
      ? this.customers.get(customerAccount.ownerId)
      : undefined;
    const legalEntity = customerAccount
      ? this.legalEntities.get(customerAccount.legalEntityId)
      : undefined;
    const product = customerAccount ? this.products.get(customerAccount.productId) : undefined;

    const resolved = this.identity.resolveActorContext(input.intent.actorId);
    const identityFacts = this.identity.identityFactsFor(input.intent.actorId);
    const jurisdiction = customerAccount?.jurisdiction ?? customer?.jurisdiction;
    const compliance = jurisdiction
      ? this.compliance?.collectFacts({
          subjectRef: customer?.id ?? input.intent.actorId,
          jurisdiction,
          actorId: input.intent.actorId,
          sessionAssurance: identityFacts.authenticationAssurance,
          identityUsable: identityFacts.identityExists && identityFacts.sessionValid,
          amountMinor: input.amount.minorUnits,
          ...(customer ? { kycState: customer.verification.kycState } : {}),
        })
      : undefined;
    const facts: KernelFacts = {
      actor: {
        id: input.intent.actorId,
        capabilities: resolved.ok
          ? actionTypesFromCapabilities(resolved.value.authorizedCapabilities)
          : [],
      },
      identity: identityFacts,
      ...(customer ? { customer } : {}),
      ...(legalEntity ? { legalEntity } : {}),
      ...(product ? { product } : {}),
      ...(customerAccount
        ? { jurisdiction: customerAccount.jurisdiction }
        : customer
          ? { jurisdiction: customer.jurisdiction }
          : {}),
      amount: input.amount,
      ...(customerAccount ? { sourceAccount: customerAccount } : {}),
      ...(compliance ? { compliance } : {}),
    };

    const decision = this.kernel.submit(input.intent, facts);
    recordKernelDecisionEvent(
      this.events,
      input.intent,
      decision,
      customerAccount?.jurisdiction ?? customer?.jurisdiction,
    );
    if (decision.status !== 'ALLOW') {
      this.evidence.seal(`${input.kind}_KERNEL_REFUSED`, {
        intentId: input.intent.id,
        status: decision.status,
        kernelEvidenceId: decision.evidenceRecordId,
        posted: false,
      });
      return { outcome: 'KERNEL_REFUSED', decision };
    }

    const structural = validateIntentStructure(input.intent, {
      products: this.products.asCatalog(),
      legalEntities: this.legalEntities,
      accounts: this.accounts,
    });
    if (isErr(structural)) {
      const evidence = this.evidence.seal(`${input.kind}_STRUCTURAL_REJECTION`, {
        intentId: input.intent.id,
        message: structural.error.message,
        posted: false,
      });
      return {
        outcome: 'REJECTED',
        code: structural.error.code,
        message: structural.error.message,
        decision,
        evidenceId: evidence.evidenceId,
      };
    }

    if (this.restrictions) {
      const destination =
        input.kind === 'INTERNAL_TRANSFER' && 'destinationAccountId' in input.intent.payload
          ? this.accounts.get(input.intent.payload.destinationAccountId)
          : undefined;
      const blocked = assertMovementAllowed(
        this.restrictions,
        customerAccount,
        input.kind,
        destination,
      );
      if (isErr(blocked)) {
        const evidence = this.evidence.seal(`${input.kind}_RESTRICTED`, {
          intentId: input.intent.id,
          restriction: blocked.error.restriction,
          message: blocked.error.message,
          posted: false,
        });
        return {
          outcome: 'REJECTED',
          code: blocked.error.code,
          message: blocked.error.message,
          decision,
          evidenceId: evidence.evidenceId,
        };
      }
    }

    const pre = input.precheck?.() ?? null;
    if (pre) {
      const evidence = this.evidence.seal(`${input.kind}_REJECTED`, {
        intentId: input.intent.id,
        code: pre.code,
        message: pre.message,
        posted: false,
      });
      return {
        outcome: 'REJECTED',
        code: pre.code,
        message: pre.message,
        decision,
        evidenceId: evidence.evidenceId,
      };
    }

    if (!decision.executionAuthority) {
      const evidence = this.evidence.seal(`${input.kind}_MISSING_AUTHORITY`, {
        intentId: input.intent.id,
        posted: false,
      });
      return {
        outcome: 'REJECTED',
        code: 'MISSING_EXECUTION_AUTHORITY',
        message: 'ALLOW without an Execution Authority is refused',
        decision,
        evidenceId: evidence.evidenceId,
      };
    }

    const verified = this.issuer.verify(
      decision.executionAuthority,
      {
        actionType: input.intent.actionType,
        accountId: input.accountId,
        intentId: input.intent.id,
      },
      this.clock,
    );
    if (!isOk(verified)) {
      const evidence = this.evidence.seal(`${input.kind}_AUTHORITY_REJECTED`, {
        intentId: input.intent.id,
        code: verified.error.code,
        message: verified.error.message,
        posted: false,
      });
      return {
        outcome: 'REJECTED',
        code: verified.error.code,
        message: verified.error.message,
        decision,
        evidenceId: evidence.evidenceId,
      };
    }

    const built = input.buildPostings(input.amount);
    const journal = this.ledger.postJournal({
      idempotencyKey: input.intent.idempotencyKey,
      executionAuthority: verified.value,
      actionType: input.intent.actionType,
      postings: built.postings,
      ...(built.classBridge ? { classBridge: built.classBridge } : {}),
    });

    input.onPosted(journal, input.amount, decision);

    this.evidence.seal(`${input.kind}_POSTED`, {
      intentId: input.intent.id,
      journalId: journal.id,
      executionAuthorityId: verified.value.authorityId,
      posted: true,
      growthAttributionRecorded: false,
    });

    return {
      outcome: 'POSTED',
      journal,
      decision,
      replay: false,
    };
  }
}

function fundingBridge(accountClass: string | undefined): ClassBridge | undefined {
  if (accountClass === 'DEMAND_DEPOSIT') {
    return SIMULATED_FUNDING_TO_DEMAND_DEPOSIT;
  }
  if (accountClass === 'SAVINGS_DEPOSIT') {
    return SIMULATED_FUNDING_TO_SAVINGS_DEPOSIT;
  }
  return undefined;
}
