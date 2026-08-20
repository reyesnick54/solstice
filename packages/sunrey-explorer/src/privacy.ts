import { FORBIDDEN_FIELD_NAMES, EXPLORER_POLICY_VERSION, type ExposureClass } from './taxonomy.ts';
import type { FieldExposure } from './types.ts';

/**
 * ExplorerExposurePolicy — default-deny public projection.
 *
 * Fields not listed as PUBLIC or PUBLIC_DERIVED are stripped.
 * AUTHENTICATED_ONLY, PRIVATE, and FORBIDDEN never appear on the
 * public explorer API or web UI.
 */
export const EXPLORER_EXPOSURE_POLICY_VERSION = EXPLORER_POLICY_VERSION;

const PUBLIC_FIELDS: readonly FieldExposure[] = [
  { path: 'height', classification: 'PUBLIC' },
  { path: 'blockId', classification: 'PUBLIC' },
  { path: 'parentId', classification: 'PUBLIC' },
  { path: 'timestampUnixSeconds', classification: 'PUBLIC' },
  { path: 'proposer', classification: 'PUBLIC' },
  { path: 'validatorSetHash', classification: 'PUBLIC' },
  { path: 'protocolVersion', classification: 'PUBLIC' },
  { path: 'transactionCount', classification: 'PUBLIC' },
  { path: 'resourceUsage', classification: 'PUBLIC' },
  { path: 'feeTotal', classification: 'PUBLIC' },
  { path: 'feeAsset', classification: 'PUBLIC' },
  { path: 'feePolicyVersion', classification: 'PUBLIC' },
  { path: 'baseResourcePrice', classification: 'PUBLIC' },
  { path: 'targetUtilizationBps', classification: 'PUBLIC' },
  { path: 'feeDisposition', classification: 'PUBLIC' },
  { path: 'chargedFee', classification: 'PUBLIC' },
  { path: 'stateRoot', classification: 'PUBLIC' },
  { path: 'commit', classification: 'PUBLIC' },
  { path: 'finalityStatus', classification: 'PUBLIC' },
  { path: 'transactionId', classification: 'PUBLIC' },
  { path: 'type', classification: 'PUBLIC' },
  { path: 'actor', classification: 'PUBLIC' },
  { path: 'addressRefs', classification: 'PUBLIC' },
  { path: 'status', classification: 'PUBLIC' },
  { path: 'blockId', classification: 'PUBLIC' },
  { path: 'fee', classification: 'PUBLIC' },
  { path: 'cryptoSuite', classification: 'PUBLIC' },
  { path: 'assetQuantities', classification: 'PUBLIC' },
  { path: 'economicObjectRefs', classification: 'PUBLIC' },
  { path: 'finalizedResult', classification: 'PUBLIC' },
  { path: 'rejectionCode', classification: 'PUBLIC' },
  { path: 'address', classification: 'PUBLIC' },
  { path: 'accountClass', classification: 'PUBLIC' },
  { path: 'nonce', classification: 'PUBLIC' },
  { path: 'holdings', classification: 'PUBLIC' },
  { path: 'locks', classification: 'PUBLIC' },
  { path: 'authorizationPolicy', classification: 'PUBLIC' },
  { path: 'machineAccount', classification: 'PUBLIC' },
  { path: 'notABankAccount', classification: 'PUBLIC' },
  { path: 'history', classification: 'PUBLIC_DERIVED' },
  { path: 'assetId', classification: 'PUBLIC' },
  { path: 'internalAssetId', classification: 'PUBLIC' },
  { path: 'displayName', classification: 'PUBLIC' },
  { path: 'precision', classification: 'PUBLIC' },
  { path: 'publicTickerStatus', classification: 'PUBLIC' },
  { path: 'networkClass', classification: 'PUBLIC' },
  { path: 'supplyLabel', classification: 'PUBLIC' },
  { path: 'issued', classification: 'PUBLIC' },
  { path: 'burned', classification: 'PUBLIC' },
  { path: 'locked', classification: 'PUBLIC' },
  { path: 'circulating', classification: 'PUBLIC_DERIVED' },
  { path: 'issuancePolicy', classification: 'PUBLIC' },
  { path: 'notMarketCapitalization', classification: 'PUBLIC' },
  { path: 'policyVersion', classification: 'PUBLIC' },
  { path: 'genesisAllocationTotal', classification: 'PUBLIC' },
  { path: 'authorizedIssuanceTotal', classification: 'PUBLIC' },
  { path: 'escrowed', classification: 'PUBLIC' },
  { path: 'supplyReconciliation', classification: 'PUBLIC_DERIVED' },
  { path: 'moonreyIssuanceCategorySummary', classification: 'PUBLIC_DERIVED' },
  { path: 'networkEnvironmentLabel', classification: 'PUBLIC' },
  { path: 'monetary', classification: 'PUBLIC_DERIVED' },
  { path: 'classification', classification: 'PUBLIC' },
  { path: 'distinctFromCustomerCustody', classification: 'PUBLIC' },
  { path: 'distinctFromFiatLedger', classification: 'PUBLIC' },
  { path: 'distinctFromExchangeCustomerBalances', classification: 'PUBLIC' },
  { path: 'reserves', classification: 'PUBLIC' },
  { path: 'budgets', classification: 'PUBLIC' },
  { path: 'approvedDisbursements', classification: 'PUBLIC' },
  { path: 'finalizedDisbursements', classification: 'PUBLIC' },
  { path: 'productionTreasuryInactive', classification: 'PUBLIC' },
  { path: 'reserveClass', classification: 'PUBLIC' },
  { path: 'available', classification: 'PUBLIC' },
  { path: 'reserved', classification: 'PUBLIC' },
  { path: 'encumbered', classification: 'PUBLIC' },
  { path: 'purpose', classification: 'PUBLIC' },
  { path: 'maximumAuthorizedQuantity', classification: 'PUBLIC' },
  { path: 'remainingQuantity', classification: 'PUBLIC' },
  { path: 'approvalState', classification: 'PUBLIC' },
  { path: 'cycleId', classification: 'PUBLIC' },
  { path: 'intentId', classification: 'PUBLIC' },
  { path: 'chainFinalityRef', classification: 'PUBLIC' },
  { path: 'assets', classification: 'PUBLIC' },
  { path: 'issuanceId', classification: 'PUBLIC' },
  { path: 'receiptId', classification: 'PUBLIC' },
  { path: 'productiveCategory', classification: 'PUBLIC' },
  { path: 'contributionId', classification: 'PUBLIC' },
  { path: 'productiveObjectId', classification: 'PUBLIC' },
  { path: 'oracleFactRefs', classification: 'PUBLIC' },
  { path: 'formulaVersion', classification: 'PUBLIC' },
  { path: 'formulaInputs', classification: 'PUBLIC' },
  { path: 'rounding', classification: 'PUBLIC' },
  { path: 'issuedQuantity', classification: 'PUBLIC' },
  { path: 'recipient', classification: 'PUBLIC' },
  { path: 'normalizationPolicy', classification: 'PUBLIC' },
  { path: 'policyVersion', classification: 'PUBLIC' },
  { path: 'epoch', classification: 'PUBLIC' },
  { path: 'antiDoubleCountFingerprint', classification: 'PUBLIC' },
  { path: 'supplySummary', classification: 'PUBLIC_DERIVED' },
  { path: 'objectId', classification: 'PUBLIC' },
  { path: 'category', classification: 'PUBLIC' },
  { path: 'claimType', classification: 'PUBLIC' },
  { path: 'lineage', classification: 'PUBLIC' },
  { path: 'geographicAggregate', classification: 'PUBLIC' },
  { path: 'quantity', classification: 'PUBLIC' },
  { path: 'unit', classification: 'PUBLIC' },
  { path: 'providerId', classification: 'PUBLIC' },
  { path: 'oracleType', classification: 'PUBLIC' },
  { path: 'feedId', classification: 'PUBLIC' },
  { path: 'factType', classification: 'PUBLIC' },
  { path: 'factId', classification: 'PUBLIC' },
  { path: 'sourceCount', classification: 'PUBLIC' },
  { path: 'aggregationMethod', classification: 'PUBLIC' },
  { path: 'quality', classification: 'PUBLIC' },
  { path: 'staleness', classification: 'PUBLIC' },
  { path: 'conflictState', classification: 'PUBLIC' },
  { path: 'artifactKind', classification: 'PUBLIC' },
  { path: 'validatorId', classification: 'PUBLIC' },
  { path: 'consensusKeyDescriptor', classification: 'PUBLIC' },
  { path: 'votingPower', classification: 'PUBLIC' },
  { path: 'epoch', classification: 'PUBLIC' },
  { path: 'operatorMetadata', classification: 'PUBLIC' },
  { path: 'blocksProposed', classification: 'PUBLIC' },
  { path: 'votes', classification: 'PUBLIC' },
  { path: 'missed', classification: 'PUBLIC' },
  { path: 'jailStatus', classification: 'PUBLIC' },
  { path: 'tombstone', classification: 'PUBLIC' },
  { path: 'bondState', classification: 'PUBLIC' },
  { path: 'bondAsset', classification: 'PUBLIC' },
  { path: 'publicRewardSummary', classification: 'PUBLIC' },
  { path: 'unbondStatus', classification: 'PUBLIC' },
  { path: 'publicPenalties', classification: 'PUBLIC' },
  { path: 'paid', classification: 'PUBLIC' },
  { path: 'pending', classification: 'PUBLIC' },
  { path: 'releaseEpoch', classification: 'PUBLIC' },
  { path: 'validators', classification: 'PUBLIC' },
  { path: 'evidenceId', classification: 'PUBLIC' },
  { path: 'kind', classification: 'PUBLIC' },
  { path: 'round', classification: 'PUBLIC' },
  { path: 'result', classification: 'PUBLIC' },
  { path: 'policyVersion', classification: 'PUBLIC' },
  { path: 'futureValidatorStatus', classification: 'PUBLIC' },
  { path: 'proposalId', classification: 'PUBLIC' },
  { path: 'proposalHash', classification: 'PUBLIC' },
  { path: 'upgradeKind', classification: 'PUBLIC' },
  { path: 'votesApprove', classification: 'PUBLIC' },
  { path: 'votesReject', classification: 'PUBLIC' },
  { path: 'requiredThreshold', classification: 'PUBLIC' },
  { path: 'activationHeight', classification: 'PUBLIC' },
  { path: 'moduleHashes', classification: 'PUBLIC' },
  { path: 'activationResult', classification: 'PUBLIC' },
  { path: 'policyDiffHash', classification: 'PUBLIC' },
  { path: 'activeVersion', classification: 'PUBLIC' },
  { path: 'emergencyRestrictionClass', classification: 'PUBLIC' },
  { path: 'restrictionState', classification: 'PUBLIC' },
  { path: 'clientId', classification: 'PUBLIC' },
  { path: 'externalChainId', classification: 'PUBLIC' },
  { path: 'verifiedHeight', classification: 'PUBLIC' },
  { path: 'securityProfile', classification: 'PUBLIC' },
  { path: 'developmentOnly', classification: 'PUBLIC' },
  { path: 'packetId', classification: 'PUBLIC' },
  { path: 'connectionId', classification: 'PUBLIC' },
  { path: 'channelId', classification: 'PUBLIC' },
  { path: 'lifecycle', classification: 'PUBLIC' },
  { path: 'acknowledgement', classification: 'PUBLIC' },
  { path: 'timeoutHeight', classification: 'PUBLIC' },
  { path: 'machineId', classification: 'PUBLIC' },
  { path: 'machineType', classification: 'PUBLIC' },
  { path: 'serviceOffer', classification: 'PUBLIC' },
  { path: 'resourceCategory', classification: 'PUBLIC' },
  { path: 'settledQuantity', classification: 'PUBLIC' },
  { path: 'deliveryProofRef', classification: 'PUBLIC' },
  { path: 'settlementId', classification: 'PUBLIC' },
  { path: 'marketFamily', classification: 'PUBLIC' },
  { path: 'instrument', classification: 'PUBLIC' },
  { path: 'assetLegs', classification: 'PUBLIC' },
  { path: 'finalizedHeight', classification: 'PUBLIC' },
  { path: 'label', classification: 'PUBLIC_DERIVED' },
  { path: 'id', classification: 'PUBLIC' },
  { path: 'productName', classification: 'PUBLIC' },
  { path: 'productBrand', classification: 'PUBLIC' },
  { path: 'networkLabel', classification: 'PUBLIC' },
  { path: 'latestFinalizedHeight', classification: 'PUBLIC_DERIVED' },
  { path: 'latestBlock', classification: 'PUBLIC_DERIVED' },
  { path: 'transactionActivity', classification: 'PUBLIC_DERIVED' },
  { path: 'validatorCount', classification: 'PUBLIC_DERIVED' },
  { path: 'activeProtocolVersion', classification: 'PUBLIC' },
  { path: 'sunreyDevelopmentSupply', classification: 'PUBLIC_DERIVED' },
  { path: 'moonreyDevelopmentSupply', classification: 'PUBLIC_DERIVED' },
  { path: 'productiveContributionCount', classification: 'PUBLIC_DERIVED' },
  { path: 'latestOracleFacts', classification: 'PUBLIC_DERIVED' },
  { path: 'interopClientCount', classification: 'PUBLIC_DERIVED' },
  { path: 'supplyIsNotMarketCap', classification: 'PUBLIC' },
  { path: 'environment', classification: 'PUBLIC' },
  { path: 'note', classification: 'PUBLIC' },
  { path: 'class', classification: 'PUBLIC' },
  { path: 'productionParameters', classification: 'PUBLIC' },
  { path: 'productionBudget', classification: 'PUBLIC' },
  { path: 'productionDisbursement', classification: 'PUBLIC' },
  { path: 'sunreySupply', classification: 'PUBLIC_DERIVED' },
  { path: 'moonreySupply', classification: 'PUBLIC_DERIVED' },
  { path: 'indexed_finalized_height', classification: 'PUBLIC_DERIVED' },
  { path: 'chain_finalized_height', classification: 'PUBLIC_DERIVED' },
  { path: 'index_lag', classification: 'PUBLIC_DERIVED' },
  { path: 'items', classification: 'PUBLIC_DERIVED' },
  { path: 'nextCursor', classification: 'PUBLIC_DERIVED' },
  { path: 'schemaVersion', classification: 'PUBLIC' },
  { path: 'checkpoint', classification: 'PUBLIC' },
  { path: 'lastIndexedFinalizedHeight', classification: 'PUBLIC' },
  { path: 'indexerSchemaVersion', classification: 'PUBLIC' },
  { path: 'lockId', classification: 'PUBLIC' },
  { path: 'purpose', classification: 'PUBLIC' },
  { path: 'certificateId', classification: 'PUBLIC' },
  { path: 'prevoteCount', classification: 'PUBLIC' },
  { path: 'precommitCount', classification: 'PUBLIC' },
  { path: 'signedVotingPower', classification: 'PUBLIC' },
  { path: 'totalPower', classification: 'PUBLIC' },
];

