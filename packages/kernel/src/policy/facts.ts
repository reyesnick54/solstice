import type { Account } from '../../../domain/src/account.ts';
import type { Customer } from '../../../domain/src/customer.ts';
import type { Jurisdiction, Residency } from '../../../domain/src/jurisdiction.ts';
import type { LegalEntity } from '../../../domain/src/legal-entity.ts';
import type { Product } from '../../../domain/src/product.ts';
import type { Money } from '../../../money/src/money.ts';
import type { ActionIntent } from '../../../permissions/src/action-intent.ts';
import { ENVIRONMENT } from '../../../config/src/flags.ts';
import type { IdentityFacts } from '../../../identity/src/facts.ts';
import type { ComplianceFacts } from '../compliance/facts.ts';
import type { KernelActor, KernelFacts } from '../proofs.ts';

function isIdentityFacts(value: KernelFacts['identity']): value is IdentityFacts {
  return value !== undefined && 'identityExists' in value;
}
import { hashCanonical } from './hash.ts';
import type { FactMap } from './predicates.ts';
import type { CapabilityEnvironment, PolicyPackId } from './types.ts';

/**
 * Typed policy facts. Identity fields are hashes/status codes, not raw PII.
 * Citizenship is optional and is never inferred.
 */
export type PolicyIdentityFacts = {
  readonly kycState?: string;
  readonly kycRecordVersion?: number;
  readonly citizenship?: Jurisdiction;
  readonly residency?: Residency;
};

export type PolicyFactInput = {
  readonly actor: KernelActor;
  readonly actionType: string;
  readonly customer?: Customer;
  readonly legalEntity?: LegalEntity;
  readonly product?: Product;
  readonly jurisdiction?: Jurisdiction;
  readonly amount?: Money;
  readonly sourceAccount?: Account;
  readonly destinationAccount?: Account;
  readonly identity?: PolicyIdentityFacts;
  readonly serviceLocation?: Jurisdiction;
  readonly transactionOrigin?: Jurisdiction;
  readonly transactionDestination?: Jurisdiction;
  readonly policyPin?: {
    readonly packId: PolicyPackId;
    readonly versionId: string;
  };
  readonly capabilityEnabled?: boolean;
  readonly capabilityEnvironment?: CapabilityEnvironment;
  readonly offeringMode?: string;
  readonly compliance?: ComplianceFacts;
};

/**
 * Product and legal-entity identifiers may arrive as Kernel fact objects
 * or only as IDs on the source/destination account. Structural gates use
 * these resolved refs so an event-driven follow-on intent is not deferred
 * solely because the caller omitted the catalog objects.
 */
export type OfferingRefs = {
  readonly productId?: string;
  readonly legalEntityId?: string;
  readonly accountClass?: string;
  readonly productJurisdiction?: string;
  readonly currency?: string;
};

export function resolveOfferingRefs(input: PolicyFactInput): OfferingRefs {
  const account = input.sourceAccount ?? input.destinationAccount;
  const productId = input.product?.id ?? account?.productId;
  const legalEntityId = input.legalEntity?.id ?? account?.legalEntityId;
  const accountClass = input.product?.accountClass ?? account?.accountClass;
  const productJurisdiction = input.product?.jurisdiction ?? account?.jurisdiction;
  const currency = input.product?.currency ?? account?.currency;
  return {
    ...(productId ? { productId } : {}),
    ...(legalEntityId ? { legalEntityId } : {}),
    ...(accountClass ? { accountClass } : {}),
    ...(productJurisdiction ? { productJurisdiction } : {}),
    ...(currency ? { currency } : {}),
  };
}

