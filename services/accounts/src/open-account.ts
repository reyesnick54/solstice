import { openAccount, type Account } from '../../../packages/domain/src/account.ts';
import { isErr, isOk } from '../../../packages/domain/src/result.ts';
import type { EvidenceVault } from '../../../packages/evidence/src/vault.ts';
import type { DomainEventLog } from '../../../packages/events/src/events.ts';
import type { ComplianceFabric } from '../../../packages/kernel/src/compliance/fabric.ts';
import type { ComplianceKernel } from '../../../packages/kernel/src/kernel.ts';
import type { KernelFacts } from '../../../packages/kernel/src/proofs.ts';
import type { Ledger } from '../../../packages/ledger/src/journal.ts';
import type { AuthorizationDecision } from '../../../packages/permissions/src/decision.ts';
import type { OpenAccountIntent } from '../../../packages/permissions/src/action-types.ts';
import type { AuthorityIssuer } from '../../../packages/permissions/src/execution-authority.ts';
import { validateIntentStructure } from '../../../packages/permissions/src/structural.ts';
import type { Clock } from '../../../packages/config/src/clock.ts';
import {
  actionTypesFromCapabilities,
  type IdentityAuthorityPort,
} from '../../../packages/identity/src/index.ts';
import { recordKernelDecisionEvent } from './event-trace.ts';
import type { AccountStore, CustomerStore, LegalEntityStore, ProductStore } from './stores.ts';

