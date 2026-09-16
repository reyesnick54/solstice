import type { CustomerId } from '../../../domain/src/customer.ts';
import { asJurisdiction, type Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { sha256Hex } from '../../../security/src/hash.ts';
import { Money } from '../../../money/src/money.ts';
import { isActiveMandate, isTerminalMandate } from '../mandate/lifecycle.ts';
import type { CompiledEconomicMandate } from '../mandate/types.ts';
import type {
  ActivityClass,
  BindingReasonCode,
  ObjectiveClass,
  ProductClass,
} from './taxonomy.ts';
import type { BindingFailure, MandateBindingRef, MandatePermittedScope } from './types.ts';
import { asMandateVersion } from '../ids.ts';

const RESEARCH_OBJECTIVES: readonly ObjectiveClass[] = Object.freeze(['RESEARCH', 'ANALYSIS']);
const FINANCIAL_OBJECTIVES: readonly ObjectiveClass[] = Object.freeze(['FINANCIAL_PROPOSAL', 'EXECUTION_PREP']);

const RESEARCH_ACTIVITIES: readonly ActivityClass[] = Object.freeze(['RESEARCH', 'DATA_ACCESS', 'TOOL_USE']);
const FINANCIAL_ACTIVITIES: readonly ActivityClass[] = Object.freeze(['FINANCIAL_PROPOSAL', 'EXECUTION_PREP']);

const CATEGORY_TO_PRODUCT: Readonly<Record<string, ProductClass>> = {
  EQUITIES: 'EQUITIES',
  ETF: 'ETF',
  BONDS: 'BONDS',
  CRYPTO: 'CRYPTO',
  DERIVATIVES: 'DERIVATIVES',
  FX: 'FX',
  CASH: 'CASH',
};

function categoriesToProductClasses(categories: readonly string[] | undefined): readonly ProductClass[] {
  if (!categories || categories.length === 0) {
    return Object.freeze(['CASH', 'EQUITIES', 'ETF', 'BONDS'] as ProductClass[]);
  }
  const out: ProductClass[] = [];
  for (const category of categories) {
    const mapped = CATEGORY_TO_PRODUCT[category.toUpperCase()];
    if (mapped) {
      out.push(mapped);
    }
  }
  return Object.freeze(out.length > 0 ? out : (['CASH'] as ProductClass[]));
}

export function mandatePermittedScopeFromCompiled(mandate: CompiledEconomicMandate): MandatePermittedScope {
  const allowedProposalCategories = mandate.hardConstraints.find((item) => item.kind === 'ALLOWED_PROPOSAL_CATEGORIES');
  const prohibitedProducts = mandate.hardConstraints.find((item) => item.kind === 'PROHIBITED_PRODUCT_CATEGORIES');
  const prohibitedAssets = mandate.hardConstraints.find((item) => item.kind === 'PROHIBITED_ASSET_CATEGORIES');
  const prohibitedJurisdictions = mandate.hardConstraints.find((item) => item.kind === 'PROHIBITED_JURISDICTIONS');
  const maxSingle = mandate.hardConstraints.find((item) => item.kind === 'MAXIMUM_SINGLE_PROPOSED_ACTION_AMOUNT');

  const proposalCategories = allowedProposalCategories?.categories ?? [];
  const researchOnly =
    proposalCategories.length > 0 &&
    proposalCategories.every((item) => item === 'RESEARCH' || item === 'ANALYSIS' || item === 'INFORMATION');

  const objectiveClasses: ObjectiveClass[] = researchOnly
    ? [...RESEARCH_OBJECTIVES]
    : [...RESEARCH_OBJECTIVES, ...FINANCIAL_OBJECTIVES];

  const activityClasses: ActivityClass[] = researchOnly
    ? [...RESEARCH_ACTIVITIES]
    : [...RESEARCH_ACTIVITIES, ...FINANCIAL_ACTIVITIES];

  const prohibitedProductClasses = categoriesToProductClasses([
    ...(prohibitedProducts?.categories ?? []),
    ...(prohibitedAssets?.categories ?? []),
  ]);

  const allProducts = categoriesToProductClasses(undefined);
  const productClasses = Object.freeze(
    allProducts.filter((item) => !prohibitedProductClasses.includes(item)),
  ) as readonly ProductClass[];

  const jurisdictions: readonly Jurisdiction[] = prohibitedJurisdictions?.jurisdictions?.length
    ? Object.freeze([])
    : Object.freeze([asJurisdiction('US'), asJurisdiction('GB'), asJurisdiction('DE')]);

  return Object.freeze({
    objectiveClasses,
    activityClasses,
    productClasses,
    capitalCeiling: maxSingle?.amount ?? null,
    prohibitedProductClasses,
    prohibitedActivityClasses: researchOnly ? Object.freeze(['FINANCIAL_PROPOSAL', 'EXECUTION_PREP'] as ActivityClass[]) : Object.freeze([]),
    jurisdictions,
  });
}

export function mandateBindingRefFromCompiled(
  mandate: CompiledEconomicMandate,
  customerId: CustomerId,
  now: UtcInstant,
): MandateBindingRef {
  const snapshotHash = sha256Hex(
    JSON.stringify({
      mandateId: mandate.mandateId,
      version: mandate.version,
      state: mandate.state,
      hardConstraints: mandate.hardConstraints,
    }),
  );
  return Object.freeze({
    mandateId: mandate.mandateId,
    mandateVersion: asMandateVersion(mandate.version),
    mandateOwnerCustomerId: customerId,
    mandateSubjectId: mandate.subjectId,
    mandateState: mandate.state,
    effectiveAt: mandate.compiledAt,
    expiresAt: null,
    snapshotHash,
  });
}

export function validateMandateBinding(input: {
  readonly mandate: CompiledEconomicMandate;
  readonly mandateRef: MandateBindingRef;
  readonly customerId: CustomerId;
  readonly now: UtcInstant;
}): BindingFailure | null {
  if (input.mandateRef.mandateOwnerCustomerId !== input.customerId) {
    return { code: 'MANDATE_CUSTOMER_MISMATCH', message: 'mandate does not belong to this customer' };
  }
  if (input.mandate.subjectId !== input.mandateRef.mandateSubjectId) {
    return { code: 'MANDATE_CUSTOMER_MISMATCH', message: 'mandate subject does not match binding reference' };
  }
  if (input.mandate.mandateId !== input.mandateRef.mandateId) {
    return { code: 'MANDATE_CUSTOMER_MISMATCH', message: 'mandate id does not match binding reference' };
  }
  if (input.mandate.version !== input.mandateRef.mandateVersion) {
    return { code: 'MANDATE_SCOPE_EXCEEDED', message: 'mandate version changed; rebind required' };
  }
  if (isTerminalMandate(input.mandate.state)) {
    const code: BindingReasonCode =
      input.mandate.state === 'EXPIRED' ? 'MANDATE_EXPIRED' : 'MANDATE_REVOKED';
    return { code, message: `mandate is ${input.mandate.state}` };
  }
  if (!isActiveMandate(input.mandate.state)) {
    return { code: 'MANDATE_NOT_ACTIVE', message: `mandate state ${input.mandate.state} cannot authorize work` };
  }
  if (input.mandateRef.expiresAt && input.mandateRef.expiresAt <= input.now) {
    return { code: 'MANDATE_EXPIRED', message: 'mandate binding reference has expired' };
  }
  return null;
}

export function requestedScopeWithinMandate(
  requestedCapital: { readonly minorUnits: string; readonly currency: string } | null,
  mandate: MandatePermittedScope,
): BindingFailure | null {
  if (!requestedCapital || !mandate.capitalCeiling) {
    return null;
  }
  const requested = Money.fromMinorUnitsString(requestedCapital.minorUnits, requestedCapital.currency);
  const ceiling = Money.fromMinorUnitsString(mandate.capitalCeiling.minorUnits, mandate.capitalCeiling.currency);
  if (requested.cmp(ceiling) > 0) {
    return { code: 'CAPITAL_CEILING_EXCEEDED', message: 'requested capital exceeds mandate ceiling' };
  }
  return null;
}