const FORBIDDEN_FIELDS: readonly FieldExposure[] = [
  { path: 'privateKey', classification: 'FORBIDDEN' },
  { path: 'secret', classification: 'FORBIDDEN' },
  { path: 'seed', classification: 'FORBIDDEN' },
  { path: 'mnemonic', classification: 'FORBIDDEN' },
  { path: 'passphrase', classification: 'FORBIDDEN' },
  { path: 'pdvRaw', classification: 'FORBIDDEN' },
  { path: 'personalDataVault', classification: 'FORBIDDEN' },
  { path: 'cleanRoomRow', classification: 'FORBIDDEN' },
  { path: 'kycRecord', classification: 'FORBIDDEN' },
  { path: 'screeningResult', classification: 'FORBIDDEN' },
  { path: 'consentDetail', classification: 'FORBIDDEN' },
  { path: 'walletKey', classification: 'FORBIDDEN' },
  { path: 'controllerSecret', classification: 'FORBIDDEN' },
  { path: 'mandateSecret', classification: 'FORBIDDEN' },
  { path: 'securityCredential', classification: 'FORBIDDEN' },
  { path: 'orderAccountPrivate', classification: 'PRIVATE' },
  { path: 'validatorInfrastructure', classification: 'FORBIDDEN' },
  { path: 'privateInvestigation', classification: 'FORBIDDEN' },
  { path: 'walletDeviceBinding', classification: 'FORBIDDEN' },
  { path: 'walletSession', classification: 'FORBIDDEN' },
  { path: 'walletRecoveryRequest', classification: 'FORBIDDEN' },
  { path: 'walletRecoveryEvidence', classification: 'FORBIDDEN' },
  { path: 'walletRecoveryChallenge', classification: 'FORBIDDEN' },
  { path: 'devicePublicDescriptor', classification: 'PRIVATE' },
  { path: 'sessionToken', classification: 'FORBIDDEN' },
];