export type OpenAccountOutcome =
  | {
      readonly outcome: 'OPENED';
      readonly account: Account;
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
 * Accounts service — Kernel-gated opening.
 *
 * Single entry point: open(intent). This service evaluates NO proof.
 * It submits the intent to the Compliance Kernel. On ALLOW it verifies
 * the Execution Authority (valid, unexpired, scoped to this action and
 * account) then calls openAccount(verifiedAuthority, fields). On any
 * other Kernel status it creates nothing and returns the Kernel decision
 * unchanged.
 *
 * Idempotent by intent id.
 */
export class AccountsService {
  private readonly byIntentId = new Map<string, OpenAccountOutcome>();
  private readonly kernel: ComplianceKernel;
  private readonly issuer: AuthorityIssuer;
  private readonly ledger: Ledger;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly clock: Clock;
  private readonly customers: CustomerStore;
  private readonly accounts: AccountStore;
  private readonly products: ProductStore;
  private readonly legalEntities: LegalEntityStore;
  private readonly identity: IdentityAuthorityPort;
  private readonly compliance: ComplianceFabric | undefined;

  constructor(
    kernel: ComplianceKernel,
    issuer: AuthorityIssuer,
    ledger: Ledger,
    evidence: EvidenceVault,
    events: DomainEventLog,
    clock: Clock,
    customers: CustomerStore,
    accounts: AccountStore,
    products: ProductStore,
    legalEntities: LegalEntityStore,
    identity: IdentityAuthorityPort,
    compliance?: ComplianceFabric,
  ) {
    this.kernel = kernel;
    this.issuer = issuer;
    this.ledger = ledger;
    this.evidence = evidence;
    this.events = events;
    this.clock = clock;
    this.customers = customers;
    this.accounts = accounts;
    this.products = products;
    this.legalEntities = legalEntities;
    this.identity = identity;
    this.compliance = compliance;
  }

  /**
   * Reconstruct account-opening idempotency after process restart.
   * Outcomes are durable facts; this does not open an account.
   */
  hydrateOpenOutcomes(entries: Iterable<readonly [string, OpenAccountOutcome]>): void {
    for (const [intentId, outcome] of entries) {
      this.byIntentId.set(intentId, outcome);
    }
  }

  open(intent: OpenAccountIntent): OpenAccountOutcome {
    const replay = this.byIntentId.get(intent.id);
    if (replay) {
      this.evidence.seal('ACCOUNT_OPEN_IDEMPOTENT_REPLAY', {
        intentId: intent.id,
        outcome: replay.outcome,
      });
      if (replay.outcome === 'OPENED') {
        return Object.freeze({ ...replay, replay: true });
      }
      return replay;
    }

    const customer = this.customers.get(intent.payload.ownerId);
    const product = this.products.get(intent.payload.productId);
    const legalEntity = this.legalEntities.get(intent.payload.legalEntityId);

    const resolved = this.identity.resolveActorContext(intent.actorId);
    const identityFacts = this.identity.identityFactsFor(intent.actorId);
    const compliance = this.compliance?.collectFacts({
      subjectRef: customer?.id ?? intent.actorId,
      jurisdiction: intent.payload.jurisdiction,
      actorId: intent.actorId,
      sessionAssurance: identityFacts.authenticationAssurance,
      identityUsable: identityFacts.identityExists && identityFacts.sessionValid,
      ...(customer ? { kycState: customer.verification.kycState } : {}),
    });
    const facts: KernelFacts = {
      actor: {
        id: intent.actorId,
        capabilities: resolved.ok
          ? actionTypesFromCapabilities(resolved.value.authorizedCapabilities)
          : [],
      },
      identity: identityFacts,
      ...(customer ? { customer } : {}),
      ...(product ? { product } : {}),
      ...(legalEntity ? { legalEntity } : {}),
      jurisdiction: intent.payload.jurisdiction,
      ...(compliance ? { compliance } : {}),
    };

    const decision = this.kernel.submit(intent, facts);
    recordKernelDecisionEvent(this.events, intent, decision, intent.payload.jurisdiction);

    if (decision.status !== 'ALLOW') {
      const refused: OpenAccountOutcome = Object.freeze({
        outcome: 'KERNEL_REFUSED',
        decision,
      });
      this.byIntentId.set(intent.id, refused);
      this.evidence.seal('ACCOUNT_OPENING_REFUSED', {
        intentId: intent.id,
        status: decision.status,
        kernelEvidenceId: decision.evidenceRecordId,
        accountCreated: false,
      });
      return refused;
    }

    if (this.accounts.has(intent.payload.accountId)) {
      const existing = this.accounts.get(intent.payload.accountId)!;
      const evidence = this.evidence.seal('ACCOUNT_OPENING_ALREADY_EXISTS', {
        intentId: intent.id,
        accountId: existing.id,
        accountCreated: false,
      });
      const rejected: OpenAccountOutcome = Object.freeze({
        outcome: 'REJECTED',
        code: 'ACCOUNT_ALREADY_EXISTS',
        message: 'account id already exists',
        decision,
        evidenceId: evidence.evidenceId,
      });
      this.byIntentId.set(intent.id, rejected);
      return rejected;
    }

    const structural = validateIntentStructure(intent, {
      products: this.products.asCatalog(),
      legalEntities: this.legalEntities,
      accounts: this.accounts,
    });
    if (isErr(structural)) {
      const evidence = this.evidence.seal('ACCOUNT_OPENING_STRUCTURAL_REJECTION', {
        intentId: intent.id,
        field: structural.error.field,
        message: structural.error.message,
        accountCreated: false,
      });
      const rejected: OpenAccountOutcome = Object.freeze({
        outcome: 'REJECTED',
        code: structural.error.code,
        message: structural.error.message,
        decision,
        evidenceId: evidence.evidenceId,
      });
      this.byIntentId.set(intent.id, rejected);
      return rejected;
    }

    if (!decision.executionAuthority) {
      const evidence = this.evidence.seal('ACCOUNT_OPENING_MISSING_AUTHORITY', {
        intentId: intent.id,
        accountCreated: false,
      });
      const rejected: OpenAccountOutcome = Object.freeze({
        outcome: 'REJECTED',
        code: 'MISSING_EXECUTION_AUTHORITY',
        message: 'ALLOW without an Execution Authority is refused',
        decision,
        evidenceId: evidence.evidenceId,
      });
      this.byIntentId.set(intent.id, rejected);
      return rejected;
    }

    const verified = this.issuer.verify(
      decision.executionAuthority,
      {
        actionType: intent.actionType,
        accountId: intent.payload.accountId,
        intentId: intent.id,
      },
      this.clock,
    );
    if (!isOk(verified)) {
      const evidence = this.evidence.seal('ACCOUNT_OPENING_AUTHORITY_REJECTED', {
        intentId: intent.id,
        code: verified.error.code,
        message: verified.error.message,
        accountCreated: false,
      });
      const rejected: OpenAccountOutcome = Object.freeze({
        outcome: 'REJECTED',
        code: verified.error.code,
        message: verified.error.message,
        decision,
        evidenceId: evidence.evidenceId,
      });
      this.byIntentId.set(intent.id, rejected);
      return rejected;
    }

    const verifiedExecutionAuthority = verified.value;
    const constructed = openAccount(verifiedExecutionAuthority, {
      id: intent.payload.accountId,
      ownerId: intent.payload.ownerId,
      accountClass: intent.payload.accountClass,
      productId: intent.payload.productId,
      legalEntityId: intent.payload.legalEntityId,
      jurisdiction: intent.payload.jurisdiction,
      currency: intent.payload.currency,
      openedAt: this.clock.now(),
    });
    if (isErr(constructed)) {
      const evidence = this.evidence.seal('ACCOUNT_OPENING_CONSTRUCTION_REJECTED', {
        intentId: intent.id,
        code: constructed.error.code,
        message: constructed.error.message,
        accountCreated: false,
      });
      const rejected: OpenAccountOutcome = Object.freeze({
        outcome: 'REJECTED',
        code: constructed.error.code,
        message: constructed.error.message,
        decision,
        evidenceId: evidence.evidenceId,
      });
      this.byIntentId.set(intent.id, rejected);
      return rejected;
    }

    this.accounts.put(constructed.value.id, constructed.value);
    this.ledger.accounts.registerOpenedAccount(constructed.value);

    this.events.append({
      eventType: 'AccountOpened',
      schemaVersion: 1,
      occurredAt: constructed.value.openedAt,
      intentId: intent.id,
      correlationId: intent.id,
      causationId: decision.evidenceRecordId,
      evidenceId: decision.evidenceRecordId,
      jurisdiction: constructed.value.jurisdiction,
      aggregateType: 'account',
      aggregateId: constructed.value.id,
      payload: {
        accountId: constructed.value.id,
        ownerId: constructed.value.ownerId,
        accountClass: constructed.value.accountClass,
        executionAuthorityId: verified.value.authorityId,
        intentId: intent.id,
      },
    });

    this.evidence.seal('ACCOUNT_OPENED', {
      intentId: intent.id,
      accountId: constructed.value.id,
      executionAuthorityId: verified.value.authorityId,
      kernelEvidenceId: decision.evidenceRecordId,
    });

    const opened: OpenAccountOutcome = Object.freeze({
      outcome: 'OPENED',
      account: constructed.value,
      decision,
      replay: false,
    });
    this.byIntentId.set(intent.id, opened);
    return opened;
  }

  getAccount(id: Account['id']): Account | undefined {
    return this.accounts.get(id);
  }

  listAccounts(): readonly Account[] {
    return this.accounts.list();
  }
}
