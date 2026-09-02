/**
 * Wave 8 — money reconciliation across chain, wallet, ledger, and exchange.
 *
 * Reconciliation never rewrites canonical chain state automatically.
 */

import { reconcileDigitalAssetPlanes } from '../provider-candidate/authority.ts';
import type { WalletReconciliationPlane } from './taxonomy.ts';

export const MONEY_RECONCILIATION_BREAK_KINDS = [
  'MISSING_POSTING',
  'MISSING_SETTLEMENT',
  'PROJECTION_MISMATCH',
  'DUPLICATE_SETTLEMENT',
  'UNKNOWN_TRANSACTION',
  'WRONG_ASSET',
  'PLANE_MISMATCH',
] as const;
export type MoneyReconciliationBreakKind = (typeof MONEY_RECONCILIATION_BREAK_KINDS)[number];

export type MoneyReconciliationBreak = {
  readonly breakId: string;
  readonly kind: MoneyReconciliationBreakKind;
  readonly assetId: string;
  readonly plane: WalletReconciliationPlane | 'LEDGER';
  readonly expectedMinorUnits: string;
  readonly observedMinorUnits: string;
  readonly autoCorrected: false;
  readonly chainStateRewritten: false;
  readonly notes: readonly string[];
};

export type MoneyReconciliationReport = {
  readonly schema: 'sunrey.money-reconciliation.v1';
  readonly matched: boolean;
  readonly breaks: readonly MoneyReconciliationBreak[];
  readonly autoCorrected: false;
  readonly chainStateRewritten: false;
  readonly simulation: true;
};

function breakOf(input: {
  readonly kind: MoneyReconciliationBreakKind;
  readonly assetId: string;
  readonly plane: WalletReconciliationPlane | 'LEDGER';
  readonly expected: bigint;
  readonly observed: bigint;
  readonly notes: readonly string[];
}): MoneyReconciliationBreak {
  return Object.freeze({
    breakId: `mbrk_${input.kind.toLowerCase()}_${input.assetId}`,
    kind: input.kind,
    assetId: input.assetId,
    plane: input.plane,
    expectedMinorUnits: input.expected.toString(),
    observedMinorUnits: input.observed.toString(),
    autoCorrected: false,
    chainStateRewritten: false,
    notes: Object.freeze([...input.notes]),
  });
}

export function reconcileMoneySurfaces(input: {
  readonly assetId: string;
  readonly chainQuantity: bigint;
  readonly custodyQuantity: bigint;
  readonly exchangeQuantity: bigint;
  readonly customerReadModelQuantity: bigint;
  readonly ledgerQuantity?: bigint;
  readonly settlementIds?: readonly string[];
  readonly duplicateSettlementIds?: readonly string[];
}): MoneyReconciliationReport {
  const breaks: MoneyReconciliationBreak[] = [];
  const planes = reconcileDigitalAssetPlanes({
    assetId: input.assetId,
    chainQuantity: input.chainQuantity,
    custodyProviderQuantity: input.custodyQuantity,
    exchangeQuantity: input.exchangeQuantity,
    customerReadModelQuantity: input.customerReadModelQuantity,
  });
  if (!planes.matched) {
    breaks.push(
      breakOf({
        kind: 'PLANE_MISMATCH',
        assetId: input.assetId,
        plane: 'SUNREY_CHAIN_NATIVE',
        expected: input.chainQuantity,
        observed: input.customerReadModelQuantity,
        notes: planes.notes,
      }),
    );
  }
  if (input.ledgerQuantity !== undefined && input.ledgerQuantity !== input.custodyQuantity) {
    breaks.push(
      breakOf({
        kind: 'MISSING_POSTING',
        assetId: input.assetId,
        plane: 'LEDGER',
        expected: input.custodyQuantity,
        observed: input.ledgerQuantity,
        notes: ['ledger posting does not match custody read model for native asset'],
      }),
    );
  }
  if (input.settlementIds) {
    const seen = new Set<string>();
    for (const id of input.settlementIds) {
      if (seen.has(id)) {
        breaks.push(
          breakOf({
            kind: 'DUPLICATE_SETTLEMENT',
            assetId: input.assetId,
            plane: 'EXCHANGE_POSITION',
            expected: 0n,
            observed: 0n,
            notes: [`duplicate settlement id ${id}`],
          }),
        );
      }
      seen.add(id);
    }
  }
  for (const dup of input.duplicateSettlementIds ?? []) {
    breaks.push(
      breakOf({
        kind: 'DUPLICATE_SETTLEMENT',
        assetId: input.assetId,
        plane: 'EXCHANGE_POSITION',
        expected: 0n,
        observed: 0n,
        notes: [`duplicate settlement ${dup}`],
      }),
    );
  }
  return Object.freeze({
    schema: 'sunrey.money-reconciliation.v1',
    matched: breaks.length === 0,
    breaks: Object.freeze(breaks),
    autoCorrected: false,
    chainStateRewritten: false,
    simulation: true,
  });
}

export function detectProjectionMismatch(input: {
  readonly assetId: string;
  readonly canonicalChainQuantity: bigint;
  readonly projectedQuantity: bigint;
}): MoneyReconciliationBreak | null {
  if (input.canonicalChainQuantity === input.projectedQuantity) {
    return null;
  }
  return breakOf({
    kind: 'PROJECTION_MISMATCH',
    assetId: input.assetId,
    plane: 'SUNREY_CHAIN_NATIVE',
    expected: input.canonicalChainQuantity,
    observed: input.projectedQuantity,
    notes: ['wallet projection does not match canonical chain balance'],
  });
}
