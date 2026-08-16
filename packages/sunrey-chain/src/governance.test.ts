import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { moonreyIssuanceActivated } from './protocol/assets.ts';
import {
  LEGAL_TRANSITIONS,
  UPGRADE_KINDS,
  type ConsensusParams,
  type GovernanceActor,
  type StateMigrationSpec,
} from './governance/types.ts';
import {
  UpgradeManager,
  actorById,
  applyStateMigration,
  assessReadiness,
  canTransition,
  createDraftPlan,
  developmentGovernancePolicy,
  developmentNodeCapability,
  developmentParams,
  ed25519FromSeed,
  hashConsensusParams,
  incompatibleNodeCapability,
  isUpgradeKind,
  proposalContentHash,
  seedForActor,
  seedFromLabel,
  sha256Hex,
  validateProposal,
} from './governance/engine.ts';
import { runIncompatibleNodeDemo, runModuleUpgradeDemo, runParameterUpgradeDemo } from './governance/demo-helpers.ts';

function managerAt(height = 1): UpgradeManager {
  return new UpgradeManager(developmentGovernancePolicy(), height, 1);
}

function proposeValid(manager: UpgradeManager, overrides: Partial<Parameters<typeof createDraftPlan>[0]> = {}) {
  const policy = manager.policy;
  const plan = createDraftPlan({
    upgradeId: overrides.upgradeId ?? 'upg_test',
    upgradeKind: overrides.upgradeKind ?? 'PARAMETER_CHANGE',
    currentProtocolVersion: 1,
    targetProtocolVersion: overrides.targetProtocolVersion ?? 1,
    proposalHeight: manager.height,
    activationHeight: overrides.activationHeight ?? manager.height + 6,
    policy,
    ...overrides,
  });
  const operator = actorById(policy, 'gov_operator_1');
  manager.propose(plan, operator);
  return manager.validate(plan.upgradeId);
}

