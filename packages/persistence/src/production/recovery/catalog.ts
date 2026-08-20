/**
 * Recovery coordinator catalog. Not a workflow engine and not a ledger.
 */

export const OPERATIONAL_BACKUP_RELATIONS = Object.freeze([
  'payments.operational_payment',
  'payments.operational_rail_submission',
  'payments.operational_fx_execution',
  'custody.operational_vault',
  'custody.operational_wallet',
  'custody.operational_withdrawal',
  'custody.operational_deposit',
  'custody.operational_reservation',
  'custody.operational_provider_submission',
  'sunrey_exchange.operational_order',
  'sunrey_exchange.operational_reservation',
  'sunrey_exchange.operational_trade',
  'sunrey_exchange.operational_settlement_intent',
  'customer.provider_operational_state',
  'customer.operational_outbox',
  'customer.operational_inbox',
  'security.credential_descriptor_ref',
] as const);

export const RECOVERY_CATALOG_OWNER = 'packages/persistence' as const;
export const RECOVERY_CAPABILITY = 'sunrey-operational-persistence-recovery' as const;
export const NOT_A_WORKFLOW_ENGINE = true as const;
export const NOT_A_LEDGER = true as const;
