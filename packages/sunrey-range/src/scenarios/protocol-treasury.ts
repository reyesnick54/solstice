import { ProtocolTreasuryEngine, developmentCycle } from '../../../sunrey-chain/src/economics/treasury/engine.ts';
import { aiActor, humanGovernanceActor } from '../../../sunrey-chain/src/economics/treasury/policy.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { actor, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

const HUMAN = humanGovernanceActor();

function engine(): ProtocolTreasuryEngine {
  const treasury = new ProtocolTreasuryEngine();
  treasury.fund({
    fundingId: 'range-open',
    source: 'EXPLICIT_APPROVED_GENESIS_ALLOCATION',
    asset: 'SUNREY_COIN',
    reserveClass: 'PROTOCOL_OPERATIONS_RESERVE',
    quantity: 1_000n,
    epoch: 0n,
    height: 0n,
    evidenceRef: 'range:open',
    monetaryPolicyVersion: 'sunrey.monetary.constitution.v1',
  });
  treasury.proposeBudget(
    {
      budgetId: 'range-budget',
      asset: 'SUNREY_COIN',
      reserveClass: 'PROTOCOL_OPERATIONS_RESERVE',
      purpose: 'PROTOCOL_INFRASTRUCTURE',
      maximumAuthorizedQuantity: 400n,
      cycle: developmentCycle('range-cycle'),
      recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
      evidenceRefs: ['range:budget'],
      governanceProposalRef: 'gov:range',
    },
    HUMAN,
  );
  treasury.approveBudget('range-budget', HUMAN);
  return treasury;
}

export const protocolTreasuryScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'TREASURY-MINT-ATTEMPT',
    category: 'INVARIANT_VALIDATION',
    seed: 7701,
    subsystem: 'protocol-treasury',
    attack: 'treasury mint',
    actors: [actor('ai', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'ai', 'mint')],
    expectedSecurityProperties: ['NO_TREASURY_MINT'],
    expectedDetections: [detection('reconciliation', 'TREASURY_MINT_UNAVAILABLE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveOnly: true,
    preventiveControl: 'treasury mint unavailable',
    detectiveControl: 'treasury verify',
    recovery: 'none',
  }),
  defineScenario({
    scenarioId: 'TREASURY-DUPLICATE-DISBURSE',
    category: 'INVARIANT_VALIDATION',
    seed: 7702,
    subsystem: 'protocol-treasury',
    attack: 'duplicate disbursement',
    actors: [actor('gov', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'gov', 'duplicate-disburse')],
    expectedSecurityProperties: ['NO_TREASURY_DOUBLE_SPEND'],
    expectedDetections: [detection('reconciliation', 'DUPLICATE_DISBURSEMENT_REJECTED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveOnly: true,
    preventiveControl: 'intent identity binding',
    detectiveControl: 'treasury verify',
    recovery: 'none',
  }),
  defineScenario({
    scenarioId: 'TREASURY-UNAUTHORIZED-DISBURSE',
    category: 'GOVERNANCE_ABUSE',
    seed: 7703,
    subsystem: 'protocol-treasury',
    attack: 'AI approval',
    actors: [actor('ai', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'ai', 'approve-budget')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_TREASURY_SPEND'],
    expectedDetections: [detection('reconciliation', 'AI_APPROVAL_REJECTED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveOnly: true,
    preventiveControl: 'human governance required',
    detectiveControl: 'treasury verify',
    recovery: 'none',
  }),
  defineScenario({
    scenarioId: 'TREASURY-CUSTOMER-CLAIM',
    category: 'INVARIANT_VALIDATION',
    seed: 7704,
    subsystem: 'protocol-treasury',
    attack: 'customer asset claim',
    actors: [actor('treasury', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'treasury', 'claim-customer')],
    expectedSecurityProperties: ['NO_CUSTOMER_ASSET_TREASURY_CLAIM'],
    expectedDetections: [detection('reconciliation', 'CUSTOMER_ASSETS_UNREACHABLE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveOnly: true,
    preventiveControl: 'customer-asset isolation',
    detectiveControl: 'treasury verify',
    recovery: 'none',
  }),
];

export function runProtocolTreasury(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const treasury = engine();
  let attackBlocked = false;
  let code = 'UNKNOWN';
  switch (scenario.scenarioId) {
    case 'TREASURY-MINT-ATTEMPT': {
      const result = treasury.attemptMint('SUNREY_COIN', 1n);
      attackBlocked = !result.ok;
      code = result.ok ? 'ACCEPTED' : result.code;
      break;
    }
    case 'TREASURY-DUPLICATE-DISBURSE': {
      treasury.createIntent(
        {
          intentId: 'range-dup',
          budgetId: 'range-budget',
          recipient: 'acct.a',
          recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
          asset: 'SUNREY_COIN',
          quantity: 10n,
          purpose: 'PROTOCOL_INFRASTRUCTURE',
          expirationEpoch: 10n,
        },
        HUMAN,
      );
      const again = treasury.createIntent(
        {
          intentId: 'range-dup',
          budgetId: 'range-budget',
          recipient: 'acct.b',
          recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
          asset: 'SUNREY_COIN',
          quantity: 11n,
          purpose: 'PROTOCOL_INFRASTRUCTURE',
          expirationEpoch: 10n,
        },
        HUMAN,
      );
      attackBlocked = !again.ok;
      code = again.ok ? 'ACCEPTED' : again.code;
      break;
    }
    case 'TREASURY-UNAUTHORIZED-DISBURSE': {
      const result = treasury.approveBudget('range-budget', aiActor());
      attackBlocked = !result.ok;
      code = result.ok ? 'ACCEPTED' : result.code;
      break;
    }
    case 'TREASURY-CUSTOMER-CLAIM': {
      const result = treasury.attemptCustomerClaim('CUSTOMER_WALLET_HOLDINGS');
      attackBlocked = !result.ok;
      code = result.ok ? 'ACCEPTED' : result.code;
      break;
    }
    default:
      throw new Error(`unsupported ${scenario.scenarioId}`);
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
    detections: [{ channel: 'reconciliation', code, observed: attackBlocked, detail: code }],
    recovery: recovery('NONE_PREVENTIVE', true, true, true, code),
    notes: `${scenario.scenarioId} ${code}`,
  });
}
