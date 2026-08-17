import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

import { commitCanonical } from '../hash.ts';
import { moonreyIssuanceActivated } from '../protocol/assets.ts';
import {
  CONSENSUS_PARAM_BOUNDS,
  FORBIDDEN_PAYLOAD_KEYS,
  LEGAL_TRANSITIONS,
  UPGRADE_KINDS,
  type ConsensusParams,
  type CryptoPolicySchedule,
  type EmergencyHaltIntent,
  type EmergencyReason,
  type GovernanceActor,
  type GovernanceAuditRecord,
  type GovernancePolicy,
  type GovernanceVote,
  type NativeModuleRecord,
  type ProtocolCommitments,
  type ReadinessStatus,
  type ReleaseManifest,
  type StateMigrationSpec,
  type UpgradeKind,
  type UpgradePlan,
  type UpgradeReadiness,
  type UpgradeStatus,
  type VoteChoice,
} from './types.ts';

const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const VOTE_DOMAIN = 'sunrey.gov.vote.v1';
const PLAN_DOMAIN = 'sunrey.gov.plan.v1';
const KNOWN_DEV_SUITES = new Set([
  'SUNREY_DEV_ED25519_SHA256',
  'cs_ed25519_sha256_v1',
  'sunrey-ed25519-v1',
  'sunrey-hybrid-ed25519-mldsa-v1',
  'sunrey-mldsa-65-v1',
]);

export function isUpgradeKind(value: string): value is UpgradeKind {
  return (UPGRADE_KINDS as readonly string[]).includes(value);
}

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function developmentParams(): ConsensusParams {
  return Object.freeze({
    maxBlockBytes: 512_000,
    maxTransactions: 32,
    timeoutProposeMs: 1_000,
    timeoutPrevoteMs: 1_000,
    timeoutPrecommitMs: 1_000,
    evidenceMaxAge: 10_000,
  });
}

export function hashConsensusParams(params: ConsensusParams): string {
  return commitCanonical({ domain: 'sunrey.consparams.v1', ...params });
}

export function hashModuleRegistry(modules: readonly NativeModuleRecord[]): string {
  return commitCanonical({ domain: 'sunrey.modules.v1', modules });
}

export function hashCodecRegistry(codecs: UpgradePlan['codecs']): string {
  return commitCanonical({ domain: 'sunrey.codecs.v1', codecs });
}

export function hashCryptoPolicy(schedule: CryptoPolicySchedule | null, suiteIds: readonly string[]): string {
  return commitCanonical({ domain: 'sunrey.cryptopolicy.v1', schedule, suiteIds });
}

export function proposalContentHash(plan: Omit<UpgradePlan, 'status' | 'authorizationState' | 'evidenceReferences'> & {
  readonly status?: UpgradeStatus;
  readonly authorizationState?: string;
  readonly evidenceReferences?: readonly string[];
}): string {
  return commitCanonical({
    domain: PLAN_DOMAIN,
    upgradeId: plan.upgradeId,
    upgradeKind: plan.upgradeKind,
    currentProtocolVersion: plan.currentProtocolVersion,
    targetProtocolVersion: plan.targetProtocolVersion,
    proposalHeight: plan.proposalHeight,
    activationHeight: plan.activationHeight,
    affectedModules: plan.affectedModules,
    newModuleHashes: plan.newModuleHashes,
    codecRegistryHash: plan.codecRegistryHash,
    consensusParamsHash: plan.consensusParamsHash,
    cryptoPolicyHash: plan.cryptoPolicyHash,
    stateMigrationHash: plan.stateMigrationHash,
    releaseArtifactHash: plan.releaseArtifactHash,
    minimumNodeVersion: plan.minimumNodeVersion,
    governancePolicyVersion: plan.governancePolicyVersion,
    consensusParams: plan.consensusParams,
    modules: plan.modules,
    codecs: plan.codecs,
    cryptoSchedule: plan.cryptoSchedule,
    stateMigration: plan.stateMigration,
    releaseManifest: plan.releaseManifest,
    payload: plan.payload,
  });
}

export function votePayload(vote: Omit<GovernanceVote, 'signatureHex'>): string {
  return commitCanonical({
    domain: VOTE_DOMAIN,
    upgradeId: vote.upgradeId,
    proposalContentHash: vote.proposalContentHash,
    networkId: vote.networkId,
    chainId: vote.chainId,
    protocolVersion: vote.protocolVersion,
    voterId: vote.voterId,
    governancePolicyVersion: vote.governancePolicyVersion,
    activationHeight: vote.activationHeight,
    choice: vote.choice,
    publicKeyHex: vote.publicKeyHex,
  });
}

