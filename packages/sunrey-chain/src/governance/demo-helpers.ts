import {
  UpgradeManager,
  actorById,
  applyStateMigration,
  assessReadiness,
  createDraftPlan,
  developmentGovernancePolicy,
  developmentNodeCapability,
  developmentParams,
  hashConsensusParams,
  incompatibleNodeCapability,
  seedForActor,
  sha256Hex,
} from './engine.ts';
import type { ConsensusParams, StateMigrationSpec } from './types.ts';

function authorize(manager: UpgradeManager, upgradeId: string, voters = [1, 2, 3]): void {
  for (const n of voters) {
    const actor = actorById(manager.policy, `gov_validator_${n}`);
    manager.castVote({
      upgradeId,
      voter: actor,
      seed: seedForActor(actor.actorId),
      choice: 'APPROVE',
    });
  }
}

export function runParameterUpgradeDemo(): {
  readonly beforeHash: string;
  readonly afterHash: string;
  readonly activatedAt: number;
  readonly roots: readonly string[];
} {
  const policy = developmentGovernancePolicy();
  const managers = [0, 1, 2, 3].map(() => new UpgradeManager(policy, 2, 1));
  const next: ConsensusParams = Object.freeze({
    ...developmentParams(),
    maxTransactions: 64,
    timeoutProposeMs: 2_000,
  });
  const plan = createDraftPlan({
    upgradeId: 'upg_param_h8',
    upgradeKind: 'CONSENSUS_PARAMETER_CHANGE',
    currentProtocolVersion: 1,
    targetProtocolVersion: 1,
    proposalHeight: 2,
    activationHeight: 8,
    policy,
    consensusParams: next,
  });
  const operator = actorById(policy, 'gov_operator_1');
  for (const manager of managers) {
    manager.propose(plan, operator);
    manager.validate(plan.upgradeId);
    authorize(manager, plan.upgradeId);
    manager.schedule(plan.upgradeId, operator);
  }
  const beforeHash = hashConsensusParams(developmentParams());
  const roots: string[] = [];
  let afterHash = beforeHash;
  let activatedAt = 0;
  for (let height = 3; height <= 10; height += 1) {
    const nodeRoots: string[] = [];
    for (const manager of managers) {
      const commits = manager.activateAt(height, developmentNodeCapability(plan));
      nodeRoots.push(JSON.stringify(commits));
      if (height < 8 && commits.consensusParamsHash !== beforeHash) {
        throw new Error('parameter hash changed before activation height');
      }
      if (height >= 8) {
        afterHash = commits.consensusParamsHash;
        activatedAt = 8;
      }
    }
    if (new Set(nodeRoots).size !== 1) {
      throw new Error('validators diverged');
    }
    roots.push(nodeRoots[0]!);
  }
  if (afterHash === beforeHash) {
    throw new Error('parameter hash did not change at activation');
  }
  return { beforeHash, afterHash, activatedAt, roots };
}

export function runModuleUpgradeDemo(): { readonly oldHash: string; readonly newHash: string } {
  const policy = developmentGovernancePolicy();
  const manager = new UpgradeManager(policy, 1, 1);
  const oldHash = manager.commitments().moduleRegistryHash;
  const migration: StateMigrationSpec = Object.freeze({
    version: 1,
    contentHash: sha256Hex('module-migration-v1'),
    fromProtocolVersion: 1,
    toProtocolVersion: 2,
    preStateRequirement: sha256Hex(Buffer.from('pre-module')),
    postStateRoot: sha256Hex(Buffer.from('post-module')),
  });
  const plan = createDraftPlan({
    upgradeId: 'upg_module_h6',
    upgradeKind: 'MODULE_REPLACE',
    currentProtocolVersion: 1,
    targetProtocolVersion: 2,
    proposalHeight: 1,
    activationHeight: 6,
    policy,
    modules: [
      {
        moduleId: 'native.system',
        version: '2',
        artifactHash: sha256Hex('native.system.v2'),
        schemaHash: sha256Hex('native.system.schema.v2'),
        activationHeight: 6,
        deactivationHeight: null,
      },
    ],
    affectedModules: ['native.system'],
    newModuleHashes: { 'native.system': sha256Hex('native.system.v2') },
    stateMigration: migration,
  });
  const operator = actorById(policy, 'gov_operator_1');
  manager.propose(plan, operator);
  manager.validate(plan.upgradeId);
  authorize(manager, plan.upgradeId);
  manager.schedule(plan.upgradeId, operator);
  applyStateMigration(migration, Buffer.from('pre-module'), () => Buffer.from('post-module'));
  for (let height = 2; height <= 6; height += 1) {
    manager.activateAt(height, developmentNodeCapability(plan));
  }
  return { oldHash, newHash: manager.commitments().moduleRegistryHash };
}

export function runIncompatibleNodeDemo(): {
  readonly before: string;
  readonly atActivation: string;
  readonly afterUpgrade: string;
} {
  const policy = developmentGovernancePolicy();
  const honest = new UpgradeManager(policy, 1, 1);
  const lagging = new UpgradeManager(policy, 1, 1);
  const plan = createDraftPlan({
    upgradeId: 'upg_incompat_h7',
    upgradeKind: 'PARAMETER_CHANGE',
    currentProtocolVersion: 1,
    targetProtocolVersion: 2,
    proposalHeight: 1,
    activationHeight: 7,
    policy,
    consensusParams: { ...developmentParams(), maxBlockBytes: 256_000 },
  });
  const operator = actorById(policy, 'gov_operator_1');
  for (const manager of [honest, lagging]) {
    manager.propose(plan, operator);
    manager.validate(plan.upgradeId);
    authorize(manager, plan.upgradeId);
    manager.schedule(plan.upgradeId, operator);
  }
  const before = assessReadiness(plan, incompatibleNodeCapability()).status;
  let atActivation = 'READY';
  try {
    lagging.activateAt(7, incompatibleNodeCapability());
  } catch (error) {
    atActivation = error instanceof Error ? error.message : 'failed';
  }
  honest.activateAt(7, developmentNodeCapability(plan));
  lagging.activateAt(7, developmentNodeCapability(plan));
  return {
    before,
    atActivation,
    afterUpgrade: assessReadiness(plan, developmentNodeCapability(plan)).status,
  };
}
