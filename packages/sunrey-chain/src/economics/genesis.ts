/**
 * Genesis supply and distribution-category framework.
 *
 * Extends the Chunk 65 GenesisAssetAllocationManifest. Production
 * candidate behavior remains zero allocation unless a separately
 * approved non-zero allocation manifest exists.
 */

import {
  emptyAllocationManifest,
  rejectUnapprovedAllocation,
  totalsOf,
} from '../mainnet/allocation.ts';
import { TESTNET_MOONREY_FAUCET_ALLOCATION, TESTNET_SUNREY_FAUCET_ALLOCATION } from '../testnet/genesis.ts';
import type { GenesisAllocationLine, GenesisAssetAllocationManifest } from '../mainnet/types.ts';
import { CATEGORY_FRAMEWORK_VERSION, nativeAssetConstitution, requireKnownAsset } from './constitution.ts';
import {
  GENESIS_DISTRIBUTION_CATEGORIES,
  PRODUCTION_PARAMETER_UNCONFIGURED,
  type GenesisDistributionCategory,
  type NativeMonetaryAssetId,
} from './types.ts';

export const AUTHORIZED_POLICY_VERSIONS = [
  'sunrey.allocation.candidate.zero.v1',
  'sunrey.monetary.constitution.v1',
  'sunrey.genesis.supply.v1',
] as const;

const LEGACY_CATEGORY_MAP: Readonly<Record<string, GenesisDistributionCategory>> = Object.freeze({
  VALIDATOR_OPERATIONS: 'NETWORK_SECURITY',
  PROTOCOL_RESERVE: 'RESERVE',
  EXPLICITLY_AUTHORIZED: 'OTHER_GOVERNED_CATEGORY',
  UNALLOCATED: 'OTHER_GOVERNED_CATEGORY',
});

export function isGenesisDistributionCategory(value: string): value is GenesisDistributionCategory {
  return (GENESIS_DISTRIBUTION_CATEGORIES as readonly string[]).includes(value);
}

export function canonicalizeCategory(value: string): GenesisDistributionCategory {
  if (isGenesisDistributionCategory(value)) {
    return value;
  }
  const mapped = LEGACY_CATEGORY_MAP[value];
  if (mapped) {
    return mapped;
  }
  throw new TypeError(`unknown genesis distribution category: ${value}`);
}

export function declaredGenesisSupply(
  manifest: GenesisAssetAllocationManifest,
  assetId: NativeMonetaryAssetId,
): bigint {
  return manifest.totalByAsset[assetId];
}

export function allocationSumFor(
  manifest: GenesisAssetAllocationManifest,
  assetId: NativeMonetaryAssetId,
): bigint {
  return totalsOf(manifest.lines)[assetId];
}

export type GenesisVerification = {
  readonly ok: boolean;
  readonly checks: readonly { readonly id: string; readonly ok: boolean; readonly detail: string }[];
};

