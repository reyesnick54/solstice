import type {
  ExplorerAccountClass,
  ExposureClass,
  FinalityStatus,
  IndexedEntityKind,
  NativeAssetId,
  NetworkClass,
  TransactionStatus,
} from './taxonomy.ts';

export type QuantityString = string;

export type ExplorerCursor = string;

export type IndexCheckpoint = {
  readonly lastIndexedFinalizedHeight: number;
  readonly blockId: string;
  readonly stateRoot: string;
  readonly indexerSchemaVersion: number;
};

export type ExplorerLag = {
  readonly indexed_finalized_height: number;
  readonly chain_finalized_height: number;
  readonly index_lag: number;
};

export type CommitCertificateSummary = {
  readonly height: number;
  readonly round: number;
  readonly proposer: string;
  readonly prevoteCount: number;
  readonly precommitCount: number;
  readonly signedVotingPower: QuantityString;
  readonly totalPower: QuantityString;
  readonly certificateId: string;
};

export type IndexedBlock = {
  readonly height: number;
  readonly blockId: string;
  readonly parentId: string;
  readonly timestampUnixSeconds: number;
  readonly proposer: string;
  readonly validatorSetHash: string;
  readonly protocolVersion: string;
  readonly transactionCount: number;
  readonly resourceUsage: QuantityString;
  readonly feeTotal: QuantityString;
  readonly feeAsset: NativeAssetId;
  readonly feePolicyVersion?: QuantityString;
  readonly baseResourcePrice?: QuantityString;
  readonly targetUtilizationBps?: QuantityString;
  readonly feeDisposition?: string;
  readonly stateRoot: string;
  readonly commit: CommitCertificateSummary;
  readonly finalityStatus: FinalityStatus;
};

export type IndexedTransaction = {
  readonly transactionId: string;
  readonly type: string;
  readonly actor: string;
  readonly addressRefs: readonly string[];
  readonly status: TransactionStatus;
  readonly height: number;
  readonly blockId: string;
  readonly resourceUsage: QuantityString;
  readonly fee: QuantityString;
  readonly feeAsset: NativeAssetId;
  readonly chargedFee?: QuantityString;
  readonly feeDisposition?: string;
  readonly feePolicyVersion?: QuantityString;
  readonly cryptoSuite: string;
  readonly assetQuantities: Readonly<Record<string, QuantityString>>;
  readonly economicObjectRefs: readonly string[];
  readonly finalizedResult: string;
  readonly rejectionCode: string | null;
};

export type IndexedLock = {
  readonly lockId: string;
  readonly assetId: NativeAssetId;
  readonly quantity: QuantityString;
  readonly purpose: string;
};

export type IndexedAccount = {
  readonly address: string;
  readonly accountClass: ExplorerAccountClass;
  readonly nonce: QuantityString;
  readonly holdings: Readonly<Record<NativeAssetId, QuantityString>>;
  readonly locks: readonly IndexedLock[];
  readonly authorizationPolicy: string;
  readonly machineAccount: boolean;
  readonly notABankAccount: true;
};

export type IndexedAsset = {
  readonly assetId: NativeAssetId;
  readonly internalAssetId: string;
  readonly displayName: string;
  readonly precision: number;
  readonly publicTickerStatus: 'NOT_ASSIGNED';
  readonly networkClass: NetworkClass;
  readonly supplyLabel: 'DEVELOPMENT_TESTNET_SUPPLY';
  readonly issued: QuantityString;
  readonly burned: QuantityString;
  readonly locked: QuantityString;
  readonly circulating: QuantityString;
  readonly issuancePolicy: string;
  readonly notMarketCapitalization: true;
  readonly policyVersion: string;
  readonly genesisAllocationTotal: QuantityString;
  readonly authorizedIssuanceTotal: QuantityString;
  readonly escrowed: QuantityString;
  readonly supplyReconciliation: 'EXACT' | 'MISMATCH';
  readonly moonreyIssuanceCategorySummary?: Readonly<Record<string, QuantityString>>;
  readonly networkEnvironmentLabel: 'DEVELOPMENT' | 'TESTNET' | 'REHEARSAL';
};

export type IndexedMoonReyIssuance = {
  readonly issuanceId: string;
  readonly receiptId: string;
  readonly productiveCategory: string;
  readonly contributionId: string;
  readonly productiveObjectId: string;
  readonly oracleFactRefs: readonly string[];
  readonly formulaVersion: string;
  readonly formulaInputs: Readonly<Record<string, QuantityString>>;
  readonly rounding: string;
  readonly issuedQuantity: QuantityString;
  readonly height: number;
  readonly recipient: string;
  readonly normalizationPolicy?: string;
  readonly policyVersion?: number;
  readonly epoch?: number;
  readonly antiDoubleCountFingerprint?: string;
  readonly supplySummary?: {
    readonly issued: QuantityString;
    readonly locked: QuantityString;
    readonly circulating: QuantityString;
  };
};

export type IndexedProductiveObject = {
  readonly objectId: string;
  readonly category: string;
  readonly status: string;
  readonly claimType: string;
  readonly lineage: readonly string[];
  readonly geographicAggregate: string | null;
};

export type IndexedContribution = {
  readonly contributionId: string;
  readonly objectId: string;
  readonly category: string;
  readonly claimType: string;
  readonly status: string;
  readonly quantity: QuantityString;
  readonly unit: string;
};

export type IndexedOracleProvider = {
  readonly providerId: string;
  readonly status: string;
  readonly oracleType: string;
};