const PUBLIC_SET = new Set(PUBLIC_FIELDS.map((field) => field.path));
const CLASS_BY_PATH = new Map<string, ExposureClass>(
  [...PUBLIC_FIELDS, ...FORBIDDEN_FIELDS].map((field) => [field.path, field.classification]),
);

export class ExplorerExposurePolicy {
  readonly version = EXPLORER_EXPOSURE_POLICY_VERSION;
  readonly defaultClassification: ExposureClass = 'FORBIDDEN';

  classify(path: string): ExposureClass {
    return CLASS_BY_PATH.get(path) ?? this.defaultClassification;
  }

  isPublic(path: string): boolean {
    const classification = this.classify(path);
    return classification === 'PUBLIC' || classification === 'PUBLIC_DERIVED';
  }

  project<T>(value: T): T {
    return projectValue(value, this) as T;
  }

  containsForbiddenName(name: string): boolean {
    const lower = name.toLowerCase();
    return FORBIDDEN_FIELD_NAMES.some((forbidden) => lower === forbidden.toLowerCase() || lower.includes('privatekey'));
  }
}

export const explorerExposurePolicy = new ExplorerExposurePolicy();

function projectValue(value: unknown, policy: ExplorerExposurePolicy): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => projectValue(item, policy));
  }
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    if (policy.containsForbiddenName(key)) {
      continue;
    }
    if (!policy.isPublic(key)) {
      continue;
    }
    out[key] = projectValue(child, policy);
  }
  return out;
}

export function assertNoSecrets(payload: unknown): void {
  const text = JSON.stringify(payload);
  for (const name of FORBIDDEN_FIELD_NAMES) {
    if (text.includes(`"${name}"`)) {
      throw new Error(`explorer payload leaked forbidden field ${name}`);
    }
  }
}
