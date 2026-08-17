import { InMemoryFinalizedChain, type FinalizedChainSnapshot } from './chain-reader.ts';
import {
  NATIVE_ASSET_DISPLAY_NAMES,
  NATIVE_ASSET_INTERNAL_IDS,
  NATIVE_ASSET_PRECISION,
  PUBLIC_TICKER_STATUS,
} from './taxonomy.ts';
import type {
  IndexedAccount,
  IndexedAsset,
  IndexedBlock,
  IndexedTransaction,
} from './types.ts';

export function developmentChainFixture(blockCount = 4): InMemoryFinalizedChain {
  return new InMemoryFinalizedChain(developmentSnapshot(blockCount));
}

export function developmentSnapshot(blockCount = 4): FinalizedChainSnapshot {
  const blocks: IndexedBlock[] = [];
  const transactions: IndexedTransaction[] = [];
  for (let height = 0; height < blockCount; height += 1) {
    const block = makeBlock(height, height === 0 ? 'genesis' : blockId(height - 1));
    blocks.push(block);
    if (height > 0) {
      transactions.push(makeTx(height, block.blockId, height === 1 ? 'NATIVE_TRANSFER' : 'SYSTEM_NOTE'));
    }
  }
  const last = blocks[blocks.length - 1]!;
  return {
    finalizedHeight: last.height,
    protocolVersion: last.protocolVersion,
    blocks,
    transactions,
    accounts: [faucetAccount(), machineAccount()],
    assets: [asset('SUNREY_COIN', '1000000', '1000', '5000'), asset('MOONREY_COIN', '250', '0', '10')],
    moonrey: [
      {
        issuanceId: 'iss_moonrey_1',
        receiptId: 'rcpt_moonrey_1',
        productiveCategory: 'ENERGY',
        contributionId: 'contrib_energy_1',
        productiveObjectId: 'obj_solar_1',
        oracleFactRefs: ['fact_energy_1'],
        formulaVersion: 'moonrey.issuance.formula.v1',
        formulaInputs: { eligibleQuantity: '100', categoryWeight: '1000000', qualityFactor: '1000000' },
        rounding: 'FLOOR',
        issuedQuantity: '100',
        height: 2,
        recipient: 'sr1qfaucet000000000000000000000000001',
        normalizationPolicy: 'norm.ENERGY.kWh.v1',
        policyVersion: 1,
        epoch: 0,
        antiDoubleCountFingerprint: 'fp_energy_1',
        supplySummary: { issued: '250', locked: '10', circulating: '240' },
      },
    ],
    productiveObjects: [
      {
        objectId: 'obj_solar_1',
        category: 'ENERGY',
        status: 'ACTIVE',
        claimType: 'OUTPUT',
        lineage: ['obj_solar_1'],
        geographicAggregate: 'REGION_SIM_1',
      },
    ],
    contributions: [
      {
        contributionId: 'contrib_energy_1',
        objectId: 'obj_solar_1',
        category: 'ENERGY',
        claimType: 'OUTPUT',
        status: 'ISSUED',
        quantity: '100',
        unit: 'kWh',
      },
    ],
    oracleProviders: [{ providerId: 'oracle_dev_1', status: 'ACTIVE', oracleType: 'PUBLIC_DATA_PROVIDER' }],
    oracleFeeds: [
      {
        feedId: 'feed_energy_1',
        providerId: 'oracle_dev_1',
        factType: 'ENERGY_PRODUCTION',
        status: 'ACTIVE',
        providerCount: 3,
        aggregationMethod: 'MEDIAN',
        freshness: 'FRESH',
        qualityClass: 'ENGINEERING',
        verifiedFact: 'fact_energy_1',
      },
    ],
    oracleFacts: [
      {
        factId: 'fact_energy_1',
        feedId: 'feed_energy_1',
        factType: 'ENERGY_PRODUCTION',
        sourceCount: 3,
        aggregationMethod: 'MEDIAN',
        quality: 'VERIFIED',
        staleness: 'FRESH',
        conflictState: 'NONE',
        artifactKind: 'PROTOCOL_VERIFIED_DATA_ARTIFACT',
      },
    ],
    validators: [
      {
        validatorId: 'val_dev_1',
        consensusKeyDescriptor: 'ed25519:cons_dev_1',
        votingPower: '100',
        status: 'ACTIVE',
        epoch: 1,
        operatorMetadata: 'development-operator-1',
        blocksProposed: 2,
        votes: 8,
        missed: 0,
        jailStatus: null,
        tombstone: false,
        bondState: 'BONDED',
        bondAsset: 'DEVELOPMENT_SUNREY_COIN',
        policyVersion: 1,
        publicRewardSummary: { paid: '0', pending: '0' },
        unbondStatus: { pending: '0', releaseEpoch: null },
      },
      {
        validatorId: 'val_dev_2',
        consensusKeyDescriptor: 'ed25519:cons_dev_2',
        votingPower: '100',
        status: 'ACTIVE',
        epoch: 1,
        operatorMetadata: 'development-operator-2',
        blocksProposed: 1,
        votes: 8,
        missed: 0,
        jailStatus: null,
        tombstone: false,
        bondState: 'BONDED',
        bondAsset: 'DEVELOPMENT_SUNREY_COIN',
        policyVersion: 1,
        publicRewardSummary: { paid: '0', pending: '0' },
        unbondStatus: { pending: '0', releaseEpoch: null },
      },
    ],
    evidence: [
      {
        evidenceId: 'ev_double_prevote_1',
        kind: 'DOUBLE_PREVOTE',
        validatorId: 'val_dev_jailed',
        height: 2,
        round: 1,
        result: 'JAILED',
        policyVersion: 'accountability.v1',
        futureValidatorStatus: 'JAILED',
      },
    ],
    governance: [
      {
        proposalId: 'gov_upgrade_1',
        proposalHash: 'govhash_upgrade_1',
        upgradeKind: 'PARAMETER_CHANGE',
        votesApprove: '300',
        votesReject: '0',
        votingPower: '400',
        requiredThreshold: 'VALIDATOR_SUPERMAJORITY',
        activationHeight: 3,
        status: 'ACTIVATED',
        moduleHashes: ['mod_fees_v1'],
        protocolVersion: 'sunrey-protocol-0',
        activationResult: 'ACTIVATED',
        policyDiffHash: 'diff_fee_dev_1',
        activeVersion: '3',
        emergencyRestrictionClass: 'SUSPEND_ORACLE_PROVIDER',
        restrictionState: 'INACTIVE',
      },
    ],
    interopClients: [
      {
        clientId: 'client_ext_dev_1',
        externalChainId: 'chn_external_dev_bft',
        verifiedHeight: 12,
        status: 'ACTIVE',
        securityProfile: 'SIMULATED_DETERMINISTIC_BFT_EXTERNAL_CHAIN',
        developmentOnly: true,
      },
    ],
    interopPackets: [
      {
        packetId: 'pkt_dev_1',
        connectionId: 'conn_dev_1',
        channelId: 'chan_attestation_1',
        lifecycle: 'ACKNOWLEDGED',
        acknowledgement: 'ack_dev_1',
        timeoutHeight: null,
        developmentOnly: true,
      },
    ],
    machines: [
      {
        machineId: 'mach_compute_1',
        machineType: 'COMPUTE_WORKER',
        serviceOffer: 'inference-batch',
        resourceCategory: 'AI_COMPUTE',
        settledQuantity: '40',
        deliveryProofRef: 'proof_delivery_1',
      },
    ],
    settlements: [
      {
        settlementId: 'setl_dev_1',
        marketFamily: 'DIGITAL_ASSETS',
        instrument: 'SUNREY_COIN/MOONREY_COIN',
        transactionId: 'tx_h1_1',
        assetLegs: { SUNREY_COIN: '10', MOONREY_COIN: '2' },
        finalizedHeight: 1,
      },
    ],
  };
}