export function ed25519FromSeed(seed: Uint8Array): { readonly privateKey: Buffer; readonly publicKeyHex: string } {
  if (seed.length !== 32) {
    throw new TypeError('Ed25519 seed must be 32 bytes');
  }
  const pkcs8 = Buffer.concat([PKCS8_PREFIX, Buffer.from(seed)]);
  const privateKey = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  const spki = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  return {
    privateKey: pkcs8,
    publicKeyHex: Buffer.from(spki.subarray(spki.length - 32)).toString('hex'),
  };
}

export function seedFromLabel(label: string): Uint8Array {
  return createHash('sha256').update(`SUNREY-GOV-DEV-SEED-v1:${label}`).digest();
}

export function signBytes(seed: Uint8Array, messageHex: string): string {
  const keys = ed25519FromSeed(seed);
  const privateKey = createPrivateKey({ key: keys.privateKey, format: 'der', type: 'pkcs8' });
  return sign(null, Buffer.from(messageHex, 'hex'), privateKey).toString('hex');
}

export function verifyBytes(publicKeyHex: string, messageHex: string, signatureHex: string): boolean {
  const raw = Buffer.from(publicKeyHex, 'hex');
  if (raw.length !== 32) {
    return false;
  }
  const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
  const publicKey = createPublicKey({
    key: Buffer.concat([spkiPrefix, raw]),
    format: 'der',
    type: 'spki',
  });
  return verify(null, Buffer.from(messageHex, 'hex'), publicKey, Buffer.from(signatureHex, 'hex'));
}

export function validateConsensusParams(params: ConsensusParams): string | null {
  const checks: Array<[keyof ConsensusParams, { min: number; max: number }]> = [
    ['maxBlockBytes', CONSENSUS_PARAM_BOUNDS.maxBlockBytes],
    ['maxTransactions', CONSENSUS_PARAM_BOUNDS.maxTransactions],
    ['timeoutProposeMs', CONSENSUS_PARAM_BOUNDS.timeoutProposeMs],
    ['timeoutPrevoteMs', CONSENSUS_PARAM_BOUNDS.timeoutPrevoteMs],
    ['timeoutPrecommitMs', CONSENSUS_PARAM_BOUNDS.timeoutPrecommitMs],
    ['evidenceMaxAge', CONSENSUS_PARAM_BOUNDS.evidenceMaxAge],
  ];
  for (const [key, bound] of checks) {
    const value = params[key];
    if (!Number.isInteger(value) || value < bound.min || value > bound.max) {
      return `consensus parameter ${key} outside safe bounds`;
    }
  }
  return null;
}

function payloadHasForbiddenKey(payload: Readonly<Record<string, unknown>>): string | null {
  for (const key of FORBIDDEN_PAYLOAD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      return `forbidden payload key ${key}`;
    }
  }
  const serialized = JSON.stringify(payload).toLowerCase();
  const needles = [
    'production_network_enabled',
    'confirmed_by_counsel',
    'customer_ledger_authority',
    'ai_governance',
    'evidence_vault_replacement',
    'disable_signature_verification',
    'remove_validator_accountability',
    'sunrey_coin_supply',
    'moonrey_issuance',
    'finalized_history_rewrite',
  ];
  for (const needle of needles) {
    if (serialized.includes(needle)) {
      return `forbidden payload content ${needle}`;
    }
  }
  return null;
}

export function validateProposal(
  plan: UpgradePlan,
  policy: GovernancePolicy,
  currentHeight: number,
  currentVersion: number,
): string | null {
  if (!isUpgradeKind(plan.upgradeKind)) {
    return 'undefined upgrade kind';
  }
  if (plan.currentProtocolVersion !== currentVersion) {
    return 'current protocol version mismatch';
  }
  if (plan.targetProtocolVersion < currentVersion) {
    return 'target protocol version is not sensible';
  }
  if (plan.upgradeKind === 'HARD_PROTOCOL_CUTOVER' && plan.targetProtocolVersion <= currentVersion) {
    return 'hard cutover requires a greater protocol version';
  }
  if (plan.activationHeight < currentHeight + policy.minActivationLead) {
    return 'activation height is not sufficiently future';
  }
  if (plan.governancePolicyVersion !== policy.version) {
    return 'governance policy version mismatch';
  }
  if (!plan.releaseArtifactHash || plan.releaseArtifactHash.length !== 64) {
    return 'release artifact hash missing';
  }
  if (!plan.codecRegistryHash || plan.codecRegistryHash.length !== 64) {
    return 'codec compatibility not declared';
  }
  if (!plan.consensusParamsHash || plan.consensusParamsHash.length !== 64) {
    return 'consensus params hash missing';
  }
  if (!plan.cryptoPolicyHash || plan.cryptoPolicyHash.length !== 64) {
    return 'crypto policy hash missing';
  }
  if (
    (plan.upgradeKind === 'MODULE_ADD' ||
      plan.upgradeKind === 'MODULE_REPLACE' ||
      plan.upgradeKind === 'HARD_PROTOCOL_CUTOVER') &&
    Object.keys(plan.newModuleHashes).length === 0
  ) {
    return 'module hashes missing';
  }
  if (
    (plan.upgradeKind === 'MODULE_REPLACE' || plan.upgradeKind === 'HARD_PROTOCOL_CUTOVER') &&
    !plan.stateMigrationHash
  ) {
    return 'state migration hash required';
  }
  if (plan.stateMigration && plan.stateMigration.contentHash !== plan.stateMigrationHash) {
    return 'state migration hash mismatch';
  }
  if (plan.consensusParams) {
    const bound = validateConsensusParams(plan.consensusParams);
    if (bound) {
      return bound;
    }
    if (hashConsensusParams(plan.consensusParams) !== plan.consensusParamsHash) {
      return 'consensus params hash mismatch';
    }
  }
  if (plan.cryptoSchedule && !KNOWN_DEV_SUITES.has(plan.cryptoSchedule.suiteId)) {
    return 'unknown CryptoSuite';
  }
  if (plan.cryptoSchedule && plan.cryptoSchedule.preserveHistoricalVerify !== true) {
    return 'historical signature verification must remain available';
  }
  const forbidden = payloadHasForbiddenKey(plan.payload);
  if (forbidden) {
    return forbidden;
  }
  if (plan.payload.ENVIRONMENT !== undefined && plan.payload.ENVIRONMENT !== 'simulation') {
    return 'ENVIRONMENT mutation is forbidden';
  }
  if (moonreyIssuanceActivated() !== false) {
    return 'MoonRey issuance is unavailable';
  }
  return null;
}

