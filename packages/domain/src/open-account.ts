import type { ActionIntent, ActorRef, IntentId } from '../../permissions/src/index.ts';
import { createActionIntent } from '../../permissions/src/index.ts';
import { isAccountClass, type AccountClass } from './account-class.ts';
import { isCurrency, type Currency } from './currency.ts';
import type { CustomerId } from './customer.ts';
import { isJurisdiction, type Jurisdiction } from './jurisdiction.ts';
import type { LegalEntity, LegalEntityId } from './legal-entity.ts';
import { lookupProduct, type Product, type ProductCatalog } from './product.ts';
import { err, ok, type Result } from './result.ts';
import { isUtcInstant, type UtcInstant } from './time.ts';

/**
 * Action type literal for opening a customer account. Declared as a const so
 * `ActionIntent<typeof OPEN_ACCOUNT, OpenAccountPayload>` stays exact.
 * Do not add this literal to packages/permissions — the envelope is generic.
 */
export const OPEN_ACCOUNT = 'OPEN_ACCOUNT' as const;

export type OpenAccountActionType = typeof OPEN_ACCOUNT;

export type OpenAccountPayload = {
  readonly ownerId: CustomerId;
  readonly accountClass: AccountClass;
  readonly productId: ProductId;
  readonly legalEntityId: LegalEntityId;
  readonly jurisdiction: Jurisdiction;
  readonly currency: Currency;
};

export type OpenAccountIntent = ActionIntent<OpenAccountActionType, OpenAccountPayload>;

export type CreateOpenAccountIntentInput = {
  readonly intentId: IntentId;
  readonly payload: OpenAccountPayload;
  readonly actor: ActorRef;
  readonly proposedAt: UtcInstant;
};

export function createOpenAccountIntent(
  input: CreateOpenAccountIntentInput,
): OpenAccountIntent {
  return createActionIntent({
    intentId: input.intentId,
    actionType: OPEN_ACCOUNT,
    payload: Object.freeze({
      ownerId: input.payload.ownerId,
      accountClass: input.payload.accountClass,
      productId: input.payload.productId,
      legalEntityId: input.payload.legalEntityId,
      jurisdiction: input.payload.jurisdiction,
      currency: input.payload.currency,
    }),
    actor: input.actor,
    proposedAt: input.proposedAt,
  });
}

export type LegalEntityCatalog = {
  readonly legalEntities: readonly LegalEntity[];
};

export type OpenAccountCatalog = ProductCatalog & LegalEntityCatalog;

export type OpenAccountValidationFailure =
  | {
      readonly code: 'WRONG_ACTION_TYPE';
      readonly actionType: string;
    }
  | {
      readonly code: 'MALFORMED_PAYLOAD';
      readonly field: string;
    }
  | {
      readonly code: 'PRODUCT_NOT_IN_CATALOG';
      readonly productId: string;
    }
  | {
      readonly code: 'ACCOUNT_CLASS_MISMATCH';
      readonly productId: string;
      readonly expected: AccountClass;
      readonly actual: AccountClass;
    }
  | {
      readonly code: 'LEGAL_ENTITY_NOT_FOUND';
      readonly legalEntityId: string;
    }
  | {
      readonly code: 'JURISDICTION_MISMATCH';
      readonly legalEntityId: string;
      readonly expected: Jurisdiction;
      readonly actual: Jurisdiction;
    }
  | {
      readonly code: 'CURRENCY_MISMATCH';
      readonly productId: string;
      readonly expected: Currency;
      readonly actual: Currency;
    };

export type OpenAccountValidationResult = Result<
  OpenAccountIntent,
  OpenAccountValidationFailure
>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function malformed(field: string): OpenAccountValidationResult {
  return err(
    Object.freeze({
      code: 'MALFORMED_PAYLOAD' as const,
      field,
    }),
  );
}

