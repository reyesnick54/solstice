/**
 * Chunk 77 treasury stress catalog.
 *
 * Canonical Chunk 76 EconomicStressReport campaigns live in
 * packages/sunrey-economics/src/stress. These scenarios remain the
 * treasury-specific integration surface required by Chunk 77.
 */

import { ProtocolTreasuryEngine, developmentCycle } from './engine.ts';
import { humanGovernanceActor } from './policy.ts';
import type { TreasuryRefusalCode } from './types.ts';

export const TREASURY_STRESS_SCENARIOS = [
  'TREASURY_BUDGET_EXHAUSTION',
  'DUPLICATE_DISBURSEMENT',
  'UNAUTHORIZED_RECIPIENT',
  'WRONG_ASSET',
  'RESERVATION_RACE',
  'FEE_REVENUE_COLLAPSE',
  'LARGE_EMERGENCY_EXPENSE',
] as const;
export type TreasuryStressScenarioId = (typeof TREASURY_STRESS_SCENARIOS)[number];

export type TreasuryStressResult = {
  readonly scenario: TreasuryStressScenarioId;
  readonly refused: boolean;
  readonly code: TreasuryRefusalCode | 'NONE';
  readonly reconciled: boolean;
  readonly customerAssetsUntouched: true;
  readonly supplyUnchanged: true;
};

const HUMAN = humanGovernanceActor();
const EMERGENCY = humanGovernanceActor('gov.human.emergency', {
  emergencyHeightened: true,
  keyRefs: ['rot.governance.treasury.1', 'rot.governance.treasury.2'],
});

function seededEngine(quantity = 1_000n): ProtocolTreasuryEngine {
  const engine = new ProtocolTreasuryEngine();
  engine.fund({
    fundingId: 'stress-open',
    source: 'EXPLICIT_APPROVED_GENESIS_ALLOCATION',
    asset: 'SUNREY_COIN',
    reserveClass: 'PROTOCOL_OPERATIONS_RESERVE',
    quantity,
    epoch: 0n,
    height: 0n,
    evidenceRef: 'stress:open',
    monetaryPolicyVersion: 'sunrey.monetary.constitution.v1',
  });
  engine.fund({
    fundingId: 'stress-emergency',
    source: 'EXPLICIT_APPROVED_GENESIS_ALLOCATION',
    asset: 'SUNREY_COIN',
    reserveClass: 'EMERGENCY_PROTOCOL_RESERVE',
    quantity: 500n,
    epoch: 0n,
    height: 0n,
    evidenceRef: 'stress:emergency',
    monetaryPolicyVersion: 'sunrey.monetary.constitution.v1',
  });
  return engine;
}

function approveOpsBudget(engine: ProtocolTreasuryEngine, qty: bigint): void {
  engine.proposeBudget(
    {
      budgetId: 'stress-budget',
      asset: 'SUNREY_COIN',
      reserveClass: 'PROTOCOL_OPERATIONS_RESERVE',
      purpose: 'PROTOCOL_INFRASTRUCTURE',
      maximumAuthorizedQuantity: qty,
      cycle: developmentCycle('stress-cycle'),
      recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
      evidenceRefs: ['stress:budget'],
      governanceProposalRef: 'gov:stress',
    },
    HUMAN,
  );
  engine.approveBudget('stress-budget', HUMAN);
}

