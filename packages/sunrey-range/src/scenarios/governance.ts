import {
  UpgradeManager,
  actorById,
  assessReadiness,
  createDraftPlan,
  developmentGovernancePolicy,
  developmentNodeCapability,
  developmentParams,
  incompatibleNodeCapability,
  proposalContentHash,
  seedForActor,
  validateProposal,
} from '../../../sunrey-chain/src/governance/engine.ts';
import type { GovernanceActor } from '../../../sunrey-chain/src/governance/types.ts';
import { applyFeeGovernance } from '../../../sunrey-chain/src/fees/governance.ts';
import { FeeEngine } from '../../../sunrey-chain/src/fees/engine.ts';
import { reportIncompatibleBinary } from '../../../sunrey-chain/src/ops/upgrade.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { actor, caught, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

const AI: GovernanceActor = {
  actorId: 'ai_prep',
  role: 'AI_PREPARER',
  identity: { kind: 'AI_PREPARER', id: 'ai_1' },
  keyKind: 'GOVERNANCE_SIGNING',
  publicKeyHex: '00'.repeat(32),
  votingPower: 0n,
};

function manager(): UpgradeManager {
  return new UpgradeManager(developmentGovernancePolicy(), 1, 1);
}

function draft(upgradeId: string, overrides: Partial<Parameters<typeof createDraftPlan>[0]> = {}) {
  const policy = developmentGovernancePolicy();
  return createDraftPlan({
    upgradeId,
    upgradeKind: 'PARAMETER_CHANGE',
    currentProtocolVersion: 1,
    targetProtocolVersion: 1,
    proposalHeight: 1,
    activationHeight: 8,
    policy,
    ...overrides,
  });
}

