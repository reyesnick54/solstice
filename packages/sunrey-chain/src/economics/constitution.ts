/**
 * Machine-readable NativeAssetConstitution and MonetaryPolicyRegistry.
 *
 * PRODUCTION_CANDIDATE does not activate production. Maximum supplies
 * and allocation percentages remain UNCONFIGURED.
 */

import {
  ASSET_PURPOSES,
  BURN_CLASSES,
  ENGINEERING_SIMULATION,
  GENESIS_DISTRIBUTION_CATEGORIES,
  MONETARY_CONSTITUTION_SCHEMA_VERSION,
  MONETARY_CONSTITUTION_TOOL_VERSION,
  MONETARY_POLICY_VERSION_ID,
  MOONREY_ISSUANCE_CLASSES,
  PRODUCTION_PARAMETER_UNCONFIGURED,
  SUNREY_ISSUANCE_CLASSES,
  TICKER_STATUS_NOT_ASSIGNED,
  type GenesisSupplyPolicy,
  type IssuancePolicy,
  type MonetaryPolicyHistoryRecord,
  type MonetaryPolicyRegistry,
  type MonetaryPolicyVersion,
  type NativeAssetConstitution,
  type NativeAssetMonetaryPolicy,
  type NativeMonetaryAssetId,
} from './types.ts';

export const GOVERNANCE_REFERENCE = 'gov.native.monetary.constitution.v1' as const;
export const HISTORICAL_POLICY_REFERENCE = 'sunrey.monetary.constitution.v1.history' as const;
export const CATEGORY_FRAMEWORK_VERSION = 'sunrey.genesis.distribution.category.v1' as const;

export function genesisSupplyPolicy(): GenesisSupplyPolicy {
  return Object.freeze({
    policyVersion: 'sunrey.genesis.supply.v1',
    productionAllocationAuthorized: false,
    defaultGenesisQuantity: 0n,
    zeroUnlessApprovedManifest: true,
    testnetMigrationForbidden: true,
    rehearsalMigrationForbidden: true,
    faucetMigrationForbidden: true,
    automaticLedgerMigrationForbidden: true,
    hiddenPremintForbidden: true,
    categories: GENESIS_DISTRIBUTION_CATEGORIES,
  });
}

export function sunreyIssuancePolicy(): IssuancePolicy {
  return Object.freeze({
    policyVersion: 'sunrey.issuance.sunrey_coin.constitution.v1',
    permittedClasses: SUNREY_ISSUANCE_CLASSES,
    productionActivation: PRODUCTION_PARAMETER_UNCONFIGURED,
    unrestrictedMintForbidden: true,
    aiAuthorizationForbidden: true,
    oracleObservationCannotMint: true,
    verifiedFactAloneCannotMint: true,
    pdvConsentCleanRoomCannotMint: true,
  });
}

export function moonreyIssuancePolicy(): IssuancePolicy {
  return Object.freeze({
    policyVersion: 'sunrey.issuance.moonrey_coin.constitution.v1',
    permittedClasses: MOONREY_ISSUANCE_CLASSES,
    productionActivation: PRODUCTION_PARAMETER_UNCONFIGURED,
    unrestrictedMintForbidden: true,
    aiAuthorizationForbidden: true,
    oracleObservationCannotMint: true,
    verifiedFactAloneCannotMint: true,
    pdvConsentCleanRoomCannotMint: true,
  });
}

export function currentPolicyVersion(
  state: MonetaryPolicyVersion['state'] = 'DEVELOPMENT_ACTIVE',
): MonetaryPolicyVersion {
  return Object.freeze({
    versionId: MONETARY_POLICY_VERSION_ID,
    schemaVersion: MONETARY_CONSTITUTION_SCHEMA_VERSION,
    state,
    activationHeight: 0n,
    supersededBy: null,
    historicalPolicyReference: HISTORICAL_POLICY_REFERENCE,
    governanceReference: GOVERNANCE_REFERENCE,
  });
}

export function productionCandidatePolicyVersion(): MonetaryPolicyVersion {
  return Object.freeze({
    ...currentPolicyVersion('PRODUCTION_CANDIDATE'),
    activationHeight: PRODUCTION_PARAMETER_UNCONFIGURED,
  });
}