export function makeBlock(height: number, parentId: string): IndexedBlock {
  return {
    height,
    blockId: blockId(height),
    parentId,
    timestampUnixSeconds: 1_700_000_000 + height * 5,
    proposer: height % 2 === 0 ? 'val_dev_1' : 'val_dev_2',
    validatorSetHash: 'valset_dev_1',
    protocolVersion: 'sunrey-protocol-0',
    transactionCount: height === 0 ? 0 : 1,
    resourceUsage: height === 0 ? '0' : '12',
    feeTotal: height === 0 ? '0' : '1',
    feeAsset: 'SUNREY_COIN',
    feePolicyVersion: '2',
    baseResourcePrice: '100',
    targetUtilizationBps: '5000',
    feeDisposition: 'VALIDATOR_REWARD+BURN+PROTOCOL_TREASURY',
    stateRoot: `state_${height}`,
    commit: {
      height,
      round: 0,
      proposer: height % 2 === 0 ? 'val_dev_1' : 'val_dev_2',
      prevoteCount: 4,
      precommitCount: 4,
      signedVotingPower: '400',
      totalPower: '400',
      certificateId: `commit_${height}`,
    },
    finalityStatus: 'FINALIZED',
  };
}

export function makeTx(height: number, block: string, type: string): IndexedTransaction {
  return {
    transactionId: `tx_h${height}_1`,
    type,
    actor: 'sr1qfaucet000000000000000000000000001',
    addressRefs: ['sr1quser0000000000000000000000000002'],
    status: 'FINALIZED',
    height,
    blockId: block,
    resourceUsage: '12',
    fee: '1',
    feeAsset: 'SUNREY_COIN',
    chargedFee: '1',
    feeDisposition: 'VALIDATOR_REWARD+BURN+PROTOCOL_TREASURY',
    feePolicyVersion: '2',
    cryptoSuite: 'SUNREY_ED25519_V1',
    assetQuantities: type === 'NATIVE_TRANSFER' ? { SUNREY_COIN: '25' } : {},
    economicObjectRefs: type === 'NATIVE_TRANSFER' ? ['sunrey.asset.sunrey_coin'] : [],
    finalizedResult: 'APPLIED',
    rejectionCode: null,
  };
}

