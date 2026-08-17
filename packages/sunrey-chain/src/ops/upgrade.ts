import {
  UpgradeManager,
  actorById,
  assessReadiness,
  createDraftPlan,
  developmentGovernancePolicy,
  developmentNodeCapability,
  incompatibleNodeCapability,
  seedForActor,
  type NodeCapability,
  type UpgradePlan,
} from '../governance/index.ts';
import { opsErr, type OpsResult } from './types.ts';

export type UpgradePrecheck = {
  readonly currentProtocolVersion: number;
  readonly pendingUpgrade: string | null;
  readonly activationHeight: number | null;
  readonly binaryCompatible: boolean;
  readonly artifactHash: string | null;
  readonly readiness: string;
  readonly diskOk: boolean;
  readonly snapshotAvailable: boolean;
  readonly signerCompatible: boolean;
  readonly checks: readonly { readonly id: string; readonly ok: boolean; readonly detail: string }[];
};

export function upgradePrecheck(input: {
  readonly manager: UpgradeManager;
  readonly node: NodeCapability;
  readonly diskFreeBytes: number;
  readonly diskRequiredBytes: number;
  readonly snapshotAvailable: boolean;
  readonly signerSuiteIds: readonly string[];
}): UpgradePrecheck {
  const pending = input.manager.pending();
  const readiness = pending ? assessReadiness(pending, input.node) : null;
  const diskOk = input.diskFreeBytes > input.diskRequiredBytes;
  const signerCompatible = pending?.cryptoSchedule
    ? input.signerSuiteIds.includes(pending.cryptoSchedule.suiteId)
    : true;
  const checks = [
    {
      id: 'binary-version',
      ok: !pending || input.node.supportedProtocolVersions.includes(pending.targetProtocolVersion),
      detail: pending ? `supports ${pending.targetProtocolVersion}` : 'no pending upgrade',
    },
    {
      id: 'module-hashes',
      ok: !pending || Object.values(pending.newModuleHashes).every((hash) => hash.length === 64),
      detail: 'module hashes present or unused',
    },
    {
      id: 'codec',
      ok: !pending || pending.codecs.every((codec) => input.node.codecIds.includes(codec.codecId)),
      detail: 'codec support',
    },
    {
      id: 'cryptosuite',
      ok: !pending || !pending.cryptoSchedule || input.node.suiteIds.includes(pending.cryptoSchedule.suiteId),
      detail: 'CryptoSuite support',
    },
    {
      id: 'state-migration',
      ok: !pending || !pending.stateMigrationHash || input.node.migrationHashes.includes(pending.stateMigrationHash),
      detail: 'state migration support',
    },
    { id: 'disk-space', ok: diskOk, detail: diskOk ? 'disk above operator threshold' : 'disk below operator threshold' },
    { id: 'snapshot-availability', ok: input.snapshotAvailable, detail: 'snapshot availability' },
    { id: 'signer-compatibility', ok: signerCompatible, detail: 'signer compatibility' },
  ];
  return {
    currentProtocolVersion: input.manager.protocolVersion,
    pendingUpgrade: pending?.upgradeId ?? null,
    activationHeight: pending?.activationHeight ?? null,
    binaryCompatible: checks[0]!.ok,
    artifactHash: pending?.releaseArtifactHash ?? null,
    readiness: readiness?.status ?? 'NONE',
    diskOk,
    snapshotAvailable: input.snapshotAvailable,
    signerCompatible,
    checks,
  };
}

export function reportIncompatibleBinary(plan: UpgradePlan): OpsResult<never> {
  const readiness = assessReadiness(plan, incompatibleNodeCapability());
  return opsErr('INCOMPATIBLE_BINARY', `${readiness.status}: ${readiness.detail}`);
}

export function authorizeDevelopmentUpgrade(manager: UpgradeManager, plan: UpgradePlan): UpgradePlan {
  const policy = manager.policy;
  const operator = actorById(policy, 'gov_operator_1');
  manager.propose(plan, operator);
  const validated = manager.validate(plan.upgradeId);
  if (validated.status === 'FAILED_VALIDATION') {
    throw new Error(`upgrade failed validation: ${validated.authorizationState}`);
  }
  for (const id of ['gov_validator_1', 'gov_validator_2', 'gov_validator_3'] as const) {
    manager.castVote({
      upgradeId: plan.upgradeId,
      voter: actorById(policy, id),
      seed: seedForActor(id),
      choice: 'APPROVE',
    });
  }
  manager.schedule(plan.upgradeId, operator);
  const scheduled = manager.plans.get(plan.upgradeId);
  if (!scheduled) {
    throw new Error('upgrade missing after schedule');
  }
  return scheduled;
}

export function developmentUpgradeFixture(activationHeight = 20): {
  readonly manager: UpgradeManager;
  readonly plan: UpgradePlan;
  readonly compatible: NodeCapability;
  readonly incompatible: NodeCapability;
} {
  const policy = developmentGovernancePolicy();
  const manager = new UpgradeManager(policy, 8, 1);
  const plan = createDraftPlan({
    upgradeId: 'upg_ops_v2',
    upgradeKind: 'HARD_PROTOCOL_CUTOVER',
    currentProtocolVersion: 1,
    targetProtocolVersion: 2,
    proposalHeight: 8,
    activationHeight,
    policy,
    artifactLabel: 'sunrey-node-v2-dev',
    newModuleHashes: { consensus: 'ab'.repeat(32) },
    stateMigration: {
      version: 1,
      contentHash: 'cd'.repeat(32),
      fromProtocolVersion: 1,
      toProtocolVersion: 2,
      preStateRequirement: '11'.repeat(32),
      postStateRoot: '22'.repeat(32),
    },
  });
  return {
    manager,
    plan,
    compatible: developmentNodeCapability(plan),
    incompatible: incompatibleNodeCapability(),
  };
}