function assetPolicy(
  assetId: NativeMonetaryAssetId,
  version: MonetaryPolicyVersion,
): NativeAssetMonetaryPolicy {
  const sunrey = assetId === 'SUNREY_COIN';
  return Object.freeze({
    assetId,
    assetPurpose: ASSET_PURPOSES[assetId],
    displayName: sunrey ? 'SunRey Coin' : 'MoonRey Coin',
    precision: 6,
    tickerStatus: TICKER_STATUS_NOT_ASSIGNED,
    policyVersion: version,
    policyState: version.state,
    genesisPolicy: genesisSupplyPolicy(),
    issuancePolicy: sunrey ? sunreyIssuancePolicy() : moonreyIssuancePolicy(),
    burnPolicy: Object.freeze({
      policyVersion: sunrey ? 'sunrey.burn.sunrey_coin.v1' : 'sunrey.burn.moonrey_coin.v1',
      permittedClasses: BURN_CLASSES,
      validatorMisconductCannotBurnCustomerAssets: true,
      onlyImplementedAuthorizedClassesActive: true,
    }),
    permittedIssuanceClasses: sunrey ? SUNREY_ISSUANCE_CLASSES : MOONREY_ISSUANCE_CLASSES,
    permittedBurnClasses: BURN_CLASSES,
    feeEligibility: sunrey ? 'ELIGIBLE' : 'POLICY_DISABLED',
    governanceAuthority: 'SUNREY_PROTOCOL_GOVERNANCE',
    supplyConstraints: Object.freeze({
      maximumSupply: PRODUCTION_PARAMETER_UNCONFIGURED,
      genesisSupply: version.state === 'PRODUCTION_CANDIDATE' ? PRODUCTION_PARAMETER_UNCONFIGURED : 0n,
      postGenesisIssuanceEnabled: version.state === 'DEVELOPMENT_ACTIVE' || version.state === 'TESTNET_ACTIVE',
      productionIssuanceActivated: false,
    }),
    policyActivationHeight: version.activationHeight,
    historicalPolicyReference: version.historicalPolicyReference,
  });
}

export function nativeAssetConstitution(
  state: MonetaryPolicyVersion['state'] = 'DEVELOPMENT_ACTIVE',
): NativeAssetConstitution {
  const version =
    state === 'PRODUCTION_CANDIDATE' ? productionCandidatePolicyVersion() : currentPolicyVersion(state);
  return Object.freeze({
    schemaVersion: MONETARY_CONSTITUTION_SCHEMA_VERSION,
    constitutionId: 'sunrey.native-asset-constitution.v1',
    toolVersion: MONETARY_CONSTITUTION_TOOL_VERSION,
    tickerStatus: TICKER_STATUS_NOT_ASSIGNED,
    productionMainnetUnavailable: true,
    productionEconomicActivationUnavailable: true,
    assets: Object.freeze([assetPolicy('SUNREY_COIN', version), assetPolicy('MOONREY_COIN', version)]),
  });
}

export function policyFor(
  constitution: NativeAssetConstitution,
  assetId: NativeMonetaryAssetId,
): NativeAssetMonetaryPolicy {
  const found = constitution.assets.find((row) => row.assetId === assetId);
  if (!found) {
    throw new TypeError(`invented asset rejected: ${assetId}`);
  }
  return found;
}

export function requireKnownAsset(assetId: string): NativeMonetaryAssetId {
  if (assetId === 'SUNREY_COIN' || assetId === 'MOONREY_COIN') {
    return assetId;
  }
  throw new TypeError(`invented asset rejected: ${assetId}`);
}

export function monetaryPolicyRegistry(
  state: MonetaryPolicyVersion['state'] = 'DEVELOPMENT_ACTIVE',
): MonetaryPolicyRegistry {
  const constitution = nativeAssetConstitution(state);
  const version = constitution.assets[0]!.policyVersion;
  const history: readonly MonetaryPolicyHistoryRecord[] = Object.freeze([
    Object.freeze({
      versionId: version.versionId,
      state: version.state,
      recordedAtHeight: 0n,
      governanceReference: GOVERNANCE_REFERENCE,
      changeClass: 'GENESIS_POLICY',
      note: `${ENGINEERING_SIMULATION}: initial dual-asset constitution. Production quantities UNCONFIGURED.`,
    }),
  ]);
  return Object.freeze({
    schemaVersion: MONETARY_CONSTITUTION_SCHEMA_VERSION,
    owner: 'packages/sunrey-chain',
    activeVersionId: version.versionId,
    versions: Object.freeze([version]),
    constitution,
    history,
  });
}

export function policyActiveAt(
  registry: MonetaryPolicyRegistry,
  height: bigint,
): MonetaryPolicyVersion {
  const historical = [...registry.history]
    .filter((row) => row.recordedAtHeight <= height)
    .sort((a, b) => (a.recordedAtHeight < b.recordedAtHeight ? 1 : -1))[0];
  const match = registry.versions.find((row) => row.versionId === (historical?.versionId ?? registry.activeVersionId));
  if (!match) {
    throw new TypeError('unauthorized policy version');
  }
  return match;
}