export function nextBlock(chain: InMemoryFinalizedChain): IndexedBlock {
  const height = chain.height() + 1;
  const parent = chain.blockAt(chain.height());
  return makeBlock(height, parent?.blockId ?? 'genesis');
}

function blockId(height: number): string {
  return `blk_${height}`;
}

function asset(assetId: 'SUNREY_COIN' | 'MOONREY_COIN', issued: string, burned: string, locked: string): IndexedAsset {
  const circulating = String(BigInt(issued) - BigInt(burned) - BigInt(locked));
  return {
    assetId,
    internalAssetId: NATIVE_ASSET_INTERNAL_IDS[assetId],
    displayName: NATIVE_ASSET_DISPLAY_NAMES[assetId],
    precision: NATIVE_ASSET_PRECISION,
    publicTickerStatus: PUBLIC_TICKER_STATUS,
    networkClass: 'DEVELOPMENT',
    supplyLabel: 'DEVELOPMENT_TESTNET_SUPPLY',
    issued,
    burned,
    locked,
    circulating,
    issuancePolicy: assetId === 'MOONREY_COIN' ? 'VERIFIED_PRODUCTIVE_CONTRIBUTION' : 'DEVELOPMENT_GENESIS',
    notMarketCapitalization: true,
    policyVersion: 'sunrey.monetary.constitution.v1',
    genesisAllocationTotal: '0',
    authorizedIssuanceTotal: issued,
    escrowed: '0',
    supplyReconciliation: 'EXACT',
    ...(assetId === 'MOONREY_COIN' ? { moonreyIssuanceCategorySummary: { ENERGY: issued } } : {}),
    networkEnvironmentLabel: 'DEVELOPMENT',
  };
}

function faucetAccount(): IndexedAccount {
  return {
    address: 'sr1qfaucet000000000000000000000000001',
    accountClass: 'SINGLE_KEY_ACCOUNT',
    nonce: '2',
    holdings: { SUNREY_COIN: '990000', MOONREY_COIN: '240' },
    locks: [{ lockId: 'lock_fee_1', assetId: 'SUNREY_COIN', quantity: '5', purpose: 'FEE' }],
    authorizationPolicy: 'SINGLE_SIGNATURE',
    machineAccount: false,
    notABankAccount: true,
  };
}

function machineAccount(): IndexedAccount {
  return {
    address: 'sr1qmachine0000000000000000000000003',
    accountClass: 'MACHINE_ACCOUNT',
    nonce: '1',
    holdings: { SUNREY_COIN: '40', MOONREY_COIN: '0' },
    locks: [],
    authorizationPolicy: 'MACHINE_MANDATE',
    machineAccount: true,
    notABankAccount: true,
  };
}
