import { isErr, isOk } from '../../domain/src/result.ts';
import type { Clock } from '../../config/src/clock.ts';
import { type Customer } from '../../domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../domain/src/jurisdiction.ts';
import { createProductCatalog } from '../../domain/src/product.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import {
  actionTypesFromCapabilities,
  type IdentityAuthorityPort,
} from '../../identity/src/index.ts';
import type { ComplianceKernel } from '../../kernel/src/kernel.ts';
import type { KernelFacts } from '../../kernel/src/proofs.ts';
import type { ActionIntent } from '../../permissions/src/action-intent.ts';
import type { AuthorizationDecision } from '../../permissions/src/decision.ts';
import { AuthorityIssuer, type VerifiedExecutionAuthority } from '../../permissions/src/execution-authority.ts';
import { validateIntentStructure, type StructuralCatalog } from '../../permissions/src/structural.ts';
import {
  SIMULATION_DIGITAL_CUSTODY_GB,
  SIMULATION_SOLSTICE_UK,
} from '../../sunrey-coin/src/simulation-catalog.ts';

const EMPTY_CATALOG: StructuralCatalog = {
  products: createProductCatalog([]),
  legalEntities: { get: () => undefined },
  accounts: { get: () => undefined },
};

export type CapacityAuthorizeRefusal =
  | { readonly outcome: 'KERNEL_REFUSED'; readonly decision: AuthorizationDecision }
  | {
      readonly outcome: 'REJECTED';
      readonly code: string;
      readonly message: string;
      readonly decision: AuthorizationDecision | null;
      readonly evidenceId: string;
    };

export type CapacityAuthorizeAllow = {
  readonly outcome: 'ALLOWED';
  readonly decision: AuthorizationDecision;
  readonly verified: VerifiedExecutionAuthority;
};

export type CapacityAuthorizePorts = {
  readonly kernel: ComplianceKernel;
  readonly issuer: AuthorityIssuer;
  readonly evidence: EvidenceVault;
  readonly events: DomainEventLog;
  readonly clock: Clock;
  readonly identity: IdentityAuthorityPort;
};

export function authorizeCapacityIntent(
  ports: CapacityAuthorizePorts,
  intent: ActionIntent,
  factsExtra: Partial<KernelFacts> = {},
): CapacityAuthorizeAllow | CapacityAuthorizeRefusal {
  const payload = intent.payload as { accountId?: string };
  const resolved = ports.identity.resolveActorContext(intent.actorId);
  const identityFacts = ports.identity.identityFactsFor(intent.actorId);
  const jurisdiction = factsExtra.jurisdiction;
  const customer =
    factsExtra.customer ??
    (identityFacts.customerId && jurisdiction
      ? simulationCustomer(identityFacts.customerId, jurisdiction, ports.clock.now())
      : undefined);
  const facts: KernelFacts = {
    actor: {
      id: intent.actorId,
      capabilities: resolved.ok
        ? actionTypesFromCapabilities(resolved.value.authorizedCapabilities)
        : [],
    },
    identity: identityFacts,
    ...(customer ? { customer } : {}),
    ...(jurisdiction ? { jurisdiction } : {}),
    ...(jurisdiction === 'GB'
      ? { legalEntity: SIMULATION_SOLSTICE_UK, product: SIMULATION_DIGITAL_CUSTODY_GB }
      : {}),
    ...factsExtra,
  };
  const decision = ports.kernel.submit(intent, facts);
  if (decision.status !== 'ALLOW') {
    ports.evidence.seal(`${intent.actionType}_KERNEL_REFUSED`, {
      intentId: intent.id,
      status: decision.status,
      kernelEvidenceId: decision.evidenceRecordId,
      posted: false,
    });
    return { outcome: 'KERNEL_REFUSED', decision };
  }
  const structural = validateIntentStructure(intent, EMPTY_CATALOG);
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
      accountId: payload.accountId ?? (intent.id as string),
      intentId: intent.id as string,
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

function simulationCustomer(
  customerId: Customer['id'],
  jurisdiction: KernelFacts['jurisdiction'] & string,
  now: UtcInstant,
): Customer {
  return Object.freeze({
    id: customerId,
    legalEntityId: 'le_solstice_uk_ltd' as never,
    jurisdiction: asJurisdiction(jurisdiction),
    residency: asResidency(jurisdiction),
    status: 'ACTIVE',
    verification: {
      kycState: 'VERIFIED' as const,
      kycRecordVersion: 1,
      refreshBy: now,
    },
    createdAt: now,
    version: 1,
  });
}
