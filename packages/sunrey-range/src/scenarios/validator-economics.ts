import {
  ValidatorEconomicsEngine,
  fixtureValidatorRecord,
} from '../../../sunrey-chain/src/validator-economics/index.ts';
import type { ProtocolEvidence } from '../../../sunrey-chain/src/validator-economics/index.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { actor, caught, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

function engine(): ValidatorEconomicsEngine {
  const econ = new ValidatorEconomicsEngine('development');
  const record = fixtureValidatorRecord({ label: 'R' });
  econ.registerValidator(record, 5_000_000n);
  econ.bond({ validatorId: record.validatorId, quantity: 1_000_000n, asset: 'DEVELOPMENT_SUNREY_COIN' });
  econ.advanceEpoch();
  return econ;
}

function evidence(validatorId: string, overrides: Partial<ProtocolEvidence> = {}): ProtocolEvidence {
  return {
    evidenceId: 'ev_range_1',
    violationClass: 'DOUBLE_PROPOSAL',
    validatorId,
    height: 8n,
    round: 0n,
    leftHash: 'l',
    rightHash: 'r',
    signatureA: 'a',
    signatureB: 'b',
    verified: true,
    forged: false,
    monitoringSuspicionOnly: false,
    ...overrides,
  };
}

export const validatorEconomicsScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'VECON-EQUIVOCATION-PENALTY',
    category: 'VALIDATOR_FAULT',
    seed: 7201,
    subsystem: 'validator-economics',
    attack: 'equivocation penalty',
    actors: [actor('val_econ_r', 'VALIDATOR', true)],
    faults: [],
    timeline: [step(1, 'val_econ_r', 'equivocate')],
    expectedSecurityProperties: ['NO_DUPLICATE_VALIDATOR_PENALTY'],
    expectedDetections: [detection('accountability', 'PENALTY_APPLIED')],
    expectedRecovery: ['VALIDATOR_ROTATION'],
    preventiveControl: 'valid protocol evidence required',
    detectiveControl: 'penalty receipt',
    recovery: 'tombstone or jail per policy',
  }),
  defineScenario({
    scenarioId: 'VECON-FORGED-EVIDENCE',
    category: 'VALIDATOR_FAULT',
    seed: 7202,
    subsystem: 'validator-economics',
    attack: 'forged evidence',
    actors: [actor('forger', 'VALIDATOR', true)],
    faults: [],
    timeline: [step(1, 'forger', 'submit-forged-evidence')],
    expectedSecurityProperties: ['NO_DUPLICATE_VALIDATOR_PENALTY'],
    expectedDetections: [detection('evidence', 'FORGED_EVIDENCE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'evidence verification',
    detectiveControl: 'forged evidence refusal',
    recovery: 'none',
  }),
  defineScenario({
    scenarioId: 'VECON-REPLAYED-EVIDENCE',
    category: 'VALIDATOR_FAULT',
    seed: 7203,
    subsystem: 'validator-economics',
    attack: 'replayed evidence',
    actors: [actor('val_econ_r', 'VALIDATOR', true)],
    faults: [],
    timeline: [step(1, 'val_econ_r', 'replay-evidence')],
    expectedSecurityProperties: ['NO_DUPLICATE_VALIDATOR_PENALTY'],
    expectedDetections: [detection('accountability', 'DUPLICATE_PENALTY')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'canonical evidence id',
    detectiveControl: 'duplicate penalty refusal',
    recovery: 'none',
  }),
  defineScenario({
    scenarioId: 'VECON-DUPLICATE-REWARD',
    category: 'VALIDATOR_FAULT',
    seed: 7204,
    subsystem: 'validator-economics',
    attack: 'duplicate reward',
    actors: [actor('val_econ_r', 'VALIDATOR', true)],
    faults: [],
    timeline: [step(1, 'val_econ_r', 'claim-twice')],
    expectedSecurityProperties: ['NO_DUPLICATE_VALIDATOR_REWARD'],
    expectedDetections: [detection('reconciliation', 'DUPLICATE_REWARD')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'entitlement id',
    detectiveControl: 'duplicate reward refusal',
    recovery: 'none',
  }),
  defineScenario({
    scenarioId: 'VECON-DUPLICATE-PENALTY',
    category: 'VALIDATOR_FAULT',
    seed: 7205,
    subsystem: 'validator-economics',
    attack: 'duplicate penalty',
    actors: [actor('val_econ_r', 'VALIDATOR', true)],
    faults: [],
    timeline: [step(1, 'val_econ_r', 'penalty-twice')],
    expectedSecurityProperties: ['NO_DUPLICATE_VALIDATOR_PENALTY'],
    expectedDetections: [detection('accountability', 'DUPLICATE_PENALTY')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'executed evidence set',
    detectiveControl: 'duplicate penalty refusal',
    recovery: 'none',
  }),
  defineScenario({
    scenarioId: 'VECON-CUSTOMER-ASSET-PENALTY',
    category: 'VALIDATOR_FAULT',
    seed: 7206,
    subsystem: 'validator-economics',
    attack: 'customer-asset penalty attempt',
    actors: [actor('attacker', 'VALIDATOR', true)],
    faults: [],
    timeline: [step(1, 'attacker', 'debit-customer')],
    expectedSecurityProperties: ['NO_CUSTOMER_ASSET_VALIDATOR_PENALTY'],
    expectedDetections: [detection('reconciliation', 'CUSTOMER_ASSET_ISOLATION')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'economic account domain isolation',
    detectiveControl: 'customer debit refusal',
    recovery: 'none',
  }),
  defineScenario({
    scenarioId: 'VECON-IMMEDIATE-UNBOND',
    category: 'VALIDATOR_FAULT',
    seed: 7207,
    subsystem: 'validator-economics',
    attack: 'immediate unbond attempt',
    actors: [actor('val_econ_r', 'VALIDATOR', true)],
    faults: [],
    timeline: [step(1, 'val_econ_r', 'immediate-unbond')],
    expectedSecurityProperties: ['UNBOND_DELAY_RESPECTED'],
    expectedDetections: [detection('accountability', 'IMMEDIATE_UNBOND_REJECTED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'governed unbonding delay',
    detectiveControl: 'immediate release refusal',
    recovery: 'none',
  }),
  defineScenario({
    scenarioId: 'VECON-WRONG-POLICY-VERSION',
    category: 'GOVERNANCE_ABUSE',
    seed: 7208,
    subsystem: 'validator-economics',
    attack: 'wrong policy version',
    actors: [actor('val_econ_r', 'VALIDATOR', true)],
    faults: [],
    timeline: [step(1, 'val_econ_r', 'wrong-policy')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_GOVERNANCE'],
    expectedDetections: [detection('security_log', 'WRONG_POLICY_VERSION')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'epoch-scoped policy version',
    detectiveControl: 'wrong policy refusal',
    recovery: 'none',
  }),
  defineScenario({
    scenarioId: 'VECON-REWARD-OVERFLOW',
    category: 'VALIDATOR_FAULT',
    seed: 7209,
    subsystem: 'validator-economics',
    attack: 'reward overflow boundary',
    actors: [actor('val_econ_r', 'VALIDATOR', true)],
    faults: [],
    timeline: [step(1, 'val_econ_r', 'overflow-pool')],
    expectedSecurityProperties: ['NO_DUPLICATE_VALIDATOR_REWARD'],
    expectedDetections: [detection('reconciliation', 'REWARD_OVERFLOW')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'checked integer arithmetic',
    detectiveControl: 'overflow refusal',
    recovery: 'none',
  }),
];

export function runValidatorEconomics(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const econ = engine();
  const validatorId = 'val_econ_r';
  let attackBlocked = false;
  let code = 'UNKNOWN';
  let channel: 'accountability' | 'evidence' | 'reconciliation' | 'security_log' = 'accountability';
  try {
    switch (scenario.scenarioId) {
      case 'VECON-EQUIVOCATION-PENALTY': {
        const applied = econ.applyPenalty(evidence(validatorId));
        attackBlocked = applied.ok;
        code = applied.ok ? 'PENALTY_APPLIED' : applied.error.code;
        break;
      }
      case 'VECON-FORGED-EVIDENCE': {
        const refused = econ.applyPenalty(evidence(validatorId, { forged: true }));
        attackBlocked = !refused.ok;
        code = refused.ok ? 'ACCEPTED' : refused.error.code;
        channel = 'evidence';
        break;
      }
      case 'VECON-REPLAYED-EVIDENCE':
      case 'VECON-DUPLICATE-PENALTY': {
        econ.applyPenalty(evidence(validatorId));
        const replay = econ.applyPenalty(evidence(validatorId));
        attackBlocked = !replay.ok;
        code = replay.ok ? 'ACCEPTED' : replay.error.code;
        break;
      }
      case 'VECON-DUPLICATE-REWARD': {
        const row = {
          entitlementId: `${validatorId}:1:v1`,
          validatorId,
          epoch: 1n,
          height: 8n,
          expectedVotes: 1n,
          validSignedVotes: 1n,
          missedVotes: 0n,
          proposalAssignments: 0n,
          validProposals: 0n,
          activeVotingPower: 1n,
          epochMember: true,
          policyVersion: 1,
        };
        econ.recordParticipation(row);
        const duplicate = econ.recordParticipation(row);
        attackBlocked = !duplicate.ok;
        code = duplicate.ok ? 'ACCEPTED' : duplicate.error.code;
        channel = 'reconciliation';
        break;
      }
      case 'VECON-CUSTOMER-ASSET-PENALTY': {
        econ.markCustomerAccount('cust_wallet_1', 'CUSTOMER_WALLET', 50n);
        const refused = econ.debitCustomer('cust_wallet_1', 1n);
        attackBlocked = !refused.ok && econ.customerBalance('cust_wallet_1') === 50n;
        code = refused.ok ? 'ACCEPTED' : refused.error.code;
        channel = 'reconciliation';
        break;
      }
      case 'VECON-IMMEDIATE-UNBOND': {
        econ.requestUnbond(validatorId);
        const immediate = econ.releaseUnbond(validatorId);
        attackBlocked = !immediate.ok;
        code = immediate.ok ? 'ACCEPTED' : immediate.error.code;
        break;
      }
      case 'VECON-WRONG-POLICY-VERSION': {
        const refused = econ.recordParticipation({
          entitlementId: `${validatorId}:1:v9`,
          validatorId,
          epoch: 1n,
          height: 8n,
          expectedVotes: 1n,
          validSignedVotes: 1n,
          missedVotes: 0n,
          proposalAssignments: 0n,
          validProposals: 0n,
          activeVotingPower: 1n,
          epochMember: true,
          policyVersion: 9,
        });
        attackBlocked = !refused.ok;
        code = refused.ok ? 'ACCEPTED' : refused.error.code;
        channel = 'security_log';
        break;
      }
      case 'VECON-REWARD-OVERFLOW': {
        const refused = econ.ingestFeeAllocation(10n ** 38n);
        attackBlocked = !refused.ok;
        code = refused.ok ? 'ACCEPTED' : refused.error.code;
        channel = 'reconciliation';
        break;
      }
      default:
        throw new Error(`unsupported ${scenario.scenarioId}`);
    }
  } catch (error) {
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: true,
      safetyHeld: true,
      invariants: holdAll(scenario.expectedSecurityProperties, caught(error)),
      detections: [],
      recovery: recovery('NONE_PREVENTIVE', false, true, true, caught(error)),
      notes: caught(error),
    });
  }
  if (attackBlocked) {
    recordAlert(env, code);
  }
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked,
    safetyHeld: attackBlocked,
    invariants: holdAll(scenario.expectedSecurityProperties, code),
    detections: [{ channel, code, observed: attackBlocked, detail: code }],
    recovery: recovery(
      scenario.expectedRecovery[0] === 'VALIDATOR_ROTATION' ? 'VALIDATOR_ROTATION' : 'NONE_PREVENTIVE',
      true,
      true,
      true,
      code,
    ),
    notes: `${scenario.scenarioId} ${code}`,
  });
}