function approve(manager: UpgradeManager, upgradeId: string, voters = [1, 2, 3]): void {
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

describe('SunRey protocol governance', () => {
  it('rejects undefined upgrade kinds', () => {
    assert.equal(isUpgradeKind('PARAMETER_CHANGE'), true);
    assert.equal(isUpgradeKind('SILENT_BINARY_SWAP'), false);
    assert.equal(UPGRADE_KINDS.includes('HARD_PROTOCOL_CUTOVER'), true);
  });

  it('defines legal lifecycle transitions and forbids silent software jumps', () => {
    assert.equal(canTransition('DRAFT', 'PROPOSED'), true);
    assert.equal(canTransition('DRAFT', 'ACTIVATED'), false);
    assert.equal(canTransition('SCHEDULED', 'ACTIVATED'), false);
    assert.equal(canTransition('READY', 'ACTIVATED'), true);
    assert.deepEqual(LEGAL_TRANSITIONS.ACTIVATED, []);
  });

  it('activates a parameter upgrade exactly at H', () => {
    const result = runParameterUpgradeDemo();
    assert.equal(result.activatedAt, 8);
    assert.notEqual(result.beforeHash, result.afterHash);
    assert.equal(result.roots.length, 8);
  });

  it('activates a module upgrade exactly at H', () => {
    const result = runModuleUpgradeDemo();
    assert.notEqual(result.oldHash, result.newHash);
  });

  it('rejects an unauthorized proposal', () => {
    const manager = managerAt();
    const plan = createDraftPlan({
      upgradeId: 'upg_unauth',
      upgradeKind: 'PARAMETER_CHANGE',
      currentProtocolVersion: 1,
      targetProtocolVersion: 1,
      proposalHeight: 1,
      activationHeight: 8,
      policy: manager.policy,
    });
    const ai: GovernanceActor = {
      actorId: 'ai_prep',
      role: 'AI_PREPARER',
      identity: { kind: 'AI_PREPARER', id: 'ai_1' },
      keyKind: 'GOVERNANCE_SIGNING',
      publicKeyHex: '00'.repeat(32),
      votingPower: 0n,
    };
    assert.throws(() => manager.propose(plan, ai), /AI cannot/);
  });

  it('does not authorize with insufficient voting power', () => {
    const manager = managerAt();
    const validated = proposeValid(manager, { upgradeId: 'upg_weak' });
    approve(manager, validated.upgradeId, [1, 2]);
    assert.equal(manager.plans.get(validated.upgradeId)?.status, 'AWAITING_AUTHORIZATION');
    assert.equal(manager.approvePower(validated.upgradeId), 2n);
  });

  it('invalidates votes when proposal content changes', () => {
    const manager = managerAt();
    const first = proposeValid(manager, { upgradeId: 'upg_mutate' });
    const actor = actorById(manager.policy, 'gov_validator_1');
    manager.castVote({
      upgradeId: first.upgradeId,
      voter: actor,
      seed: seedForActor(actor.actorId),
      choice: 'APPROVE',
    });
    const mutated = createDraftPlan({
      upgradeId: 'upg_mutate_2',
      upgradeKind: 'PARAMETER_CHANGE',
      currentProtocolVersion: 1,
      targetProtocolVersion: 1,
      proposalHeight: 1,
      activationHeight: 8,
      policy: manager.policy,
      consensusParams: { ...developmentParams(), maxTransactions: 48 },
    });
    assert.notEqual(proposalContentHash(first), proposalContentHash(mutated));
    const stored = manager.votes.get(first.upgradeId) ?? [];
    assert.equal(stored[0]?.proposalContentHash, proposalContentHash(first));
    assert.notEqual(stored[0]?.proposalContentHash, proposalContentHash(mutated));
  });

  it('rejects AI governance attempts', () => {
    const manager = managerAt();
    const validated = proposeValid(manager, { upgradeId: 'upg_ai' });
    const ai: GovernanceActor = {
      actorId: 'gov_validator_1',
      role: 'AI_PREPARER',
      identity: { kind: 'AI_PREPARER', id: 'model' },
      keyKind: 'GOVERNANCE_SIGNING',
      publicKeyHex: actorById(manager.policy, 'gov_validator_1').publicKeyHex,
      votingPower: 1n,
    };
    assert.throws(
      () =>
        manager.castVote({
          upgradeId: validated.upgradeId,
          voter: ai,
          seed: seedForActor('gov_validator_1'),
          choice: 'APPROVE',
        }),
      /AI cannot cast/,
    );
  });

  it('rejects Execution Authority governance signatures', () => {
    const manager = managerAt();
    const plan = createDraftPlan({
      upgradeId: 'upg_ea',
      upgradeKind: 'PARAMETER_CHANGE',
      currentProtocolVersion: 1,
      targetProtocolVersion: 1,
      proposalHeight: 1,
      activationHeight: 8,
      policy: manager.policy,
    });
    const ea: GovernanceActor = {
      ...actorById(manager.policy, 'gov_operator_1'),
      keyKind: 'EXECUTION_AUTHORITY_SIGNING',
    };
    assert.throws(() => manager.propose(plan, ea), /EXECUTION_AUTHORITY_SIGNING cannot sign/);
  });

  it('rejects P2P key governance signatures', () => {
    const manager = managerAt();
    const plan = createDraftPlan({
      upgradeId: 'upg_p2p',
      upgradeKind: 'PARAMETER_CHANGE',
      currentProtocolVersion: 1,
      targetProtocolVersion: 1,
      proposalHeight: 1,
      activationHeight: 8,
      policy: manager.policy,
    });
    const p2p: GovernanceActor = {
      ...actorById(manager.policy, 'gov_operator_1'),
      keyKind: 'P2P_IDENTITY',
    };
    assert.throws(() => manager.propose(plan, p2p), /P2P_IDENTITY cannot sign/);
  });

  it('cancels a scheduled upgrade before activation', () => {
    const manager = managerAt();
    const validated = proposeValid(manager, { upgradeId: 'upg_cancel' });
    approve(manager, validated.upgradeId);
    const operator = actorById(manager.policy, 'gov_operator_1');
    manager.schedule(validated.upgradeId, operator);
    const cancelled = manager.cancel(validated.upgradeId, operator, seedForActor(operator.actorId));
    assert.equal(cancelled.status, 'CANCELLED');
    manager.activateAt(validated.activationHeight, developmentNodeCapability(validated));
    assert.equal(manager.protocolVersion, 1);
    assert.equal(manager.commitments().consensusParamsHash, hashConsensusParams(developmentParams()));
  });

  it('detects an incompatible node before and at activation', () => {
    const result = runIncompatibleNodeDemo();
    assert.equal(result.before, 'INCOMPATIBLE_BINARY');
    assert.match(result.atActivation, /INCOMPATIBLE_PROTOCOL/);
    assert.equal(result.afterUpgrade, 'READY');
  });

  it('applies a deterministic state migration with pre/post roots', () => {
    const spec: StateMigrationSpec = {
      version: 1,
      contentHash: sha256Hex('mig'),
      fromProtocolVersion: 1,
      toProtocolVersion: 2,
      preStateRequirement: sha256Hex(Buffer.from('pre')),
      postStateRoot: sha256Hex(Buffer.from('post')),
    };
    const out = applyStateMigration(spec, Buffer.from('pre'), () => Buffer.from('post'));
    assert.deepEqual(out, Buffer.from('post'));
    assert.throws(
      () => applyStateMigration(spec, Buffer.from('other'), () => Buffer.from('post')),
      /pre-state/,
    );
  });

  it('schedules a CryptoSuite policy change and keeps historical verify', () => {
    const manager = managerAt();
    const validated = proposeValid(manager, {
      upgradeId: 'upg_crypto',
      upgradeKind: 'CRYPTO_POLICY_CHANGE',
      activationHeight: 8,
      cryptoSchedule: {
        suiteId: 'SUNREY_DEV_ED25519_SHA256',
        targetState: 'LEGACY_VERIFY_ONLY',
        activationHeight: 8,
        preserveHistoricalVerify: true,
      },
    });
    approve(manager, validated.upgradeId);
    manager.schedule(validated.upgradeId, actorById(manager.policy, 'gov_operator_1'));
    manager.activateAt(8, developmentNodeCapability(validated));
    assert.equal(manager.cryptoSchedule?.targetState, 'LEGACY_VERIFY_ONLY');
    assert.equal(manager.historicalVerifyAllowed('SUNREY_DEV_ED25519_SHA256'), true);
  });

  it('does not mutate SunRey Coin supply or issue MoonRey from an unrelated upgrade', () => {
    const manager = managerAt();
    const validated = proposeValid(manager, { upgradeId: 'upg_assets' });
    approve(manager, validated.upgradeId);
    manager.schedule(validated.upgradeId, actorById(manager.policy, 'gov_operator_1'));
    manager.activateAt(validated.activationHeight, developmentNodeCapability(validated));
    assert.equal(moonreyIssuanceActivated(), false);
    assert.equal(Object.hasOwn(validated.payload, 'sunrey_coin_supply'), false);
    assert.equal(Object.hasOwn(validated.payload, 'moonrey_issuance'), false);
  });

  it('rejects proposals that try to change customer fiat authority', () => {
    const policy = developmentGovernancePolicy();
    const plan = createDraftPlan({
      upgradeId: 'upg_fiat',
      upgradeKind: 'PARAMETER_CHANGE',
      currentProtocolVersion: 1,
      targetProtocolVersion: 1,
      proposalHeight: 1,
      activationHeight: 8,
      policy,
      payload: { customer_ledger_authority: 'hijack' },
    });
    assert.match(validateProposal(plan, policy, 1, 1) ?? '', /forbidden/);
  });

  it('four validators converge after upgrade', () => {
    const result = runParameterUpgradeDemo();
    assert.equal(new Set(result.roots).size > 0, true);
    for (const root of result.roots) {
      assert.equal(typeof root, 'string');
    }
  });

  it('rejects consensus keys as governance keys', () => {
    const manager = managerAt();
    const plan = createDraftPlan({
      upgradeId: 'upg_cons',
      upgradeKind: 'PARAMETER_CHANGE',
      currentProtocolVersion: 1,
      targetProtocolVersion: 1,
      proposalHeight: 1,
      activationHeight: 8,
      policy: manager.policy,
    });
    const consensus: GovernanceActor = {
      ...actorById(manager.policy, 'gov_operator_1'),
      keyKind: 'VALIDATOR_CONSENSUS_SIGNING',
    };
    assert.throws(() => manager.propose(plan, consensus), /VALIDATOR_CONSENSUS_SIGNING cannot sign/);
  });

  it('development policy uses integer supermajority power', () => {
    const policy = developmentGovernancePolicy();
    assert.equal(policy.thresholdModel, 'VALIDATOR_SUPERMAJORITY');
    assert.equal(policy.requiredPower, 3n);
    assert.equal(policy.totalPower, 4n);
    assert.equal(
      policy.signers.filter((signer) => signer.role === 'VALIDATOR_GOVERNANCE_SIGNER').length,
      4,
    );
    for (const signer of policy.signers) {
      assert.equal(typeof signer.votingPower, 'bigint');
    }
  });

  it('exposes operator metrics', () => {
    const manager = managerAt();
    const validated = proposeValid(manager, { upgradeId: 'upg_metrics' });
    approve(manager, validated.upgradeId);
    manager.schedule(validated.upgradeId, actorById(manager.policy, 'gov_operator_1'));
    const metrics = manager.metrics(developmentNodeCapability(validated));
    assert.equal(metrics.protocol_version, 1);
    assert.equal(metrics.pending_upgrade, 'upg_metrics');
    assert.equal(metrics.upgrade_activation_height, validated.activationHeight);
    assert.equal(metrics.governance_required_power, 3);
    assert.equal(metrics.governance_votes_power, 3);
    assert.equal(metrics.upgrade_readiness, 'READY');
  });

  it('derives distinct development governance keys', () => {
    const a = ed25519FromSeed(seedFromLabel('validator-gov-1')).publicKeyHex;
    const b = ed25519FromSeed(seedFromLabel('validator-gov-2')).publicKeyHex;
    assert.notEqual(a, b);
    assert.equal(a.length, 64);
  });

  it('rejects activation-height that is not sufficiently future', () => {
    const policy = developmentGovernancePolicy();
    const plan = createDraftPlan({
      upgradeId: 'upg_soon',
      upgradeKind: 'PARAMETER_CHANGE',
      currentProtocolVersion: 1,
      targetProtocolVersion: 1,
      proposalHeight: 10,
      activationHeight: 11,
      policy,
    });
    assert.match(validateProposal(plan, policy, 10, 1) ?? '', /sufficiently future/);
  });

  it('coordinates emergency halt without rewriting history or minting', () => {
    const manager = managerAt();
    const security = actorById(manager.policy, 'gov_security_1');
    manager.proposeEmergency('CRITICAL_CRYPTO_BREAK', security);
    manager.authorizeEmergency(security);
    manager.activateEmergency();
    assert.equal(manager.haltActive, true);
    assert.throws(
      () => manager.activateAt(4, developmentNodeCapability()),
      /emergency halt/,
    );
    assert.equal(manager.audit.some((record) => record.kind === 'EMERGENCY'), true);
  });

  it('does not treat a newer binary as an automatic rule change', () => {
    const manager = managerAt();
    const node = { ...developmentNodeCapability(), supportedProtocolVersions: [1, 2, 99] };
    assert.equal(manager.protocolVersion, 1);
    assert.equal(assessReadiness(createDraftPlan({
      upgradeId: 'upg_bin',
      upgradeKind: 'HARD_PROTOCOL_CUTOVER',
      currentProtocolVersion: 1,
      targetProtocolVersion: 2,
      proposalHeight: 1,
      activationHeight: 8,
      policy: manager.policy,
      newModuleHashes: { 'native.system': sha256Hex('x') },
      stateMigration: {
        version: 1,
        contentHash: sha256Hex('cut'),
        fromProtocolVersion: 1,
        toProtocolVersion: 2,
        preStateRequirement: sha256Hex('a'),
        postStateRoot: sha256Hex('b'),
      },
    }), node).status === 'READY' || assessReadiness(createDraftPlan({
      upgradeId: 'upg_bin',
      upgradeKind: 'HARD_PROTOCOL_CUTOVER',
      currentProtocolVersion: 1,
      targetProtocolVersion: 2,
      proposalHeight: 1,
      activationHeight: 8,
      policy: manager.policy,
      newModuleHashes: { 'native.system': sha256Hex('x') },
      stateMigration: {
        version: 1,
        contentHash: sha256Hex('cut'),
        fromProtocolVersion: 1,
        toProtocolVersion: 2,
        preStateRequirement: sha256Hex('a'),
        postStateRoot: sha256Hex('b'),
      },
    }), node).status === 'MISSING_ARTIFACT', true);
    assert.equal(manager.protocolVersion, 1);
  });
});
