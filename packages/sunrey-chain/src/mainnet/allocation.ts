/**
 * GenesisAssetAllocationManifest.
 *
 * Do not invent production token allocation. If no externally approved
 * production allocation exists, use an empty/zero-allocation candidate.
 * Never copy testnet faucet supply. Never migrate application Ledger
 * balances or wrap fiat.
 */

import { encodeString, encodeU32, encodeU64, encodeBool, sha256Hex } from '../validators/canonical.ts';
import { TESTNET_MOONREY_FAUCET_ALLOCATION, TESTNET_SUNREY_FAUCET_ALLOCATION } from '../testnet/genesis.ts';
import type {
  GenesisAllocationLine,
  GenesisAssetAllocationManifest,
  MainnetAuthorizationRecord,
} from './types.ts';

export const ALLOCATION_DOMAIN = 'SUNREY_GENESIS_ALLOCATION_V1' as const;
export const ALLOCATION_POLICY_VERSION = 'sunrey.allocation.candidate.zero.v1' as const;

export function emptyAllocationManifest(
  approvals: readonly MainnetAuthorizationRecord[] = [],
): GenesisAssetAllocationManifest {
  return Object.freeze({
    schemaVersion: 1,
    policyVersion: ALLOCATION_POLICY_VERSION,
    productionAllocationAuthorized: false,
    inheritedTestnetFaucet: false,
    migratedApplicationLedgerBalances: false,
    wrappedFiat: false,
    hiddenPremint: false,
    lines: Object.freeze([]),
    totalByAsset: Object.freeze({ SUNREY_COIN: 0n, MOONREY_COIN: 0n }),
    approvals: Object.freeze([...approvals]),
    notes: 'Production allocation has not been authorized. Zero-allocation candidate only.',
  });
}

export function totalsOf(lines: readonly GenesisAllocationLine[]): {
  readonly SUNREY_COIN: bigint;
  readonly MOONREY_COIN: bigint;
} {
  let sunrey = 0n;
  let moonrey = 0n;
  for (const line of lines) {
    if (line.asset === 'SUNREY_COIN') {
      sunrey += line.quantityMinorUnits;
    } else {
      moonrey += line.quantityMinorUnits;
    }
  }
  return Object.freeze({ SUNREY_COIN: sunrey, MOONREY_COIN: moonrey });
}

export function rejectUnapprovedAllocation(manifest: GenesisAssetAllocationManifest): void {
  const totals = totalsOf(manifest.lines);
  if (manifest.inheritedTestnetFaucet) {
    throw new TypeError('testnet faucet supply must not be copied into production');
  }
  if (manifest.migratedApplicationLedgerBalances) {
    throw new TypeError('application Ledger balances must not migrate automatically');
  }
  if (manifest.wrappedFiat) {
    throw new TypeError('genesis cannot wrap or migrate fiat balances');
  }
  if (manifest.hiddenPremint) {
    throw new TypeError('hidden premint is forbidden');
  }
  if (
    totals.SUNREY_COIN === TESTNET_SUNREY_FAUCET_ALLOCATION ||
    totals.MOONREY_COIN === TESTNET_MOONREY_FAUCET_ALLOCATION
  ) {
    throw new TypeError('testnet faucet quantities are forbidden in a production candidate');
  }
  if (!manifest.productionAllocationAuthorized && (totals.SUNREY_COIN > 0n || totals.MOONREY_COIN > 0n)) {
    throw new TypeError('unapproved token allocation rejected');
  }
  if (manifest.productionAllocationAuthorized) {
    const human = manifest.approvals.filter((row) => row.accepted && row.actorKind === 'HUMAN');
    if (human.length === 0) {
      throw new TypeError('authorized allocation requires human approvals');
    }
  }
}

export function encodeAllocationManifest(manifest: GenesisAssetAllocationManifest): Buffer {
  rejectUnapprovedAllocation(manifest);
  const lines = [...manifest.lines].sort((a, b) => {
    const asset = a.asset.localeCompare(b.asset);
    return asset !== 0 ? asset : a.recipientAccount.localeCompare(b.recipientAccount);
  });
  const parts = [
    encodeString(ALLOCATION_DOMAIN),
    encodeString(manifest.policyVersion),
    encodeBool(manifest.productionAllocationAuthorized),
    encodeU32(lines.length),
  ];
  for (const line of lines) {
    parts.push(
      encodeString(line.asset),
      encodeString(line.recipientAccount),
      encodeU64(line.quantityMinorUnits),
      encodeString(line.purposeCategory),
      encodeString(line.authorizationEvidence ?? ''),
    );
  }
  parts.push(encodeU64(manifest.totalByAsset.SUNREY_COIN), encodeU64(manifest.totalByAsset.MOONREY_COIN));
  return Buffer.concat(parts);
}

export function allocationManifestHash(manifest: GenesisAssetAllocationManifest): string {
  return sha256Hex(encodeAllocationManifest(manifest));
}