function lookupLegalEntity(
  catalog: LegalEntityCatalog,
  legalEntityId: string,
): LegalEntity | undefined {
  return catalog.legalEntities.find((entity) => entity.id === legalEntityId);
}

/**
 * Structural validation of an OPEN_ACCOUNT intent against the product catalog
 * and legal-entity register. This is not authorization: it does not evaluate
 * proofs, eligibility, or any Compliance Kernel policy.
 */
export function validateOpenAccountIntent(
  intent: ActionIntent<string, unknown>,
  catalog: OpenAccountCatalog,
): OpenAccountValidationResult {
  if (intent.actionType !== OPEN_ACCOUNT) {
    return err(
      Object.freeze({
        code: 'WRONG_ACTION_TYPE' as const,
        actionType: intent.actionType,
      }),
    );
  }

  if (!isNonEmptyString(intent.intentId)) {
    return malformed('intentId');
  }
  if (!intent.actor || !isNonEmptyString(intent.actor.id)) {
    return malformed('actor.id');
  }
  if (!isUtcInstant(intent.proposedAt)) {
    return malformed('proposedAt');
  }

  const payload = intent.payload;
  if (payload === null || typeof payload !== 'object') {
    return malformed('payload');
  }

  const record = payload as {
    readonly ownerId?: unknown;
    readonly accountClass?: unknown;
    readonly productId?: unknown;
    readonly legalEntityId?: unknown;
    readonly jurisdiction?: unknown;
    readonly currency?: unknown;
  };

  if (!isNonEmptyString(record.ownerId)) {
    return malformed('ownerId');
  }
  if (!isAccountClass(record.accountClass)) {
    return malformed('accountClass');
  }
  if (!isNonEmptyString(record.productId)) {
    return malformed('productId');
  }
  if (!isNonEmptyString(record.legalEntityId)) {
    return malformed('legalEntityId');
  }
  if (!isJurisdiction(record.jurisdiction)) {
    return malformed('jurisdiction');
  }
  if (!isCurrency(record.currency)) {
    return malformed('currency');
  }

  const legalEntity = lookupLegalEntity(catalog, record.legalEntityId);
  if (legalEntity === undefined) {
    return err(
      Object.freeze({
        code: 'LEGAL_ENTITY_NOT_FOUND' as const,
        legalEntityId: record.legalEntityId,
      }),
    );
  }

  if (legalEntity.jurisdiction !== record.jurisdiction) {
    return err(
      Object.freeze({
        code: 'JURISDICTION_MISMATCH' as const,
        legalEntityId: record.legalEntityId,
        expected: legalEntity.jurisdiction,
        actual: record.jurisdiction,
      }),
    );
  }

  const product = lookupProduct(catalog, record.productId as Product['id']);
  if (product === undefined) {
    return err(
      Object.freeze({
        code: 'PRODUCT_NOT_IN_CATALOG' as const,
        productId: record.productId,
      }),
    );
  }

  if (product.accountClass !== record.accountClass) {
    return err(
      Object.freeze({
        code: 'ACCOUNT_CLASS_MISMATCH' as const,
        productId: record.productId,
        expected: product.accountClass,
        actual: record.accountClass,
      }),
    );
  }

  if (product.currency !== record.currency) {
    return err(
      Object.freeze({
        code: 'CURRENCY_MISMATCH' as const,
        productId: record.productId,
        expected: product.currency,
        actual: record.currency,
      }),
    );
  }

  const typed: OpenAccountIntent = createOpenAccountIntent({
    intentId: intent.intentId,
    payload: {
      ownerId: record.ownerId as CustomerId,
      accountClass: record.accountClass,
      productId: record.productId as Product['id'],
      legalEntityId: record.legalEntityId as LegalEntityId,
      jurisdiction: record.jurisdiction,
      currency: record.currency,
    },
    actor: intent.actor,
    proposedAt: intent.proposedAt,
  });

  return ok(typed);
}
