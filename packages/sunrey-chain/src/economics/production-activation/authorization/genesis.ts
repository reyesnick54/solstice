import { allocationManifestHash, emptyAllocationManifest } from '../../../mainnet/allocation.ts';
import type { GenesisAssetAllocationManifest } from '../../../mainnet/types.ts';

import type { AuthorizationBlockerCode, GenesisAuthorizationBinding } from './types.ts';

export type GenesisInvariantInput = {
  readonly productionAllocationAuthorized?: boolean;
  readonly hiddenPremint?: boolean;
  readonly inheritedTestnetFaucet?: boolean;
  readonly migratedApplicationLedgerBalances?: boolean;
  readonly wrappedFiat?: boolean;
  readonly separatelyApproved?: boolean;
  readonly manifest?: GenesisAssetAllocationManifest;
};

export function bindGenesisAuthorization(input: GenesisInvariantInput = {}): {
  readonly binding: GenesisAuthorizationBinding;
  readonly blockers: readonly AuthorizationBlockerCode[];
} {
  const manifest = input.manifest ?? emptyAllocationManifest();
  const blockers: AuthorizationBlockerCode[] = [];
  if (input.hiddenPremint === true) {
    blockers.push('HIDDEN_PREMINT_FORBIDDEN');
  }
  if (input.inheritedTestnetFaucet === true) {
    blockers.push('TESTNET_FAUCET_MIGRATION_FORBIDDEN');
  }
  if (input.migratedApplicationLedgerBalances === true) {
    blockers.push('APPLICATION_LEDGER_MIGRATION_FORBIDDEN');
  }
  if (input.wrappedFiat === true) {
    blockers.push('WRAPPED_FIAT_FORBIDDEN');
  }
  const authorized = input.productionAllocationAuthorized === true && input.separatelyApproved === true;
  if (!authorized) {
    blockers.push('GENESIS_ALLOCATION_UNAUTHORIZED');
  }
  return {
    binding: Object.freeze({
      manifestHash: allocationManifestHash(manifest),
      productionAllocationAuthorized: authorized,
      hiddenPremint: false,
      inheritedTestnetFaucet: false,
      migratedApplicationLedgerBalances: false,
      wrappedFiat: false,
      separatelyApproved: input.separatelyApproved === true,
    }),
    blockers: Object.freeze(blockers),
  };
}

export function currentUnauthorizedGenesis(): GenesisAuthorizationBinding {
  return bindGenesisAuthorization().binding;
}
