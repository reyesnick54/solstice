/**
 * The Economic Asset Registry is an index / metadata fabric.
 * Canonical source domains remain authoritative for their own state.
 */
export const REGISTRY_IS_SOURCE_OF_TRUTH = false as const;

export const SOURCE_OF_TRUTH_BOUNDARY = Object.freeze({
  registryIsSourceOfTruth: false,
  consentStatus: false,
  hinPermissionStatus: false,
  contributionVerification: false,
  oracleFactValidity: false,
  productiveClaimValidity: false,
  nativeAssetSupply: false,
  automaticIssuance: false,
});

export const FABRIC_PRIVACY_BOUNDARY = Object.freeze({
  rawPersonalData: false,
  rawPdvData: false,
  cleanRoomRows: false,
  legalIdentity: false,
  apiSecrets: false,
  oauthSecrets: false,
  privateKeys: false,
  factoryCredentials: false,
  industrialRawPayloads: false,
  credentialsExposed: false,
});

export const FABRIC_AUTHORITY_BOUNDARY = Object.freeze({
  automaticIssuance: false,
  automaticSunReyMint: false,
  automaticMoonReyMint: false,
  registryCanChangeSourceVerification: false,
  registryCanMintEitherCoin: false,
  nativeSupplyOwnedByRegistry: false,
});

export const FABRIC_DIRECTION = Object.freeze({
  canonical: 'Canonical Source Domain → privacy-safe metadata adapter → EconomicAssetRegistryPort → master descriptor',
  forbidden: 'Economic Asset Registry → reimplement all source domains',
});
