/**
 * Named, disclosed class bridges for product money classes.
 *
 * Insured deposits and investment assets NEVER share a posting class.
 * Moving between them requires a named disclosed bridge. If the pair is
 * undefined the transfer is refused entirely — that refusal is correct.
 */

export const PRODUCT_LEDGER_CLASSES = [
  'INSURED_DEPOSIT',
  'INVESTMENT_CASH',
  'INVESTMENT_SECURITY',
] as const;

export type ProductLedgerClass = (typeof PRODUCT_LEDGER_CLASSES)[number];

export type NamedClassBridge = {
  readonly name: string;
  readonly fromClass: ProductLedgerClass;
  readonly toClass: ProductLedgerClass;
  readonly disclosed: true;
  readonly purpose: string;
  readonly agreementRequired: true;
};

export const DEPOSIT_TO_INVESTMENT_CASH_SWEEP: NamedClassBridge = Object.freeze({
  name: 'DEPOSIT_TO_INVESTMENT_CASH_SWEEP',
  fromClass: 'INSURED_DEPOSIT',
  toClass: 'INVESTMENT_CASH',
  disclosed: true,
  purpose:
    'Customer-authorized sweep of insured deposits into investment cash. Requires an investment account agreement, current risk profile, current disclosure, and customer transfer authorization. Not a guarantee of return.',
  agreementRequired: true,
});

export const INVESTMENT_TO_DEPOSIT_HARVEST: NamedClassBridge = Object.freeze({
  name: 'INVESTMENT_TO_DEPOSIT_HARVEST',
  fromClass: 'INVESTMENT_CASH',
  toClass: 'INSURED_DEPOSIT',
  disclosed: true,
  purpose:
    'Weekly harvest of REALIZED, SETTLED profit from investment cash back to insured deposits. Unrealized marks cannot use this bridge.',
  agreementRequired: true,
});

const REGISTERED: readonly NamedClassBridge[] = Object.freeze([
  DEPOSIT_TO_INVESTMENT_CASH_SWEEP,
  INVESTMENT_TO_DEPOSIT_HARVEST,
]);

export type ClassBridgeRefusal = {
  readonly code: 'CLASS_BRIDGE_UNDEFINED';
  readonly fromClass: ProductLedgerClass;
  readonly toClass: ProductLedgerClass;
  readonly reason: string;
};

export function resolveClassBridge(
  fromClass: ProductLedgerClass,
  toClass: ProductLedgerClass,
): NamedClassBridge | ClassBridgeRefusal {
  const found = REGISTERED.find(
    (bridge) => bridge.fromClass === fromClass && bridge.toClass === toClass,
  );
  if (!found) {
    return {
      code: 'CLASS_BRIDGE_UNDEFINED',
      fromClass,
      toClass,
      reason: `no named disclosed class bridge exists for ${fromClass} → ${toClass}; the transfer is refused entirely`,
    };
  }
  return found;
}

export function isClassBridgeRefusal(
  value: NamedClassBridge | ClassBridgeRefusal,
): value is ClassBridgeRefusal {
  return 'code' in value && value.code === 'CLASS_BRIDGE_UNDEFINED';
}

export function listedBridges(): readonly NamedClassBridge[] {
  return REGISTERED;
}
