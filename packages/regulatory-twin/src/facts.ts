import {
  asCustomerId,
  createProspect,
  notStartedVerification,
  transitionCustomerStatus,
  type Customer,
} from '../../domain/src/customer.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import { asJurisdiction, asResidency } from '../../domain/src/jurisdiction.ts';
import { asLegalEntityId, freezeLegalEntity, type LegalEntity } from '../../domain/src/legal-entity.ts';
import { asProductId, freezeProduct, type Product } from '../../domain/src/product.ts';
import { asUtcInstant, type UtcInstant } from '../../domain/src/time.ts';
import { isOk } from '../../domain/src/result.ts';
import { Money } from '../../money/src/money.ts';
import type { PolicyFactInput } from '../../kernel/src/policy/index.ts';
import { hashCanonical } from '../../kernel/src/policy/hash.ts';
import { asOpaqueSubjectRef, type OpaqueSubjectRef } from './ids.ts';
import type { ClassifiedFact, ScenarioFactBundle } from './types.ts';
import type { FactSourceKind } from './taxonomy.ts';

const CATALOG_AT = asUtcInstant('2026-01-15T09:00:00.000Z');

export const US_ENTITY = freezeLegalEntity({
  id: asLegalEntityId('le_solstice_us_inc'),
  name: 'Solstice US Inc (simulation)',
  jurisdiction: asJurisdiction('US'),
  status: 'ACTIVE',
});

export const SA_ENTITY = freezeLegalEntity({
  id: asLegalEntityId('le_solstice_sa_entity'),
  name: 'Solstice SA Entity (simulation)',
  jurisdiction: asJurisdiction('SA'),
  status: 'ACTIVE',
});