export function canTransition(from: UpgradeStatus, to: UpgradeStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

export type NodeCapability = {
  readonly protocolVersion: number;
  readonly supportedProtocolVersions: readonly number[];
  readonly artifactHashes: readonly string[];
  readonly codecIds: readonly string[];
  readonly suiteIds: readonly string[];
  readonly migrationHashes: readonly string[];
};

export function assessReadiness(plan: UpgradePlan, node: NodeCapability): UpgradeReadiness {
  if (!node.supportedProtocolVersions.includes(plan.targetProtocolVersion)) {
    return { upgradeId: plan.upgradeId, status: 'INCOMPATIBLE_BINARY', detail: 'target protocol not in binary' };
  }
  if (!node.artifactHashes.includes(plan.releaseArtifactHash)) {
    return { upgradeId: plan.upgradeId, status: 'MISSING_ARTIFACT', detail: 'release artifact not installed' };
  }
  if (plan.releaseManifest.artifactHash !== plan.releaseArtifactHash) {
    return { upgradeId: plan.upgradeId, status: 'HASH_MISMATCH', detail: 'release manifest hash mismatch' };
  }
  if (plan.codecs.some((codec) => !node.codecIds.includes(codec.codecId))) {
    return { upgradeId: plan.upgradeId, status: 'UNSUPPORTED_CODEC', detail: 'codec not available on node' };
  }
  if (plan.cryptoSchedule && !node.suiteIds.includes(plan.cryptoSchedule.suiteId)) {
    return {
      upgradeId: plan.upgradeId,
      status: 'UNSUPPORTED_CRYPTO_SUITE',
      detail: 'CryptoSuite not available on node',
    };
  }
  if (plan.stateMigrationHash && !node.migrationHashes.includes(plan.stateMigrationHash)) {
    return {
      upgradeId: plan.upgradeId,
      status: 'STATE_MIGRATION_UNAVAILABLE',
      detail: 'state migration artifact missing',
    };
  }
  return { upgradeId: plan.upgradeId, status: 'READY', detail: 'node can execute the authorized plan' };
}

export function applyStateMigration(
  spec: StateMigrationSpec,
  preState: Uint8Array,
  apply: (pre: Uint8Array) => Uint8Array,
): Uint8Array {
  const preHash = sha256Hex(preState);
  if (preHash !== spec.preStateRequirement) {
    throw new Error('pre-state requirement failed');
  }
  const post = apply(preState);
  const postHash = sha256Hex(post);
  if (postHash !== spec.postStateRoot) {
    throw new Error('post-state root mismatch');
  }
  return post;
}

export function developmentGovernancePolicy(): GovernancePolicy {
  const signers: GovernanceActor[] = [1, 2, 3, 4].map((n) => {
    const seed = seedFromLabel(`validator-gov-${n}`);
    const keys = ed25519FromSeed(seed);
    return Object.freeze({
      actorId: `gov_validator_${n}`,
      role: 'VALIDATOR_GOVERNANCE_SIGNER' as const,
      identity: Object.freeze({
        kind: 'LEGAL_ENTITY' as const,
        id: `le_dev_validator_${n}`,
        displayName: `Development validator ${n}`,
      }),
      keyKind: 'GOVERNANCE_SIGNING' as const,
      publicKeyHex: keys.publicKeyHex,
      votingPower: 1n,
    });
  });
  const releaseSeed = seedFromLabel('release-authority');
  const releaseKeys = ed25519FromSeed(releaseSeed);
  const release: GovernanceActor = Object.freeze({
    actorId: 'gov_release_1',
    role: 'RELEASE_AUTHORITY',
    identity: Object.freeze({
      kind: 'HUMAN_OPERATOR' as const,
      id: 'human_release_1',
      displayName: 'Development release authority',
    }),
    keyKind: 'GOVERNANCE_SIGNING',
    publicKeyHex: releaseKeys.publicKeyHex,
    votingPower: 0n,
  });
  const security: GovernanceActor = Object.freeze({
    actorId: 'gov_security_1',
    role: 'SECURITY_GOVERNANCE_SIGNER',
    identity: Object.freeze({
      kind: 'HUMAN_OPERATOR' as const,
      id: 'human_security_1',
      displayName: 'Development security signer',
    }),
    keyKind: 'GOVERNANCE_SIGNING',
    publicKeyHex: ed25519FromSeed(seedFromLabel('security-1')).publicKeyHex,
    votingPower: 1n,
  });
  const operator: GovernanceActor = Object.freeze({
    actorId: 'gov_operator_1',
    role: 'PROTOCOL_OPERATOR',
    identity: Object.freeze({
      kind: 'HUMAN_OPERATOR' as const,
      id: 'human_operator_1',
      displayName: 'Development protocol operator',
    }),
    keyKind: 'GOVERNANCE_SIGNING',
    publicKeyHex: ed25519FromSeed(seedFromLabel('operator-1')).publicKeyHex,
    votingPower: 0n,
  });
  const all = [...signers, release, security, operator];
  return Object.freeze({
    version: 1,
    networkId: 'net_sunrey_local_dev',
    chainId: 'chn_sunrey_local_dev',
    protocolVersion: 1,
    thresholdModel: 'VALIDATOR_SUPERMAJORITY',
    requiredPower: 3n,
    totalPower: 4n,
    signers: Object.freeze(all),
    releaseAuthorityId: 'gov_release_1',
    minActivationLead: 4,
  });
}

export function defaultReleaseManifest(artifactHash: string): ReleaseManifest {
  return Object.freeze({
    sourceCommit: 'development-unspecified',
    toolchainVersion: 'rustc-dev / node-22',
    artifactHash,
    moduleHashes: Object.freeze({}),
    schemaHashes: Object.freeze({ srcb: artifactHash }),
    reproducedInCi: false,
  });
}

export function createDraftPlan(input: {
  readonly upgradeId: string;
  readonly upgradeKind: UpgradeKind;
  readonly currentProtocolVersion: number;
  readonly targetProtocolVersion: number;
  readonly proposalHeight: number;
  readonly activationHeight: number;
  readonly policy: GovernancePolicy;
  readonly consensusParams?: ConsensusParams;
  readonly modules?: readonly NativeModuleRecord[];
  readonly codecs?: UpgradePlan['codecs'];
  readonly cryptoSchedule?: CryptoPolicySchedule | null;
  readonly stateMigration?: StateMigrationSpec | null;
  readonly affectedModules?: readonly string[];
  readonly newModuleHashes?: Readonly<Record<string, string>>;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly artifactLabel?: string;
}): UpgradePlan {
  const params = input.consensusParams ?? developmentParams();
  const modules = input.modules ?? [];
  const codecs = input.codecs ?? [
    Object.freeze({ codecId: 'srcb.v1', schemaVersion: 1, schemaHash: sha256Hex('srcb.v1'), activationHeight: 0 }),
  ];
  const artifactHash = sha256Hex(input.artifactLabel ?? input.upgradeId);
  const migration = input.stateMigration ?? null;
  return Object.freeze({
    upgradeId: input.upgradeId,
    upgradeKind: input.upgradeKind,
    currentProtocolVersion: input.currentProtocolVersion,
    targetProtocolVersion: input.targetProtocolVersion,
    proposalHeight: input.proposalHeight,
    activationHeight: input.activationHeight,
    affectedModules: input.affectedModules ?? [],
    newModuleHashes: input.newModuleHashes ?? {},
    codecRegistryHash: hashCodecRegistry(codecs),
    consensusParamsHash: hashConsensusParams(params),
    cryptoPolicyHash: hashCryptoPolicy(input.cryptoSchedule ?? null, [...KNOWN_DEV_SUITES]),
    stateMigrationHash: migration?.contentHash ?? null,
    releaseArtifactHash: artifactHash,
    minimumNodeVersion: '0.1.0',
    governancePolicyVersion: input.policy.version,
    authorizationState: 'NONE',
    status: 'DRAFT',
    evidenceReferences: [],
    consensusParams: params,
    modules,
    codecs,
    cryptoSchedule: input.cryptoSchedule ?? null,
    stateMigration: migration,
    releaseManifest: defaultReleaseManifest(artifactHash),
    payload: input.payload ?? {},
  });
}

export type GovernanceMetrics = {
  protocol_version: number;
  pending_upgrade: string;
  upgrade_activation_height: number;
  upgrade_readiness: ReadinessStatus | 'NONE';
  governance_votes_power: number;
  governance_required_power: number;
  module_registry_hash: string;
  codec_registry_hash: string;
  crypto_policy_hash: string;
  consensus_params_hash: string;
  upgrade_activation_success: number;
  upgrade_activation_failure: number;
};

export class UpgradeManager {
  readonly policy: GovernancePolicy;
  readonly audit: GovernanceAuditRecord[] = [];
  plans = new Map<string, UpgradePlan>();
  votes = new Map<string, GovernanceVote[]>();
  emergency: EmergencyHaltIntent | null = null;
  protocolVersion: number;
  height: number;
  params: ConsensusParams;
  modules: NativeModuleRecord[];
  codecs: UpgradePlan['codecs'];
  cryptoSchedule: CryptoPolicySchedule | null = null;
  historicalSuites = new Set<string>(KNOWN_DEV_SUITES);
  activationSuccess = 0;
  activationFailure = 0;
  haltActive = false;

  constructor(policy: GovernancePolicy, height = 0, version = 1) {
    this.policy = policy;
    this.height = height;
    this.protocolVersion = version;
    this.params = developmentParams();
    this.modules = [
      Object.freeze({
        moduleId: 'native.system',
        version: '1',
        artifactHash: sha256Hex('native.system.v1'),
        schemaHash: sha256Hex('native.system.schema.v1'),
        activationHeight: 0,
        deactivationHeight: null,
      }),
    ];
    this.codecs = [
      Object.freeze({ codecId: 'srcb.v1', schemaVersion: 1, schemaHash: sha256Hex('srcb.v1'), activationHeight: 0 }),
    ];
  }

  commitments(): ProtocolCommitments {
    return Object.freeze({
      protocolVersion: this.protocolVersion,
      consensusParamsHash: hashConsensusParams(this.params),
      moduleRegistryHash: hashModuleRegistry(this.modules),
      codecRegistryHash: hashCodecRegistry(this.codecs),
      cryptoPolicyHash: hashCryptoPolicy(this.cryptoSchedule, [...this.historicalSuites]),
    });
  }

  private record(
    kind: GovernanceAuditRecord['kind'],
    upgradeId: string,
    payload: Readonly<Record<string, unknown>>,
  ): string {
    const contentHash = commitCanonical({ kind, upgradeId, height: this.height, payload });
    this.audit.push(
      Object.freeze({
        kind,
        upgradeId,
        contentHash,
        height: this.height,
        protocolVersion: this.protocolVersion,
        payload,
      }),
    );
    return contentHash;
  }

  private setStatus(plan: UpgradePlan, status: UpgradeStatus, authorizationState = plan.authorizationState): UpgradePlan {
    if (!canTransition(plan.status, status) && plan.status !== status) {
      throw new Error(`illegal transition ${plan.status} -> ${status}`);
    }
    const next = Object.freeze({ ...plan, status, authorizationState });
    this.plans.set(plan.upgradeId, next);
    return next;
  }

  propose(plan: UpgradePlan, actor: GovernanceActor): UpgradePlan {
    if (actor.role === 'AI_PREPARER') {
      throw new Error('AI cannot approve or submit a binding upgrade');
    }
    if (actor.keyKind !== 'GOVERNANCE_SIGNING') {
      throw new Error(`${actor.keyKind} cannot sign protocol governance`);
    }
    if (this.plans.has(plan.upgradeId)) {
      throw new Error('upgrade id already exists');
    }
    const drafted = Object.freeze({ ...plan, status: 'DRAFT' as const });
    this.plans.set(plan.upgradeId, drafted);
    const proposed = this.setStatus(drafted, 'PROPOSED');
    this.record('PROPOSAL', plan.upgradeId, {
      proposalContentHash: proposalContentHash(proposed),
      actorId: actor.actorId,
    });
    return proposed;
  }

  validate(upgradeId: string): UpgradePlan {
    const plan = this.require(upgradeId);
    const validating = this.setStatus(plan, 'VALIDATING');
    const error = validateProposal(validating, this.policy, this.height, this.protocolVersion);
    if (error) {
      return this.setStatus(validating, 'FAILED_VALIDATION', error);
    }
    return this.setStatus(validating, 'AWAITING_AUTHORIZATION');
  }

  castVote(input: {
    readonly upgradeId: string;
    readonly voter: GovernanceActor;
    readonly seed: Uint8Array;
    readonly choice: VoteChoice;
  }): GovernanceVote {
    const plan = this.require(input.upgradeId);
    if (plan.status !== 'AWAITING_AUTHORIZATION' && plan.status !== 'AUTHORIZED') {
      throw new Error('votes are accepted only while awaiting or after authorization');
    }
    if (input.voter.role === 'AI_PREPARER') {
      throw new Error('AI cannot cast a governance vote');
    }
    if (input.voter.role !== 'VALIDATOR_GOVERNANCE_SIGNER' && input.voter.role !== 'RELEASE_AUTHORITY') {
      throw new Error('actor is not a governance voter');
    }
    if (input.voter.keyKind !== 'GOVERNANCE_SIGNING') {
      throw new Error(`${input.voter.keyKind} cannot sign protocol governance`);
    }
    const known = this.policy.signers.find((signer) => signer.actorId === input.voter.actorId);
    if (!known || known.publicKeyHex !== input.voter.publicKeyHex) {
      throw new Error('unauthorized governance identity');
    }
    const contentHash = proposalContentHash(plan);
    const unsigned = {
      upgradeId: plan.upgradeId,
      proposalContentHash: contentHash,
      networkId: this.policy.networkId,
      chainId: this.policy.chainId,
      protocolVersion: this.policy.protocolVersion,
      voterId: input.voter.actorId,
      governancePolicyVersion: this.policy.version,
      activationHeight: plan.activationHeight,
      choice: input.choice,
      publicKeyHex: input.voter.publicKeyHex,
    };
    const vote: GovernanceVote = Object.freeze({
      ...unsigned,
      signatureHex: signBytes(input.seed, votePayload(unsigned)),
    });
    if (!verifyBytes(vote.publicKeyHex, votePayload(unsigned), vote.signatureHex)) {
      throw new Error('governance signature invalid');
    }
    const existing = this.votes.get(plan.upgradeId) ?? [];
    this.votes.set(
      plan.upgradeId,
      [...existing.filter((item) => item.voterId !== vote.voterId), vote],
    );
    this.record('VOTE', plan.upgradeId, {
      voterId: vote.voterId,
      choice: vote.choice,
      proposalContentHash: contentHash,
    });
    this.evaluateAuthorization(plan.upgradeId);
    return vote;
  }

  approvePower(upgradeId: string): bigint {
    const plan = this.require(upgradeId);
    const contentHash = proposalContentHash(plan);
    let power = 0n;
    for (const vote of this.votes.get(upgradeId) ?? []) {
      if (vote.proposalContentHash !== contentHash) {
        continue;
      }
      if (vote.choice !== 'APPROVE') {
        continue;
      }
      const signer = this.policy.signers.find((item) => item.actorId === vote.voterId);
      if (signer) {
        power += signer.votingPower;
      }
    }
    return power;
  }

  evaluateAuthorization(upgradeId: string): UpgradePlan {
    const plan = this.require(upgradeId);
    if (plan.status !== 'AWAITING_AUTHORIZATION') {
      return plan;
    }
    const power = this.approvePower(upgradeId);
    const rejectPower = (this.votes.get(upgradeId) ?? []).reduce((acc, vote) => {
      if (vote.choice !== 'REJECT' || vote.proposalContentHash !== proposalContentHash(plan)) {
        return acc;
      }
      const signer = this.policy.signers.find((item) => item.actorId === vote.voterId);
      return acc + (signer?.votingPower ?? 0n);
    }, 0n);
    if (rejectPower >= this.policy.requiredPower) {
      const rejected = this.setStatus(plan, 'REJECTED', 'REJECTED');
      this.record('AUTHORIZATION', upgradeId, { outcome: 'REJECTED', power: power.toString() });
      return rejected;
    }
    if (power < this.policy.requiredPower) {
      return plan;
    }
    if (this.policy.thresholdModel === 'VALIDATOR_SUPERMAJORITY_PLUS_RELEASE_AUTHORITY') {
      const releaseVote = (this.votes.get(upgradeId) ?? []).find(
        (vote) =>
          vote.voterId === this.policy.releaseAuthorityId &&
          vote.choice === 'APPROVE' &&
          vote.proposalContentHash === proposalContentHash(plan),
      );
      if (!releaseVote) {
        return plan;
      }
    }
    const authorized = this.setStatus(plan, 'AUTHORIZED', `POWER_${power.toString()}`);
    this.record('AUTHORIZATION', upgradeId, {
      outcome: 'AUTHORIZED',
      power: power.toString(),
      required: this.policy.requiredPower.toString(),
    });
    return authorized;
  }

  schedule(upgradeId: string, actor: GovernanceActor): UpgradePlan {
    if (actor.role === 'AI_PREPARER') {
      throw new Error('AI cannot change activation height or schedule an upgrade');
    }
    const plan = this.require(upgradeId);
    if (plan.status !== 'AUTHORIZED') {
      throw new Error('only authorized plans can be scheduled');
    }
    const scheduled = this.setStatus(plan, 'SCHEDULED');
    this.record('SCHEDULE', upgradeId, { activationHeight: scheduled.activationHeight });
    return scheduled;
  }

  markReady(upgradeId: string, node: NodeCapability): UpgradePlan {
    const plan = this.require(upgradeId);
    if (plan.status !== 'SCHEDULED') {
      throw new Error('readiness applies to scheduled plans');
    }
    const readiness = assessReadiness(plan, node);
    if (readiness.status !== 'READY') {
      return plan;
    }
    return this.setStatus(plan, 'READY');
  }

  cancel(upgradeId: string, actor: GovernanceActor, seed: Uint8Array): UpgradePlan {
    if (actor.role === 'AI_PREPARER') {
      throw new Error('AI cannot cancel an upgrade');
    }
    if (actor.keyKind !== 'GOVERNANCE_SIGNING') {
      throw new Error(`${actor.keyKind} cannot sign protocol governance`);
    }
    const plan = this.require(upgradeId);
    if (plan.status === 'ACTIVATED') {
      throw new Error('activated upgrades cannot be cancelled');
    }
    const message = commitCanonical({
      op: 'CANCEL',
      upgradeId,
      proposalContentHash: proposalContentHash(plan),
    });
    const signature = signBytes(seed, message);
    if (!verifyBytes(actor.publicKeyHex, message, signature)) {
      throw new Error('cancellation signature invalid');
    }
    const cancelled = this.setStatus(plan, 'CANCELLED', 'CANCELLED');
    this.record('CANCELLATION', upgradeId, { actorId: actor.actorId, signature });
    return cancelled;
  }

  supersede(upgradeId: string, replacementId: string, actor: GovernanceActor): UpgradePlan {
    if (actor.role === 'AI_PREPARER') {
      throw new Error('AI cannot supersede an upgrade');
    }
    const plan = this.require(upgradeId);
    if (plan.status === 'ACTIVATED') {
      throw new Error('activated upgrades cannot be superseded');
    }
    this.require(replacementId);
    const superseded = this.setStatus(plan, 'SUPERSEDED', `SUPERSEDED_BY_${replacementId}`);
    this.record('CANCELLATION', upgradeId, { replacementId, actorId: actor.actorId });
    return superseded;
  }

  pending(): UpgradePlan | null {
    for (const plan of this.plans.values()) {
      if (plan.status === 'SCHEDULED' || plan.status === 'READY' || plan.status === 'AUTHORIZED') {
        return plan;
      }
    }
    return null;
  }

  activateAt(height: number, node: NodeCapability): ProtocolCommitments {
    this.height = height;
    if (this.haltActive) {
      throw new Error('INCOMPATIBLE_PROTOCOL: emergency halt is active');
    }
    const pending = [...this.plans.values()].find(
      (plan) =>
        (plan.status === 'SCHEDULED' || plan.status === 'READY') && plan.activationHeight === height,
    );
    if (!pending) {
      return this.commitments();
    }
    const readiness = assessReadiness(pending, node);
    if (readiness.status !== 'READY') {
      this.activationFailure += 1;
      throw new Error(`INCOMPATIBLE_PROTOCOL: ${readiness.status}`);
    }
    if (pending.consensusParams) {
      this.params = pending.consensusParams;
    }
    if (pending.modules.length > 0) {
      this.modules = pending.modules.map((module) =>
        Object.freeze({
          ...module,
          activationHeight: height,
        }),
      );
    }
    if (pending.codecs.length > 0) {
      this.codecs = pending.codecs;
    }
    if (pending.cryptoSchedule) {
      this.cryptoSchedule = pending.cryptoSchedule;
      this.historicalSuites.add(pending.cryptoSchedule.suiteId);
    }
    if (pending.stateMigration) {
      this.record('MIGRATION', pending.upgradeId, {
        contentHash: pending.stateMigration.contentHash,
        postStateRoot: pending.stateMigration.postStateRoot,
      });
    }
    this.protocolVersion = pending.targetProtocolVersion;
    this.setStatus(pending.status === 'SCHEDULED' ? this.setStatus(pending, 'READY') : pending, 'ACTIVATED');
    this.activationSuccess += 1;
    const next = this.commitments();
    this.record('ACTIVATION', pending.upgradeId, { ...next });
    return next;
  }

  commitmentsAt(height: number): ProtocolCommitments {
    const pending = [...this.plans.values()].find(
      (plan) =>
        (plan.status === 'SCHEDULED' || plan.status === 'READY' || plan.status === 'ACTIVATED') &&
        height >= plan.activationHeight,
    );
    if (!pending) {
      return this.commitments();
    }
    return Object.freeze({
      protocolVersion: pending.targetProtocolVersion,
      consensusParamsHash: pending.consensusParamsHash,
      moduleRegistryHash: hashModuleRegistry(pending.modules.length > 0 ? pending.modules : this.modules),
      codecRegistryHash: pending.codecRegistryHash,
      cryptoPolicyHash: pending.cryptoPolicyHash,
    });
  }

  proposeEmergency(reason: EmergencyReason, actor: GovernanceActor): EmergencyHaltIntent {
    if (actor.role === 'AI_PREPARER') {
      throw new Error('AI cannot authorize emergency coordination');
    }
    if (actor.role !== 'SECURITY_GOVERNANCE_SIGNER' && actor.role !== 'PROTOCOL_OPERATOR') {
      throw new Error('emergency coordination requires a security or operator signer');
    }
    this.emergency = Object.freeze({
      intentId: `halt_${reason.toLowerCase()}`,
      reason,
      status: 'PROPOSED',
      authorizedPower: 0n,
      evidenceReferences: [],
    });
    return this.emergency;
  }

  authorizeEmergency(actor: GovernanceActor): EmergencyHaltIntent {
    if (!this.emergency) {
      throw new Error('no emergency intent');
    }
    if (actor.role !== 'SECURITY_GOVERNANCE_SIGNER') {
      throw new Error('emergency authorization requires SECURITY_GOVERNANCE_SIGNER');
    }
    const authorized = Object.freeze({
      ...this.emergency,
      status: 'AUTHORIZED' as const,
      authorizedPower: actor.votingPower,
    });
    this.emergency = authorized;
    this.record('EMERGENCY', authorized.intentId, { reason: authorized.reason, status: 'AUTHORIZED' });
    return authorized;
  }

  activateEmergency(): EmergencyHaltIntent {
    if (!this.emergency || this.emergency.status !== 'AUTHORIZED') {
      throw new Error('emergency halt is not authorized');
    }
    this.haltActive = true;
    const active = Object.freeze({ ...this.emergency, status: 'ACTIVE' as const });
    this.emergency = active;
    this.record('EMERGENCY', active.intentId, { reason: active.reason, status: 'ACTIVE' });
    return active;
  }

  historicalVerifyAllowed(suiteId: string): boolean {
    return this.historicalSuites.has(suiteId);
  }

  metrics(node: NodeCapability): GovernanceMetrics {
    const pending = this.pending();
    const readiness = pending ? assessReadiness(pending, node).status : 'NONE';
    const commits = this.commitments();
    return {
      protocol_version: this.protocolVersion,
      pending_upgrade: pending?.upgradeId ?? '',
      upgrade_activation_height: pending?.activationHeight ?? 0,
      upgrade_readiness: readiness,
      governance_votes_power: pending ? Number(this.approvePower(pending.upgradeId)) : 0,
      governance_required_power: Number(this.policy.requiredPower),
      module_registry_hash: commits.moduleRegistryHash,
      codec_registry_hash: commits.codecRegistryHash,
      crypto_policy_hash: commits.cryptoPolicyHash,
      consensus_params_hash: commits.consensusParamsHash,
      upgrade_activation_success: this.activationSuccess,
      upgrade_activation_failure: this.activationFailure,
    };
  }

  private require(upgradeId: string): UpgradePlan {
    const plan = this.plans.get(upgradeId);
    if (!plan) {
      throw new Error(`unknown upgrade ${upgradeId}`);
    }
    return plan;
  }
}

export function developmentNodeCapability(plan?: UpgradePlan): NodeCapability {
  const artifact = plan?.releaseArtifactHash ?? sha256Hex('development-artifact');
  return {
    protocolVersion: 1,
    supportedProtocolVersions: [1, 2, 3],
    artifactHashes: [artifact],
    codecIds: ['srcb.v1', 'srcb.v2'],
    suiteIds: [...KNOWN_DEV_SUITES],
    migrationHashes: plan?.stateMigrationHash ? [plan.stateMigrationHash] : [],
  };
}

export function incompatibleNodeCapability(): NodeCapability {
  return {
    protocolVersion: 1,
    supportedProtocolVersions: [1],
    artifactHashes: [],
    codecIds: ['srcb.v1'],
    suiteIds: ['SUNREY_DEV_ED25519_SHA256'],
    migrationHashes: [],
  };
}

export function actorById(policy: GovernancePolicy, actorId: string): GovernanceActor {
  const actor = policy.signers.find((item) => item.actorId === actorId);
  if (!actor) {
    throw new Error(`unknown actor ${actorId}`);
  }
  return actor;
}

export function seedForActor(actorId: string): Uint8Array {
  const map: Record<string, string> = {
    gov_validator_1: 'validator-gov-1',
    gov_validator_2: 'validator-gov-2',
    gov_validator_3: 'validator-gov-3',
    gov_validator_4: 'validator-gov-4',
    gov_release_1: 'release-authority',
    gov_security_1: 'security-1',
    gov_operator_1: 'operator-1',
  };
  return seedFromLabel(map[actorId] ?? actorId);
}
