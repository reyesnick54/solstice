import {
  ACTION_TYPE_FOR_CAPABILITY,
  type IdentityCapability,
} from './capability.ts';

/**
 * Product-facing capability names. These are aliases that map through
 * the existing IdentityCapability / ActionType architecture.
 * UI roles are not used in deep business logic.
 */
export const PRODUCT_CAPABILITIES = [
  'ACCOUNT_READ',
  'PAYMENT_CREATE',
  'PAYMENT_APPROVE',
  'FX_QUOTE',
  'CARD_MANAGE',
  'INVESTMENT_PROPOSE',
  'INVESTMENT_EXECUTE',
  'AGENT_USE',
  'AGENT_ACTION_APPROVE',
  'EXCHANGE_TRADE',
  'WITHDRAWAL_CREATE',
  'DATA_CONSENT_MANAGE',
  'ADMIN_COMPLIANCE',
  'AUTHORITY_PATH_REHEARSE',
] as const;

export type ProductCapability = (typeof PRODUCT_CAPABILITIES)[number];

export const PRODUCT_TO_IDENTITY_CAPABILITY: Readonly<
  Record<ProductCapability, readonly IdentityCapability[]>
> = {
  ACCOUNT_READ: ['VIEW_ACCOUNT'],
  PAYMENT_CREATE: ['PAYMENT_REQUEST'],
  PAYMENT_APPROVE: ['PAYMENT_APPROVE'],
  FX_QUOTE: ['FX_QUOTE_REQUEST'],
  CARD_MANAGE: ['CARD_MANAGE_REQUEST'],
  INVESTMENT_PROPOSE: ['INVESTMENT_PROPOSE'],
  INVESTMENT_EXECUTE: ['INVESTMENT_OPERATE_REQUEST'],
  AGENT_USE: ['AGENT_USE'],
  AGENT_ACTION_APPROVE: ['AGENT_ACTION_APPROVE'],
  EXCHANGE_TRADE: ['EXCHANGE_OPERATE_REQUEST'],
  WITHDRAWAL_CREATE: ['POST_WITHDRAWAL_REQUEST'],
  DATA_CONSENT_MANAGE: ['CONSENT_GRANT_OWN', 'CONSENT_REVOKE_OWN', 'CONSENT_VIEW_OWN'],
  ADMIN_COMPLIANCE: ['ADMIN_COMPLIANCE'],
  AUTHORITY_PATH_REHEARSE: ['AUTHORITY_PATH_REHEARSE'],
};

export function isProductCapability(value: unknown): value is ProductCapability {
  return typeof value === 'string' && (PRODUCT_CAPABILITIES as readonly string[]).includes(value);
}

export function identityCapabilitiesForProduct(
  capability: ProductCapability,
): readonly IdentityCapability[] {
  return PRODUCT_TO_IDENTITY_CAPABILITY[capability];
}

export function actionTypesForProductCapability(capability: ProductCapability): readonly string[] {
  const types = new Set<string>();
  for (const identity of PRODUCT_TO_IDENTITY_CAPABILITY[capability]) {
    for (const actionType of ACTION_TYPE_FOR_CAPABILITY[identity]) {
      types.add(actionType);
    }
  }
  return Object.freeze([...types]);
}

export function hasProductCapability(
  granted: readonly IdentityCapability[],
  requested: ProductCapability,
): boolean {
  const required = PRODUCT_TO_IDENTITY_CAPABILITY[requested];
  if (requested === 'DATA_CONSENT_MANAGE') {
    return required.some((capability) => granted.includes(capability));
  }
  return required.every((capability) => granted.includes(capability));
}