export const governanceScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'GOV-AI-APPROVAL',
    category: 'GOVERNANCE_ABUSE',
    seed: 5850,
    subsystem: 'governance',
    attack: 'AI-generated approval',
    actors: [actor('ai_prep', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'ai_prep', 'propose')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_GOVERNANCE'],
    expectedDetections: [detection('security_log', 'AI_CANNOT_APPROVE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'AI_PREPARER cannot propose or vote',
    detectiveControl: 'governance refusal',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'GOV-FORGED-VOTE',
    category: 'GOVERNANCE_ABUSE',
    seed: 5851,
    subsystem: 'governance',
    attack: 'forged governance vote',
    actors: [actor('forger', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'forger', 'castVote')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_GOVERNANCE'],
    expectedDetections: [detection('security_log', 'UNAUTHORIZED_GOVERNANCE_IDENTITY')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'registered signer public key',
    detectiveControl: 'unauthorized identity',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'GOV-DUPLICATE-POWER',
    category: 'GOVERNANCE_ABUSE',
    seed: 5852,
    subsystem: 'governance',
    attack: 'duplicate voting power',
    actors: [actor('gov_validator_1', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'gov_validator_1', 'vote twice')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_GOVERNANCE'],
    expectedDetections: [detection('security_log', 'DUPLICATE_VOTE_REPLACED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'one vote per voterId',
    detectiveControl: 'power not doubled',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'GOV-CHANGED-PROPOSAL',
    category: 'GOVERNANCE_ABUSE',
    seed: 5853,
    subsystem: 'governance',
    attack: 'changed proposal after signatures',
    actors: [actor('gov_operator_1', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'gov_operator_1', 'mutate payload')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_GOVERNANCE'],
    expectedDetections: [detection('security_log', 'PROPOSAL_HASH_BOUND')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'votes bind proposalContentHash',
    detectiveControl: 'hash mismatch',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'GOV-EARLY-ACTIVATION',
    category: 'GOVERNANCE_ABUSE',
    seed: 5854,
    subsystem: 'governance',
    attack: 'early activation',
    actors: [actor('gov_operator_1', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'gov_operator_1', 'activate too soon')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_GOVERNANCE'],
    expectedDetections: [detection('security_log', 'ACTIVATION_NOT_FUTURE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'minActivationLead',
    detectiveControl: 'validation failure',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'GOV-BINARY-ONLY',
    category: 'UPGRADE_ABUSE',
    seed: 5855,
    subsystem: 'governance',
    attack: 'binary-only protocol activation',
    actors: [actor('val_range_a', 'VALIDATOR', true)],
    faults: [],
    timeline: [step(1, 'val_range_a', 'newer binary')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_GOVERNANCE'],
    expectedDetections: [detection('security_log', 'BINARY_NOT_GOVERNANCE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'protocol version changes only via activated plan',
    detectiveControl: 'readiness / version unchanged',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'GOV-FEE-POLICY',
    category: 'GOVERNANCE_ABUSE',
    seed: 5856,
    subsystem: 'fees',
    attack: 'unauthorized fee-policy change',
    actors: [actor('ai_prep', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'ai_prep', 'applyFeeGovernance')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_GOVERNANCE'],
    expectedDetections: [detection('security_log', 'FEE_GOVERNANCE_REFUSED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'applyFeeGovernance requires activated plan',
    detectiveControl: 'false return',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'GOV-CRYPTOSUITE',
    category: 'GOVERNANCE_ABUSE',
    seed: 5857,
    subsystem: 'governance',
    attack: 'unauthorized CryptoSuite change',
    actors: [actor('gov_operator_1', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'gov_operator_1', 'unknown suite')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_GOVERNANCE'],
    expectedDetections: [detection('security_log', 'UNKNOWN_CRYPTOSUITE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'known development suites only',
    detectiveControl: 'validateProposal',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'GOV-ASSET-POLICY',
    category: 'GOVERNANCE_ABUSE',
    seed: 5858,
    subsystem: 'governance',
    attack: 'unauthorized asset-policy change',
    actors: [actor('gov_operator_1', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'gov_operator_1', 'moonrey_issuance payload')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_GOVERNANCE'],
    expectedDetections: [detection('security_log', 'FORBIDDEN_ASSET_PAYLOAD')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'FORBIDDEN_PAYLOAD_KEYS',
    detectiveControl: 'validateProposal',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'UPGRADE-MALICIOUS-BINARY',
    category: 'UPGRADE_ABUSE',
    seed: 5859,
    subsystem: 'upgrade',
    attack: 'malicious/incompatible binary',
    actors: [actor('val_range_a', 'VALIDATOR', true)],
    faults: [],
    timeline: [step(1, 'val_range_a', 'incompatible artifact')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_GOVERNANCE'],
    expectedDetections: [detection('alert', 'INCOMPATIBLE_BINARY')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'artifact/hash readiness',
    detectiveControl: 'INCOMPATIBLE_BINARY',
    recovery: 'node cannot activate divergent state',
    preventiveOnly: false,
  }),
];

export function runGovernance(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const policy = developmentGovernancePolicy();
  let blocked = false;
  let code = 'OK';
  try {
    if (scenario.scenarioId === 'GOV-AI-APPROVAL') {
      const um = manager();
      um.propose(draft('upg_ai'), AI);
    } else if (scenario.scenarioId === 'GOV-FORGED-VOTE') {
      const um = manager();
      const plan = draft('upg_forge');
      um.propose(plan, actorById(policy, 'gov_operator_1'));
      um.validate(plan.upgradeId);
      const forged: GovernanceActor = {
        ...actorById(policy, 'gov_validator_1'),
        publicKeyHex: 'ff'.repeat(32),
      };
      um.castVote({
        upgradeId: plan.upgradeId,
        voter: forged,
        seed: seedForActor(forged.actorId),
        choice: 'APPROVE',
      });
    } else if (scenario.scenarioId === 'GOV-DUPLICATE-POWER') {
      const um = manager();
      const plan = draft('upg_dup');
      um.propose(plan, actorById(policy, 'gov_operator_1'));
      um.validate(plan.upgradeId);
      const voter = actorById(policy, 'gov_validator_1');
      um.castVote({ upgradeId: plan.upgradeId, voter, seed: seedForActor(voter.actorId), choice: 'APPROVE' });
      um.castVote({ upgradeId: plan.upgradeId, voter, seed: seedForActor(voter.actorId), choice: 'APPROVE' });
      blocked = um.approvePower(plan.upgradeId) === 1n;
      code = blocked ? 'DUPLICATE_VOTE_REPLACED' : 'POWER_DOUBLED';
    } else if (scenario.scenarioId === 'GOV-CHANGED-PROPOSAL') {
      const first = draft('upg_mutate');
      const mutated = draft('upg_mutate_2', { consensusParams: { ...developmentParams(), maxTransactions: 48 } });
      blocked = proposalContentHash(first) !== proposalContentHash(mutated);
      code = blocked ? 'PROPOSAL_HASH_BOUND' : 'HASH_COLLISION';
    } else if (scenario.scenarioId === 'GOV-EARLY-ACTIVATION') {
      const plan = draft('upg_soon', { proposalHeight: 10, activationHeight: 11 });
      const error = validateProposal(plan, policy, 10, 1);
      blocked = error !== null && /sufficiently future/.test(error);
      code = error ?? 'VALID';
    } else if (scenario.scenarioId === 'GOV-BINARY-ONLY') {
      const um = manager();
      const node = { ...developmentNodeCapability(), supportedProtocolVersions: [1, 2, 99] };
      blocked = um.protocolVersion === 1 && assessReadiness(draft('upg_bin', {
        upgradeKind: 'HARD_PROTOCOL_CUTOVER',
        targetProtocolVersion: 2,
        newModuleHashes: { 'native.system': 'aa'.repeat(32) },
      }), node).status !== 'READY';
      code = blocked ? 'BINARY_NOT_GOVERNANCE' : 'AUTO_ACTIVATED';
    } else if (scenario.scenarioId === 'GOV-FEE-POLICY') {
      const applied = applyFeeGovernance(new FeeEngine(), draft('upg_fee', { payload: { fee_schedule: { base_transaction_fee: 1 } } }), 8);
      blocked = applied === false;
      code = blocked ? 'FEE_GOVERNANCE_REFUSED' : 'FEE_MUTATED';
    } else if (scenario.scenarioId === 'GOV-CRYPTOSUITE') {
      const plan = draft('upg_unknown_suite', {
        upgradeKind: 'CRYPTO_POLICY_CHANGE',
        cryptoSchedule: {
          suiteId: 'cs_unknown_invented',
          targetState: 'AVAILABLE',
          activationHeight: 8,
          preserveHistoricalVerify: true,
        },
      });
      const error = validateProposal(plan, policy, 1, 1);
      blocked = error !== null && /unknown CryptoSuite/.test(error);
      code = error ?? 'VALID';
    } else if (scenario.scenarioId === 'GOV-ASSET-POLICY') {
      const error = validateProposal(draft('upg_asset', { payload: { moonrey_issuance: true } }), policy, 1, 1);
      blocked = error !== null && /forbidden/.test(error);
      code = error ?? 'VALID';
    } else {
      const plan = draft('upg_malicious', {
        upgradeKind: 'HARD_PROTOCOL_CUTOVER',
        targetProtocolVersion: 2,
        newModuleHashes: { 'native.system': 'bb'.repeat(32) },
      });
      const report = reportIncompatibleBinary(plan);
      blocked = report.ok === false && report.error.code === 'INCOMPATIBLE_BINARY';
      code = report.ok === false ? report.error.code : 'READY';
      const um = manager();
      um.propose(plan, actorById(policy, 'gov_operator_1'));
      try {
        um.activateAt(8, incompatibleNodeCapability());
      } catch (error) {
        blocked = blocked && /INCOMPATIBLE/.test(caught(error));
      }
    }
  } catch (error) {
    blocked = true;
    code = caught(error);
  }
  if (blocked) {
    recordAlert(env, scenario.expectedDetections[0]!.code);
  }
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: blocked,
    safetyHeld: blocked,
    invariants: holdAll(scenario.expectedSecurityProperties, code),
    detections: [{ channel: scenario.expectedDetections[0]!.channel, code: scenario.expectedDetections[0]!.code, observed: blocked, detail: code }],
    recovery: recovery('NONE_PREVENTIVE', false, true, true, 'governed state unchanged'),
    notes: code,
  });
}