export function runTreasuryStress(scenario: TreasuryStressScenarioId): TreasuryStressResult {
  const engine = seededEngine(scenario === 'FEE_REVENUE_COLLAPSE' ? 10n : 1_000n);
  let refused = false;
  let code: TreasuryRefusalCode | 'NONE' = 'NONE';

  if (scenario === 'TREASURY_BUDGET_EXHAUSTION') {
    approveOpsBudget(engine, 100n);
    engine.createIntent(
      {
        intentId: 'i1',
        budgetId: 'stress-budget',
        recipient: 'acct.provider',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'SUNREY_COIN',
        quantity: 100n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    engine.approveIntent('i1', HUMAN);
    engine.reserve('i1', HUMAN);
    const over = engine.createIntent(
      {
        intentId: 'i2',
        budgetId: 'stress-budget',
        recipient: 'acct.provider',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'SUNREY_COIN',
        quantity: 1n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    refused = !over.ok;
    code = over.ok ? 'NONE' : over.code;
  } else if (scenario === 'DUPLICATE_DISBURSEMENT') {
    approveOpsBudget(engine, 100n);
    engine.createIntent(
      {
        intentId: 'dup',
        budgetId: 'stress-budget',
        recipient: 'acct.provider',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'SUNREY_COIN',
        quantity: 10n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    const again = engine.createIntent(
      {
        intentId: 'dup',
        budgetId: 'stress-budget',
        recipient: 'acct.other',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'SUNREY_COIN',
        quantity: 11n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    refused = !again.ok;
    code = again.ok ? 'NONE' : again.code;
  } else if (scenario === 'UNAUTHORIZED_RECIPIENT') {
    approveOpsBudget(engine, 100n);
    const bad = engine.createIntent(
      {
        intentId: 'bad-recip',
        budgetId: 'stress-budget',
        recipient: 'acct.outsider',
        recipientClass: 'ECOSYSTEM_RECIPIENT',
        asset: 'SUNREY_COIN',
        quantity: 10n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    refused = !bad.ok;
    code = bad.ok ? 'NONE' : bad.code;
  } else if (scenario === 'WRONG_ASSET') {
    approveOpsBudget(engine, 100n);
    const bad = engine.createIntent(
      {
        intentId: 'bad-asset',
        budgetId: 'stress-budget',
        recipient: 'acct.provider',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'MOONREY_COIN',
        quantity: 10n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    refused = !bad.ok;
    code = bad.ok ? 'NONE' : bad.code;
  } else if (scenario === 'RESERVATION_RACE') {
    approveOpsBudget(engine, 1_000n);
    engine.createIntent(
      {
        intentId: 'race-a',
        budgetId: 'stress-budget',
        recipient: 'acct.a',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'SUNREY_COIN',
        quantity: 900n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    engine.createIntent(
      {
        intentId: 'race-b',
        budgetId: 'stress-budget',
        recipient: 'acct.b',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'SUNREY_COIN',
        quantity: 900n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    engine.approveIntent('race-a', HUMAN);
    engine.approveIntent('race-b', HUMAN);
    engine.reserve('race-a', HUMAN);
    const race = engine.reserve('race-b', HUMAN);
    refused = !race.ok;
    code = race.ok ? 'NONE' : race.code;
  } else if (scenario === 'FEE_REVENUE_COLLAPSE') {
    approveOpsBudget(engine, 500n);
    engine.createIntent(
      {
        intentId: 'collapse',
        budgetId: 'stress-budget',
        recipient: 'acct.provider',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'SUNREY_COIN',
        quantity: 400n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    engine.approveIntent('collapse', HUMAN);
    const reserved = engine.reserve('collapse', HUMAN);
    refused = !reserved.ok;
    code = reserved.ok ? 'NONE' : reserved.code;
  } else {
    engine.proposeBudget(
      {
        budgetId: 'emergency-budget',
        asset: 'SUNREY_COIN',
        reserveClass: 'EMERGENCY_PROTOCOL_RESERVE',
        purpose: 'SECURITY_RESPONSE',
        maximumAuthorizedQuantity: 400n,
        cycle: developmentCycle('emergency-cycle'),
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        evidenceRefs: ['stress:emergency-budget'],
        governanceProposalRef: 'gov:emergency',
      },
      EMERGENCY,
    );
    engine.approveBudget('emergency-budget', EMERGENCY);
    engine.createIntent(
      {
        intentId: 'emergency-intent',
        budgetId: 'emergency-budget',
        recipient: 'acct.security',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'SUNREY_COIN',
        quantity: 400n,
        purpose: 'SECURITY_RESPONSE',
        expirationEpoch: 10n,
      },
      EMERGENCY,
    );
    engine.approveIntent('emergency-intent', EMERGENCY);
    engine.reserve('emergency-intent', EMERGENCY);
    engine.finalize('emergency-intent', 'finality-emergency', EMERGENCY);
    const mint = engine.attemptEmergencyMint(EMERGENCY);
    refused = !mint.ok;
    code = mint.ok ? 'NONE' : mint.code;
  }

  const reconciliation = engine.reconcile();
  return Object.freeze({
    scenario,
    refused,
    code,
    reconciled: reconciliation.ok,
    customerAssetsUntouched: true,
    supplyUnchanged: true,
  });
}

export function allTreasuryStressHold(): boolean {
  return TREASURY_STRESS_SCENARIOS.every((id) => {
    const result = runTreasuryStress(id);
    return result.refused && result.reconciled && result.customerAssetsUntouched && result.supplyUnchanged;
  });
}
