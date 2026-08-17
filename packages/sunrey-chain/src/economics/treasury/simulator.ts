/**
 * TreasuryScenarioSimulator — engineering simulation only.
 *
 * Does not claim bank solvency, deposit insurance, or a token-price peg.
 */

import { disposeFeeV2, developmentFeeDispositionPolicyV2 } from '../../fees/v2/disposition.ts';
import { ProtocolTreasuryEngine, developmentCycle } from './engine.ts';
import { developmentTreasuryPolicy, humanGovernanceActor } from './policy.ts';
import { ENGINEERING_SIMULATION } from '../types.ts';
import type { ProtocolReserveClass, TreasurySolvencyMetrics, TreasuryPurposeClass } from './types.ts';

export const TREASURY_SCENARIOS = [
  'NORMAL_PROTOCOL_OPERATIONS',
  'LOW_FEE_INCOME',
  'HIGH_FEE_INCOME',
  'LARGE_INFRASTRUCTURE_BUDGET',
  'VALIDATOR_REWARD_DEMAND',
  'EMERGENCY_SECURITY_EXPENSE',
  'MULTIPLE_COMPETING_BUDGETS',
  'RESERVE_CONCENTRATION',
  'LOW_AVAILABLE_RESERVE',
] as const;
export type TreasuryScenarioId = (typeof TREASURY_SCENARIOS)[number];

export type TreasuryScenarioResult = {
  readonly classification: typeof ENGINEERING_SIMULATION;
  readonly scenario: TreasuryScenarioId;
  readonly ok: boolean;
  readonly epochs: number;
  readonly metrics: TreasurySolvencyMetrics;
  readonly reconciled: boolean;
  readonly notes: readonly string[];
};

const PURPOSE_BY_RESERVE: Record<ProtocolReserveClass, TreasuryPurposeClass> = {
  NETWORK_SECURITY_RESERVE: 'NETWORK_SECURITY',
  VALIDATOR_REWARD_RESERVE: 'VALIDATOR_OPERATIONS',
  PROTOCOL_OPERATIONS_RESERVE: 'PROTOCOL_INFRASTRUCTURE',
  ECOSYSTEM_PROGRAM_RESERVE: 'ECOSYSTEM_PROGRAM',
  EMERGENCY_PROTOCOL_RESERVE: 'SECURITY_RESPONSE',
  FEE_TREASURY_RESERVE: 'PROTOCOL_INFRASTRUCTURE',
  OTHER_GOVERNED_RESERVE: 'OTHER_GOVERNED_PURPOSE',
};

export class TreasuryScenarioSimulator {
  run(scenario: TreasuryScenarioId, epochs = 8): TreasuryScenarioResult {
    const engine = new ProtocolTreasuryEngine(developmentTreasuryPolicy());
    const human = humanGovernanceActor();
    const emergency = humanGovernanceActor('gov.human.emergency', {
      emergencyHeightened: true,
      keyRefs: ['rot.governance.treasury.1', 'rot.governance.treasury.2'],
    });
    const notes: string[] = [];
    const feeIncome = scenario === 'LOW_FEE_INCOME' || scenario === 'FEE_REVENUE_COLLAPSE' || scenario === 'LOW_AVAILABLE_RESERVE'
      ? 40n
      : scenario === 'HIGH_FEE_INCOME'
        ? 4_000n
        : 400n;
    const infra = scenario === 'LARGE_INFRASTRUCTURE_BUDGET' ? 2_000n : 200n;
    const validatorDemand = scenario === 'VALIDATOR_REWARD_DEMAND' ? 1_500n : 150n;
    const emergencyQty = scenario === 'EMERGENCY_SECURITY_EXPENSE' ? 800n : 80n;

    engine.fund({
      fundingId: 'genesis-treasury-1',
      source: 'EXPLICIT_APPROVED_GENESIS_ALLOCATION',
      asset: 'SUNREY_COIN',
      reserveClass: 'PROTOCOL_OPERATIONS_RESERVE',
      quantity: scenario === 'RESERVE_CONCENTRATION' ? 10_000n : 2_000n,
      epoch: 0n,
      height: 0n,
      evidenceRef: 'genesis:treasury',
      monetaryPolicyVersion: 'sunrey.monetary.constitution.v1',
    });
    engine.fund({
      fundingId: 'genesis-validator-1',
      source: 'EXPLICIT_APPROVED_GENESIS_ALLOCATION',
      asset: 'SUNREY_COIN',
      reserveClass: 'VALIDATOR_REWARD_RESERVE',
      quantity: 1_000n,
      epoch: 0n,
      height: 0n,
      evidenceRef: 'genesis:validator',
      monetaryPolicyVersion: 'sunrey.monetary.constitution.v1',
    });
    engine.fund({
      fundingId: 'genesis-emergency-1',
      source: 'EXPLICIT_APPROVED_GENESIS_ALLOCATION',
      asset: 'SUNREY_COIN',
      reserveClass: 'EMERGENCY_PROTOCOL_RESERVE',
      quantity: 1_000n,
      epoch: 0n,
      height: 0n,
      evidenceRef: 'genesis:emergency',
      monetaryPolicyVersion: 'sunrey.monetary.constitution.v1',
    });

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
      engine.advance(BigInt(epoch), BigInt(epoch * 10));
      const disposition = disposeFeeV2(developmentFeeDispositionPolicyV2(), 'SUNREY_COIN', feeIncome);
      engine.applyFeeDispositionV2(disposition, `fee-${epoch}`, BigInt(epoch), BigInt(epoch * 10));
    }