export function policyFactsFromKernel(
  intent: ActionIntent,
  facts: KernelFacts,
): PolicyFactInput {
  const kycState =
    facts.identity?.kycState ??
    facts.policyIdentity?.kycState ??
    facts.customer?.verification.kycState;
  const kycRecordVersion =
    facts.identity?.kycVersion ??
    facts.policyIdentity?.kycRecordVersion ??
    facts.customer?.verification.kycRecordVersion;
  const residency = facts.policyIdentity?.residency ?? facts.customer?.residency;
  const identity: PolicyIdentityFacts = {
    ...(kycState !== undefined ? { kycState } : {}),
    ...(kycRecordVersion !== undefined ? { kycRecordVersion } : {}),
    ...(residency !== undefined ? { residency } : {}),
    ...(facts.policyIdentity?.citizenship !== undefined
      ? { citizenship: facts.policyIdentity.citizenship }
      : {}),
  const identityFacts = isIdentityFacts(facts.identity) ? facts.identity : undefined;
  const policyIdentity = !identityFacts && facts.identity ? (facts.identity as PolicyIdentityFacts) : undefined;
  const kycState =
    identityFacts?.kycState ??
    policyIdentity?.kycState ??
    facts.customer?.verification.kycState;
  const kycRecordVersion =
    identityFacts?.kycVersion ??
    policyIdentity?.kycRecordVersion ??
    facts.customer?.verification.kycRecordVersion;
  const identity: PolicyIdentityFacts = {
    ...(kycState ? { kycState } : {}),
    ...(kycRecordVersion !== undefined ? { kycRecordVersion } : {}),
    ...(policyIdentity?.residency
      ? { residency: policyIdentity.residency }
      : facts.customer
        ? { residency: facts.customer.residency }
        : {}),
    ...(policyIdentity?.citizenship ? { citizenship: policyIdentity.citizenship } : {}),
  };
  return {
    actor: facts.actor,
    actionType: intent.actionType,
    ...(facts.customer ? { customer: facts.customer } : {}),
    ...(facts.legalEntity ? { legalEntity: facts.legalEntity } : {}),
    ...(facts.product ? { product: facts.product } : {}),
    ...(facts.jurisdiction ? { jurisdiction: facts.jurisdiction } : {}),
    ...(facts.amount ? { amount: facts.amount } : {}),
    ...(facts.sourceAccount ? { sourceAccount: facts.sourceAccount } : {}),
    ...(facts.destinationAccount ? { destinationAccount: facts.destinationAccount } : {}),
    identity,
    ...(facts.serviceLocation ? { serviceLocation: facts.serviceLocation } : {}),
    ...(facts.transactionOrigin ? { transactionOrigin: facts.transactionOrigin } : {}),
    ...(facts.transactionDestination
      ? { transactionDestination: facts.transactionDestination }
      : {}),
    ...(facts.policyPin ? { policyPin: facts.policyPin } : {}),
    ...(facts.compliance ? { compliance: facts.compliance } : {}),
  };
}

export function toFactMap(input: PolicyFactInput): FactMap {
  const refs = resolveOfferingRefs(input);
  return {
    'actor.id': input.actor.id,
    actionType: input.actionType,
    environment: ENVIRONMENT,
    'customer.status': input.customer?.status,
    'customer.kycState': input.customer?.verification.kycState,
    'customer.kycRecordVersion': input.customer?.verification.kycRecordVersion,
    'customer.jurisdiction': input.customer?.jurisdiction,
    'customer.residency': input.customer?.residency,
    'customer.legalEntityId': input.customer?.legalEntityId,
    'identity.kycState': input.identity?.kycState ?? input.customer?.verification.kycState,
    'identity.kycRecordVersion':
      input.identity?.kycRecordVersion ?? input.customer?.verification.kycRecordVersion,
    'identity.citizenship': input.identity?.citizenship,
    'identity.residency': input.identity?.residency ?? input.customer?.residency,
    'legalEntity.id': refs.legalEntityId,
    'legalEntity.status': input.legalEntity?.status,
    'legalEntity.jurisdiction': input.legalEntity?.jurisdiction ?? refs.productJurisdiction,
    'product.id': refs.productId,
    'product.status': input.product?.status,
    'product.accountClass': refs.accountClass,
    'product.jurisdiction': refs.productJurisdiction,
    'product.currency': refs.currency,
    'product.legalEntityId': input.product?.legalEntityId ?? refs.legalEntityId,
    'amount.minorUnits': input.amount ? input.amount.minorUnits.toString() : undefined,
    'amount.currency': input.amount?.currency,
    serviceLocation: input.serviceLocation,
    transactionOrigin: input.transactionOrigin,
    transactionDestination: input.transactionDestination,
    'capability.enabled': input.capabilityEnabled,
    'capability.environment': input.capabilityEnvironment,
    offeringMode: input.offeringMode,
    'screening.sanctionsOutcome': input.compliance?.sanctionsOutcome ?? undefined,
    'screening.pepOutcome': input.compliance?.pepOutcome ?? undefined,
    'screening.adverseMediaOutcome': input.compliance?.adverseMediaOutcome ?? undefined,
    'screening.fresh':
      input.compliance === undefined
        ? undefined
        : input.compliance.sanctionsFresh && input.compliance.pepFresh && input.compliance.adverseMediaFresh,
    'screening.providerAvailable': input.compliance?.providerAvailable,
    'aml.riskCategory': input.compliance?.amlCategory ?? undefined,
    'fraud.outcome': input.compliance?.fraudOutcome ?? undefined,
    'velocity.triggered': input.compliance?.velocityTriggered,
  };
}

/**
 * Hash only non-PII identifiers and status codes so a decision can be
 * reproduced without storing raw identity documents.
 */
export function hashPolicyFacts(input: PolicyFactInput): string {
  const refs = resolveOfferingRefs(input);
  return hashCanonical({
    actorId: input.actor.id,
    actionType: input.actionType,
    environment: ENVIRONMENT,
    customerId: input.customer?.id ?? null,
    customerStatus: input.customer?.status ?? null,
    kycState: input.identity?.kycState ?? input.customer?.verification.kycState ?? null,
    kycRecordVersion:
      input.identity?.kycRecordVersion ?? input.customer?.verification.kycRecordVersion ?? null,
    residency: input.identity?.residency ?? input.customer?.residency ?? null,
    citizenshipPresent: input.identity?.citizenship !== undefined,
    legalEntityId: refs.legalEntityId ?? null,
    productId: refs.productId ?? null,
    jurisdiction: input.jurisdiction ?? null,
    amountMinorUnits: input.amount ? input.amount.minorUnits.toString() : null,
    amountCurrency: input.amount?.currency ?? null,
    sourceAccountId: input.sourceAccount?.id ?? null,
    destinationAccountId: input.destinationAccount?.id ?? null,
    serviceLocation: input.serviceLocation ?? null,
    transactionOrigin: input.transactionOrigin ?? null,
    transactionDestination: input.transactionDestination ?? null,
    policyPin: input.policyPin ?? null,
    sanctionsOutcome: input.compliance?.sanctionsOutcome ?? null,
    pepOutcome: input.compliance?.pepOutcome ?? null,
    amlCategory: input.compliance?.amlCategory ?? null,
    fraudOutcome: input.compliance?.fraudOutcome ?? null,
    providerAvailable: input.compliance?.providerAvailable ?? null,
  });
}
