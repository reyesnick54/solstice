/**
 * Internal treasury book kinds for future operating, customer-funds,
 * settlement, clearing, prefunding, FX, card, fee, and suspense books.
 *
 * These are configuration labels, not a legal account-ownership structure.
 * Banking/counsel arrangements are not finalized. Customer balances remain
 * on the canonical Ledger. CUSTOMER ownership is still forbidden here.
 */

import { TREASURY_ACCOUNT_KINDS, type TreasuryAccountKind } from '../types.ts';

export const PRODUCT_TREASURY_ACCOUNT_KINDS = TREASURY_ACCOUNT_KINDS;

export const FUTURE_OPERATING_KINDS = [
  'OPERATING',
  'CUSTOMER_FUNDS',
  'SETTLEMENT',
  'CLEARING',
  'PROVIDER_PREFUNDING',
  'FX_LIQUIDITY',
  'CARD_SETTLEMENT',
  'FEE',
  'SUSPENSE',
] as const satisfies readonly TreasuryAccountKind[];

export const TREASURY_KIND_NOTE =
  'Internal book classification only. Does not imply beneficial ownership, safeguarding perimeter, or a licensed bank-account structure.';

export function isProductTreasuryKind(value: string): value is TreasuryAccountKind {
  return (TREASURY_ACCOUNT_KINDS as readonly string[]).includes(value);
}