    const budgets: Array<{
      id: string;
      reserve: ProtocolReserveClass;
      qty: bigint;
      recipient: 'VALIDATOR_OPERATOR' | 'PROTOCOL_SERVICE_PROVIDER' | 'ECOSYSTEM_RECIPIENT';
      actor: ReturnType<typeof humanGovernanceActor>;
    }> = [
      {
        id: 'budget-infra',
        reserve: 'PROTOCOL_OPERATIONS_RESERVE',
        qty: infra,
        recipient: 'PROTOCOL_SERVICE_PROVIDER',
        actor: human,
      },
      {
        id: 'budget-validator',
        reserve: 'VALIDATOR_REWARD_RESERVE',
        qty: validatorDemand,
        recipient: 'VALIDATOR_OPERATOR',
        actor: human,
      },
    ];
    if (scenario === 'MULTIPLE_COMPETING_BUDGETS' || scenario === 'NORMAL_PROTOCOL_OPERATIONS') {
      budgets.push({
        id: 'budget-ecosystem',
        reserve: 'ECOSYSTEM_PROGRAM_RESERVE',
        qty: 100n,
        recipient: 'ECOSYSTEM_RECIPIENT',
        actor: human,
      });
      engine.fund({
        fundingId: 'genesis-eco-1',
        source: 'EXPLICIT_APPROVED_GENESIS_ALLOCATION',
        asset: 'SUNREY_COIN',
        reserveClass: 'ECOSYSTEM_PROGRAM_RESERVE',
        quantity: 300n,
        epoch: 0n,
        height: 0n,
        evidenceRef: 'genesis:eco',
        monetaryPolicyVersion: 'sunrey.monetary.constitution.v1',
      });
    }
    if (scenario === 'EMERGENCY_SECURITY_EXPENSE') {
      budgets.push({
        id: 'budget-emergency',
        reserve: 'EMERGENCY_PROTOCOL_RESERVE',
        qty: emergencyQty,
        recipient: 'PROTOCOL_SERVICE_PROVIDER',
        actor: emergency,
      });
    }

    for (const row of budgets) {
      const proposed = engine.proposeBudget(
        {
          budgetId: row.id,
          asset: 'SUNREY_COIN',
          reserveClass: row.reserve,
          purpose: PURPOSE_BY_RESERVE[row.reserve],
          maximumAuthorizedQuantity: row.qty,
          cycle: developmentCycle(row.id, 1n),
          recipientClass: row.recipient,
          evidenceRefs: [`evidence:${row.id}`],
          governanceProposalRef: `gov:${row.id}`,
        },
        row.actor,
      );
      if (!proposed.ok) {
        notes.push(proposed.code);
        continue;
      }
      const approved = engine.approveBudget(row.id, row.actor);
      if (!approved.ok) {
        notes.push(approved.code);
        continue;
      }
      const spend = scenario === 'LOW_AVAILABLE_RESERVE' ? row.qty : row.qty / 2n === 0n ? row.qty : row.qty / 2n;
      const intent = engine.createIntent(
        {
          intentId: `intent-${row.id}`,
          budgetId: row.id,
          recipient: `acct.${row.recipient.toLowerCase()}`,
          recipientClass: row.recipient,
          asset: 'SUNREY_COIN',
          quantity: spend,
          purpose: PURPOSE_BY_RESERVE[row.reserve],
          expirationEpoch: 64n,
        },
        row.actor,
      );
      if (!intent.ok) {
        notes.push(intent.code);
        continue;
      }
      const authorized = engine.approveIntent(intent.value.intentId, row.actor);
      if (!authorized.ok) {
        notes.push(authorized.code);
        continue;
      }
      const reserved = engine.reserve(intent.value.intentId, row.actor);
      if (!reserved.ok) {
        notes.push(reserved.code);
        continue;
      }
      const finalized = engine.finalize(intent.value.intentId, `finality-${row.id}`, row.actor);
      if (!finalized.ok) {
        notes.push(finalized.code);
      }
    }

    const reconciliation = engine.reconcile();
    return Object.freeze({
      classification: ENGINEERING_SIMULATION,
      scenario,
      ok: reconciliation.ok,
      epochs,
      metrics: engine.solvencyMetrics(),
      reconciled: reconciliation.ok,
      notes: Object.freeze(notes),
    });
  }

  requiredScenarios(): Record<TreasuryScenarioId, TreasuryScenarioResult> {
    const out = {} as Record<TreasuryScenarioId, TreasuryScenarioResult>;
    for (const id of TREASURY_SCENARIOS) {
      out[id] = this.run(id);
    }
    return out;
  }
}

export function simulateAcrossEpochs(epochs: number): TreasuryScenarioResult {
  return new TreasuryScenarioSimulator().run('NORMAL_PROTOCOL_OPERATIONS', epochs);
}