export type IndexedOracleFeed = {
  readonly feedId: string;
  readonly providerId: string;
  readonly factType: string;
  readonly status: string;
  readonly providerCount: number;
  readonly aggregationMethod: string;
  readonly freshness: string;
  readonly qualityClass: string;
  readonly verifiedFact: string | null;
};

export type IndexedOracleFact = {
  readonly factId: string;
  readonly feedId: string;
  readonly factType: string;
  readonly sourceCount: number;
  readonly aggregationMethod: string;
  readonly quality: string;
  readonly staleness: string;
  readonly conflictState: string;
  readonly artifactKind: 'PROTOCOL_VERIFIED_DATA_ARTIFACT';
};

export type IndexedValidator = {
  readonly validatorId: string;
  readonly consensusKeyDescriptor: string;
  readonly votingPower: QuantityString;
  readonly status: string;
  readonly epoch: number;
  readonly operatorMetadata: string | null;
  readonly blocksProposed: number;
  readonly votes: number;
  readonly missed: number;
  readonly jailStatus: string | null;
  readonly tombstone: boolean;
  readonly bondState?: string;
  readonly bondAsset?: string;
  readonly policyVersion?: number;
  readonly publicRewardSummary?: { readonly paid: QuantityString; readonly pending: QuantityString };
  readonly unbondStatus?: { readonly pending: QuantityString; readonly releaseEpoch: string | null };
};

export type IndexedEvidence = {
  readonly evidenceId: string;
  readonly kind: 'DOUBLE_PROPOSAL' | 'DOUBLE_PREVOTE' | 'DOUBLE_PRECOMMIT';
  readonly validatorId: string;
  readonly height: number;
  readonly round: number;
  readonly result: string;
  readonly policyVersion: string;
  readonly futureValidatorStatus: string;
};

export type IndexedGovernance = {
  readonly proposalId: string;
  readonly proposalHash: string;
  readonly upgradeKind: string;
  readonly votesApprove: QuantityString;
  readonly votesReject: QuantityString;
  readonly votingPower: QuantityString;
  readonly requiredThreshold: string;
  readonly activationHeight: number;
  readonly status: string;
  readonly moduleHashes: readonly string[];
  readonly protocolVersion: string;
  readonly activationResult: string | null;
  readonly policyDiffHash?: string;
  readonly activeVersion?: string;
  readonly emergencyRestrictionClass?: string;
  readonly restrictionState?: string;
};

export type IndexedInteropClient = {
  readonly clientId: string;
  readonly externalChainId: string;
  readonly verifiedHeight: number;
  readonly status: string;
  readonly securityProfile: string;
  readonly developmentOnly: true;
};

export type IndexedInteropPacket = {
  readonly packetId: string;
  readonly connectionId: string;
  readonly channelId: string;
  readonly lifecycle: string;
  readonly acknowledgement: string | null;
  readonly timeoutHeight: number | null;
  readonly developmentOnly: true;
};

export type IndexedMachine = {
  readonly machineId: string;
  readonly machineType: string;
  readonly serviceOffer: string;
  readonly resourceCategory: string;
  readonly settledQuantity: QuantityString;
  readonly deliveryProofRef: string | null;
};

export type IndexedSettlement = {
  readonly settlementId: string;
  readonly marketFamily: string;
  readonly instrument: string;
  readonly transactionId: string;
  readonly assetLegs: Readonly<Record<string, QuantityString>>;
  readonly finalizedHeight: number;
};

export type SearchHit = {
  readonly kind: IndexedEntityKind;
  readonly id: string;
  readonly label: string;
};

export type FieldExposure = {
  readonly path: string;
  readonly classification: ExposureClass;
};

export type ExplorerHome = {
  readonly productName: string;
  readonly productBrand: string;
  readonly networkClass: NetworkClass;
  readonly networkLabel: string;
  readonly latestFinalizedHeight: number;
  readonly latestBlock: IndexedBlock | null;
  readonly transactionActivity: number;
  readonly validatorCount: number;
  readonly activeProtocolVersion: string;
  readonly sunreyDevelopmentSupply: QuantityString;
  readonly moonreyDevelopmentSupply: QuantityString;
  readonly productiveContributionCount: number;
  readonly latestOracleFacts: readonly IndexedOracleFact[];
  readonly interopClientCount: number;
  readonly supplyIsNotMarketCap: true;
};

export type CanonicalProjection = {
  readonly schemaVersion: number;
  readonly checkpoint: IndexCheckpoint;
  readonly blocks: readonly IndexedBlock[];
  readonly transactions: readonly IndexedTransaction[];
  readonly accounts: readonly IndexedAccount[];
  readonly assets: readonly IndexedAsset[];
  readonly moonrey: readonly IndexedMoonReyIssuance[];
  readonly productiveObjects: readonly IndexedProductiveObject[];
  readonly contributions: readonly IndexedContribution[];
  readonly oracleProviders: readonly IndexedOracleProvider[];
  readonly oracleFeeds: readonly IndexedOracleFeed[];
  readonly oracleFacts: readonly IndexedOracleFact[];
  readonly validators: readonly IndexedValidator[];
  readonly evidence: readonly IndexedEvidence[];
  readonly governance: readonly IndexedGovernance[];
  readonly interopClients: readonly IndexedInteropClient[];
  readonly interopPackets: readonly IndexedInteropPacket[];
  readonly machines: readonly IndexedMachine[];
  readonly settlements: readonly IndexedSettlement[];
};