export const GB_ENTITY = freezeLegalEntity({
  id: asLegalEntityId('le_solstice_uk_ltd'),
  name: 'Solstice UK Ltd (simulation)',
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

export const US_PRODUCT = freezeProduct({
  id: asProductId('prod_demand_usd_us'),
  name: 'US demand',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('USD'),
  legalEntityId: US_ENTITY.id,
  jurisdiction: asJurisdiction('US'),
  status: 'ACTIVE',
});

export const SA_PRODUCT = freezeProduct({
  id: asProductId('prod_demand_sar_sa'),
  name: 'SA demand',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('SAR'),
  legalEntityId: SA_ENTITY.id,
  jurisdiction: asJurisdiction('SA'),
  status: 'ACTIVE',
});

export const GB_PRODUCT = freezeProduct({
  id: asProductId('prod_demand_usd_gb'),
  name: 'GB demand',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('USD'),
  legalEntityId: GB_ENTITY.id,
  jurisdiction: asJurisdiction('GB'),
  status: 'ACTIVE',
});

export function classified<T>(value: T, source: FactSourceKind): ClassifiedFact<T> {
  return Object.freeze({ value, source });
}

export function hypotheticalFactKeys(facts: ScenarioFactBundle): readonly string[] {
  return Object.freeze(
    (Object.entries(facts) as readonly [string, ClassifiedFact<unknown> | undefined][])
      .filter(([, fact]) => fact?.source === 'HYPOTHETICAL_FACT' || fact?.source === 'LEGAL_ASSUMPTION')
      .map(([key]) => key),
  );
}

export function opaqueSubjectRefFor(customerId: string): OpaqueSubjectRef {
  return asOpaqueSubjectRef(`osr_${hashCanonical({ customerId }).slice(0, 24)}`);
}

export function syntheticCustomer(input: {
  readonly id: string;
  readonly jurisdiction: string;
  readonly legalEntityId: string;
  readonly status?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'PENDING_VERIFICATION';
  readonly kycState?: 'VERIFIED' | 'FAILED' | 'EXPIRED' | 'NOT_STARTED' | 'IN_PROGRESS';
  readonly kycRecordVersion?: number;
  readonly at: UtcInstant;
}): Customer {
  let customer = createProspect({
    id: asCustomerId(input.id),
    legalEntityId: asLegalEntityId(input.legalEntityId),
    jurisdiction: asJurisdiction(input.jurisdiction),
    residency: asResidency(input.jurisdiction),
    verification: notStartedVerification(asUtcInstant('2027-08-13T00:00:00.000Z')),
    createdAt: CATALOG_AT,
  });
  const pending = transitionCustomerStatus(customer, 'PENDING_VERIFICATION', input.at);
  if (!isOk(pending)) {
    throw new Error('synthetic customer cannot enter PENDING_VERIFICATION');
  }
  const kycState = input.kycState ?? 'VERIFIED';
  customer = {
    ...pending.value.customer,
    verification: Object.freeze({
      kycState: kycState === 'NOT_STARTED' || kycState === 'IN_PROGRESS' ? 'IN_PROGRESS' : kycState,
      kycRecordVersion: input.kycRecordVersion ?? 1,
      refreshBy: asUtcInstant('2027-08-13T00:00:00.000Z'),
    }),
  };
  const target = input.status ?? 'ACTIVE';
  if (target === 'PENDING_VERIFICATION') {
    return customer;
  }
  const active = transitionCustomerStatus(customer, 'ACTIVE', input.at);
  if (!isOk(active)) {
    throw new Error('synthetic customer cannot enter ACTIVE');
  }
  customer = active.value.customer;
  if (target === 'ACTIVE') {
    return customer;
  }
  const next = transitionCustomerStatus(customer, target, input.at);
  if (!isOk(next)) {
    throw new Error(`synthetic customer cannot enter ${target}`);
  }
  return next.value.customer;
}

function entityFor(id: string | undefined): LegalEntity | undefined {
  if (id === US_ENTITY.id) return US_ENTITY;
  if (id === SA_ENTITY.id) return SA_ENTITY;
  if (id === GB_ENTITY.id) return GB_ENTITY;
  return undefined;
}

function productFor(id: string | undefined): Product | undefined {
  if (id === US_PRODUCT.id) return US_PRODUCT;
  if (id === SA_PRODUCT.id) return SA_PRODUCT;
  if (id === GB_PRODUCT.id) return GB_PRODUCT;
  return undefined;
}

export function requiredMissingFacts(facts: ScenarioFactBundle): readonly string[] {
  const missing: string[] = [];
  if (!facts.actionType) missing.push('actionType');
  if (!facts.actorId) missing.push('actorId');
  if (!facts.jurisdiction) missing.push('jurisdiction');
  if (!facts.customerId) missing.push('customerId');
  if (!facts.productId) missing.push('productId');
  if (!facts.legalEntityId) missing.push('legalEntityId');
  return Object.freeze(missing);
}

export function policyFactsFromScenario(
  facts: ScenarioFactBundle,
  at: UtcInstant,
): PolicyFactInput {
  const actorId = facts.actorId?.value ?? 'rdt_sandbox_actor';
  const actionType = facts.actionType?.value ?? 'OPEN_ACCOUNT';
  const jurisdiction = facts.jurisdiction?.value;
  const legalEntityId = facts.legalEntityId?.value;
  const productId = facts.productId?.value;
  const customerId = facts.customerId?.value;
  const identityRevoked = facts.identityRevoked?.value === true;

  const legalEntity = entityFor(legalEntityId);
  const product = productFor(productId);
  const customer =
    customerId && jurisdiction && legalEntityId && !identityRevoked
      ? syntheticCustomer({
          id: customerId,
          jurisdiction,
          legalEntityId,
          ...(facts.customerStatus?.value
            ? {
                status: facts.customerStatus.value as
                  | 'ACTIVE'
                  | 'SUSPENDED'
                  | 'CLOSED'
                  | 'PENDING_VERIFICATION',
              }
            : {}),
          ...(facts.kycState?.value
            ? {
                kycState: facts.kycState.value as
                  | 'VERIFIED'
                  | 'FAILED'
                  | 'EXPIRED'
                  | 'NOT_STARTED'
                  | 'IN_PROGRESS',
              }
            : {}),
          ...(facts.kycRecordVersion ? { kycRecordVersion: facts.kycRecordVersion.value } : {}),
          at,
        })
      : undefined;

  const amount =
    facts.amountMinorUnits && facts.currency
      ? Money.fromMinorUnits(BigInt(facts.amountMinorUnits.value), facts.currency.value)
      : undefined;

  const screening =
    facts.sanctionsHit || facts.pepHit || facts.fraudHold
      ? {
          sanctionsHit: facts.sanctionsHit?.value ?? false,
          pepHit: facts.pepHit?.value ?? false,
          fraudHold: facts.fraudHold?.value ?? false,
          screeningRef: 'rdt-sandbox-screening',
        }
      : undefined;

  const compliance =
    facts.screeningFresh !== undefined
      ? {
          sanctionsOutcome: facts.sanctionsHit?.value ? ('BLOCK' as const) : ('CLEAR' as const),
          pepOutcome: facts.pepHit?.value ? ('REVIEW' as const) : ('CLEAR' as const),
          adverseMediaOutcome: 'CLEAR' as const,
          sanctionsFresh: facts.screeningFresh.value,
          pepFresh: facts.screeningFresh.value,
          adverseMediaFresh: facts.screeningFresh.value,
          requiredScreeningMissing: false,
          providerAvailable: true,
          outagePosture: null,
          amlCategory: 'LOW' as const,
          fraudOutcome: facts.fraudHold?.value ? ('HOLD' as const) : ('ALLOW' as const),
          velocityTriggered: false,
          hardBlock: facts.sanctionsHit?.value === true,
          stepUpRequired: false,
          latestScreeningId: 'rdt-sandbox-screening',
          latestCaseId: null,
          policyVersionId: null,
        }
      : undefined;

  return {
    actor: { id: actorId, capabilities: actionType ? [actionType] : [] },
    actionType,
    ...(customer ? { customer } : {}),
    ...(legalEntity ? { legalEntity } : {}),
    ...(product ? { product } : {}),
    ...(jurisdiction ? { jurisdiction: asJurisdiction(jurisdiction) } : {}),
    ...(amount ? { amount } : {}),
    identity: {
      ...(facts.kycState ? { kycState: facts.kycState.value } : {}),
      ...(facts.kycRecordVersion ? { kycRecordVersion: facts.kycRecordVersion.value } : {}),
      ...(facts.residency ? { residency: asResidency(facts.residency.value) } : {}),
    },
    ...(screening ? { screening } : {}),
    ...(compliance ? { compliance } : {}),
    ...(facts.corridorId ? { corridorId: facts.corridorId.value } : {}),
    ...(facts.corridorSimulationEnabled !== undefined
      ? { corridorSimulationEnabled: facts.corridorSimulationEnabled.value }
      : {}),
    ...(facts.beneficiaryStatus ? { beneficiaryStatus: facts.beneficiaryStatus.value } : {}),
  };
}