export function verifyGenesisAllocationManifest(
  manifest: GenesisAssetAllocationManifest,
  options?: {
    readonly monetaryPolicyVersion?: string;
    readonly rehearsalMigration?: boolean;
    readonly ledgerMigration?: boolean;
    readonly testnetMigration?: boolean;
  },
): GenesisVerification {
  const checks: { id: string; ok: boolean; detail: string }[] = [];
  const push = (id: string, ok: boolean, detail: string) => {
    checks.push({ id, ok, detail });
  };

  try {
    rejectUnapprovedAllocation(manifest);
    push('unapproved-allocation', true, 'zero or explicitly authorized');
  } catch (error) {
    push('unapproved-allocation', false, error instanceof Error ? error.message : 'allocation rejected');
  }

  push('hidden-premint', manifest.hiddenPremint === false, 'every non-zero unit must appear in the manifest');
  push('testnet-faucet-flag', manifest.inheritedTestnetFaucet === false, 'testnet faucet inheritance forbidden');
  push(
    'ledger-migration-flag',
    manifest.migratedApplicationLedgerBalances === false,
    'automatic Ledger migration forbidden',
  );
  push('wrapped-fiat', manifest.wrappedFiat === false, 'fiat wrap forbidden');
  push('testnet-migration', options?.testnetMigration !== true, 'testnet asset migration rejected');
  push('rehearsal-migration', options?.rehearsalMigration !== true, 'rehearsal asset migration rejected');
  push('fiat-ledger-migration', options?.ledgerMigration !== true, 'automatic fiat Ledger migration rejected');

  const policyVersion = options?.monetaryPolicyVersion ?? manifest.policyVersion;
  push(
    'policy-version',
    (AUTHORIZED_POLICY_VERSIONS as readonly string[]).includes(policyVersion),
    policyVersion,
  );

  const totals = totalsOf(manifest.lines);
  push(
    'sunrey-total',
    totals.SUNREY_COIN === manifest.totalByAsset.SUNREY_COIN,
    `${totals.SUNREY_COIN}=${manifest.totalByAsset.SUNREY_COIN}`,
  );
  push(
    'moonrey-total',
    totals.MOONREY_COIN === manifest.totalByAsset.MOONREY_COIN,
    `${totals.MOONREY_COIN}=${manifest.totalByAsset.MOONREY_COIN}`,
  );
  push(
    'testnet-sunrey-quantity',
    totals.SUNREY_COIN !== TESTNET_SUNREY_FAUCET_ALLOCATION,
    'testnet SunRey faucet quantity forbidden',
  );
  push(
    'testnet-moonrey-quantity',
    totals.MOONREY_COIN !== TESTNET_MOONREY_FAUCET_ALLOCATION,
    'testnet MoonRey faucet quantity forbidden',
  );

  const constitution = nativeAssetConstitution('PRODUCTION_CANDIDATE');
  for (const line of manifest.lines) {
    try {
      requireKnownAsset(line.asset);
      push(`asset-${line.recipientAccount}`, true, line.asset);
    } catch (error) {
      push(`asset-${line.recipientAccount}`, false, error instanceof Error ? error.message : 'wrong asset');
    }
    try {
      canonicalizeCategory(line.purposeCategory);
      push(`category-${line.recipientAccount}`, true, line.purposeCategory);
    } catch (error) {
      push(`category-${line.recipientAccount}`, false, error instanceof Error ? error.message : 'unknown category');
    }
    if (line.quantityMinorUnits > 0n && !manifest.productionAllocationAuthorized) {
      push(`nonzero-${line.recipientAccount}`, false, 'unapproved non-zero production supply');
    }
  }

  for (const asset of constitution.assets) {
    if (asset.supplyConstraints.genesisSupply === PRODUCTION_PARAMETER_UNCONFIGURED) {
      push(`${asset.assetId}-production-quantity`, !manifest.productionAllocationAuthorized, 'UNCONFIGURED');
    }
  }

  return Object.freeze({ ok: checks.every((row) => row.ok), checks: Object.freeze(checks) });
}

export function rejectHiddenOrMismatchedGenesis(manifest: GenesisAssetAllocationManifest): void {
  const report = verifyGenesisAllocationManifest(manifest);
  if (!report.ok) {
    const failed = report.checks.filter((row) => !row.ok).map((row) => row.id);
    throw new TypeError(`genesis allocation rejected: ${failed.join(',')}`);
  }
}

export function zeroProductionGenesisManifest(): GenesisAssetAllocationManifest {
  return emptyAllocationManifest();
}

export function categoryFramework() {
  return Object.freeze({
    version: CATEGORY_FRAMEWORK_VERSION,
    categories: GENESIS_DISTRIBUTION_CATEGORIES.map((category) =>
      Object.freeze({
        category,
        declared: true,
        versioned: true,
        authorized: true,
        mustAppearInSignedManifest: true,
        productionPercentage: PRODUCTION_PARAMETER_UNCONFIGURED,
      }),
    ),
  });
}

export function lineCategory(line: GenesisAllocationLine): GenesisDistributionCategory {
  return canonicalizeCategory(line.purposeCategory);
}
