import { isErr, isOk } from '../../../packages/domain/src/result.ts';
import type { Clock } from '../../../packages/config/src/clock.ts';
import type { EvidenceVault } from '../../../packages/evidence/src/vault.ts';
import type { DomainEventLog } from '../../../packages/events/src/events.ts';
import type { ComplianceKernel } from '../../../packages/kernel/src/kernel.ts';
import type { KernelFacts } from '../../../packages/kernel/src/proofs.ts';
import type { ActionIntent } from '../../../packages/permissions/src/action-intent.ts';
import type { AuthorizationDecision } from '../../../packages/permissions/src/decision.ts';
import type { AuthorityIssuer, VerifiedExecutionAuthority } from '../../../packages/permissions/src/execution-authority.ts';
import { validateIntentStructure } from '../../../packages/permissions/src/structural.ts';
import {
  actionTypesFromCapabilities,
  type IdentityAuthorityPort,
} from '../../../packages/identity/src/index.ts';
import { recordKernelDecisionEvent } from './event-trace.ts';
import type { AccountStore, CustomerStore, LegalEntityStore, ProductStore } from './stores.ts';

export type AuthorizedRefusal =
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

export type AuthorizedAllow = {
  readonly outcome: 'ALLOWED';
  readonly decision: AuthorizationDecision;
  readonly verified: VerifiedExecutionAuthority;
};

export type AuthorizePorts = {
  readonly kernel: ComplianceKernel;
  readonly issuer: AuthorityIssuer;
  readonly evidence: EvidenceVault;
  readonly events: DomainEventLog;
  readonly clock: Clock;
  readonly customers: CustomerStore;
  readonly accounts: AccountStore;
  readonly products: ProductStore;
  readonly legalEntities: LegalEntityStore;
  readonly identity: IdentityAuthorityPort;
};

export function authorizeIntent(
  ports: AuthorizePorts,
  intent: ActionIntent,
  factsExtra: Partial<KernelFacts> = {},
): AuthorizedAllow | AuthorizedRefusal {
  const payload = intent.payload as {
    accountId?: string;
    pendingAccountId?: string;
    sourceAccountId?: string;
  };
  const accountId =
    typeof payload.accountId === 'string'
      ? payload.accountId
      : typeof payload.pendingAccountId === 'string'
        ? payload.pendingAccountId
        : typeof payload.sourceAccountId === 'string'
          ? payload.sourceAccountId
          : undefined;
  const customerAccount = accountId
    ? (ports.accounts.get(accountId as never) ??
      ports.accounts.list().find((account) => account.id === accountId))
    : undefined;
  const customer = customerAccount ? ports.customers.get(customerAccount.ownerId) : undefined;
  const legalEntity = customerAccount
    ? ports.legalEntities.get(customerAccount.legalEntityId)
    : undefined;
  const product = customerAccount ? ports.products.get(customerAccount.productId) : undefined;
  const resolved = ports.identity.resolveActorContext(intent.actorId);
  const facts: KernelFacts = {
    actor: {
      id: intent.actorId,
      capabilities: resolved.ok
        ? actionTypesFromCapabilities(resolved.value.authorizedCapabilities)
        : [],
    },
    identity: ports.identity.identityFactsFor(intent.actorId),
    ...(customer ? { customer } : {}),
    ...(legalEntity ? { legalEntity } : {}),
    ...(product ? { product } : {}),
    ...(customerAccount
      ? { jurisdiction: customerAccount.jurisdiction }
      : customer
        ? { jurisdiction: customer.jurisdiction }
        : {}),
    ...(customerAccount ? { sourceAccount: customerAccount } : {}),
    ...factsExtra,
  };
  const decision = ports.kernel.submit(intent, facts);
  recordKernelDecisionEvent(
    ports.events,
    intent,
    decision,
    customerAccount?.jurisdiction ?? customer?.jurisdiction,
  );
  if (decision.status !== 'ALLOW') {
    ports.evidence.seal(`${intent.actionType}_KERNEL_REFUSED`, {
      intentId: intent.id,
      status: decision.status,
      kernelEvidenceId: decision.evidenceRecordId,
      posted: false,
    });
    return { outcome: 'KERNEL_REFUSED', decision };
  }
  const structural = validateIntentStructure(intent, {
    products: ports.products.asCatalog(),
    legalEntities: ports.legalEntities,
    accounts: ports.accounts,
  });
  if (isErr(structural)) {
    const evidence = ports.evidence.seal(`${intent.actionType}_STRUCTURAL_REJECTION`, {
      intentId: intent.id,
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
  if (!decision.executionAuthority) {
    const evidence = ports.evidence.seal(`${intent.actionType}_MISSING_AUTHORITY`, {
      intentId: intent.id,
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
  const verified = ports.issuer.verify(
    decision.executionAuthority,
    {
      actionType: intent.actionType,
      accountId: accountId ?? intent.id,
      intentId: intent.id,
    },
    ports.clock,
  );
  if (!isOk(verified)) {
    const evidence = ports.evidence.seal(`${intent.actionType}_AUTHORITY_REJECTED`, {
      intentId: intent.id,
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
  return { outcome: 'ALLOWED', decision, verified: verified.value };
}
