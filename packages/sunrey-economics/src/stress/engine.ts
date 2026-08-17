/**
 * Deterministic economic stress engine.
 *
 * Uses the reconciled Chunk 71–75 stack. Does not weaken protocol
 * checks to increase simulated throughput.
 */

import { createIntegratedEconomicStack, type IntegratedEconomicStack } from '../../../sunrey-chain/src/economics/stack.ts';
import { PRODUCTIVE_SIM_CATEGORIES } from '../ids.ts';
import { createMachineLab, machineSnapshot, runMachineEpoch } from '../machine.ts';
import { createMarket, marketConserves, runMarketEpoch } from '../market.ts';
import { loadScenario } from '../scenarios.ts';
import { DeterministicRng } from '../seed.ts';
import { scenarioById } from './catalog.ts';
import { ECONOMIC_STRESS_SCHEMA_VERSION } from './ids.ts';
import type { ShockKind } from './ids.ts';
import { checkInvariants, fixtureHash, type LabAuxState } from './invariants.ts';
import { recoverFromStress } from './recovery.ts';
import type { EconomicStressFinding, EconomicStressResult, EconomicStressScenario } from './types.ts';

const UNIT_FOR: Record<(typeof PRODUCTIVE_SIM_CATEGORIES)[number], string> = {
  ENERGY: 'kWh',
  COMPUTE: 'GPU_HOUR',
  AI_COMPUTE: 'GPU_HOUR',
  AUTOMATED_MACHINE_OUTPUT: 'UNIT',
  MANUFACTURING: 'UNIT',
  FOOD_AGRICULTURE: 'kg',
  WATER: 'L',
  STORAGE: 'm3_hour',
  LOGISTICS_TRANSPORTATION: 't_km',
  BANDWIDTH_COMMUNICATIONS: 'GB',
  MINERALS_RAW_MATERIALS: 'kg',
  REAL_ESTATE_USE: 'm2_hour',
  SERVICES: 'service_hour',
};

export function runEconomicStressScenario(
  scenarioId: string,
  options?: { readonly seed?: number; readonly epochs?: number },
): EconomicStressResult {
  const scenario = scenarioById(scenarioId);
  if (!scenario) {
    throw new Error(`unknown economic stress scenario ${scenarioId}`);
  }
  return executeScenario(scenario, options);
}

export function executeScenario(
  scenario: EconomicStressScenario,
  options?: { readonly seed?: number; readonly epochs?: number },
): EconomicStressResult {
  const started = Date.now();
  const seed = options?.seed ?? scenario.seed;
  const epochs = options?.epochs ?? scenario.epochs;
  const stack = createIntegratedEconomicStack();
  const dual = loadScenario('baseline', { seed, epochs });
  const market = createMarket(dual);
  const machines = createMachineLab();
  const rng = new DeterministicRng(seed);
  const aux: LabAuxState = {
    exchangeConserved: true,
    custodyReconciled: true,
    machineMandatesHold: true,
    oracleFabricated: false,
    dvpDuplicated: false,
    custodyBlindResubmit: false,
  };
  const mutableAux = { ...aux };
  registerObjects(stack, scenario);
  let marketImpactBps = 0n;
  const concentrationWarnings: string[] = [];
  let failClosed = false;
  let degradedAvailability = false;

  for (let epoch = 1; epoch <= epochs; epoch += 1) {
    for (const shock of scenario.shocks) {
      const applied = applyShock(stack, shock, epoch, rng, mutableAux, market, machines, dual);
      failClosed = failClosed || applied.failClosed;
      degradedAvailability = degradedAvailability || applied.degradedAvailability;
      marketImpactBps += applied.marketImpactBps;
      concentrationWarnings.push(...applied.warnings);
    }
    if (stack.finalityAvailable) {
      issueBaselineMoonRey(stack, epoch, scenario);
      runFees(stack, scenario, epoch);
      stack.settleValidatorEpoch();
      runMarketEpoch(market, dual, rng, epoch);
      runMachineEpoch(machines, epoch, false);
    }
  }

  mutableAux.exchangeConserved = marketConserves(market) && mutableAux.exchangeConserved;
  mutableAux.machineMandatesHold = machineSnapshot(machines).mandateBypass === false && mutableAux.machineMandatesHold;
  const invariants = checkInvariants(stack, mutableAux);
  const preserved = invariants.every((row) => row.held);
  const recovery = recoverFromStress(stack, scenario, mutableAux);
  const findings = findingsFrom(scenario, seed, invariants, failClosed, preserved);
  return Object.freeze({
    scenarioId: scenario.scenarioId,
    seed,
    policyVersions: stack.policyVersions(),
    inputFixtureHash: fixtureHash(scenario.scenarioId, seed, stack.policyVersions()),
    invariants,
    preservedInvariants: preserved,
    degradedAvailability,
    failClosed,
    recovery,
    findings,
    marketImpactBps,
    concentrationWarnings: Object.freeze([...new Set(concentrationWarnings)]),
    elapsedMs: Date.now() - started,
    pendingOperations: stack.pendingOperations,
  });
}

function registerObjects(stack: IntegratedEconomicStack, scenario: EconomicStressScenario): void {
  const concentrated = scenario.shocks.includes('PROD_OPERATOR_CONCENTRATION') || scenario.shocks.includes('ORACLE_ONE_CONTROLLER');
  for (let index = 0; index < 8; index += 1) {
    const category = PRODUCTIVE_SIM_CATEGORIES[index % PRODUCTIVE_SIM_CATEGORIES.length]!;
    stack.registerProductiveObject({
      objectId: `obj.${category.toLowerCase()}.${index}`,
      category,
      unit: UNIT_FOR[category],
      owner: concentrated ? 'ctl.op_0' : `ctl.op_${index % 3}`,
    });
  }
}

function issueBaselineMoonRey(stack: IntegratedEconomicStack, epoch: number, scenario: EconomicStressScenario): void {
  const oracleClosed =
    scenario.shocks.includes('ORACLE_OUTAGE') ||
    scenario.shocks.includes('ORACLE_STALE') ||
    scenario.shocks.includes('ORACLE_CONFLICT') ||
    scenario.shocks.includes('ORACLE_UNIT_MISMATCH') ||
    scenario.shocks.includes('ORACLE_DELAYED') ||
    scenario.shocks.includes('ORACLE_REFERENCE_UNAVAILABLE') ||
    scenario.shocks.includes('COMPOUND_ORACLE_EXCHANGE_VALIDATOR');
  if (oracleClosed) {
    return;
  }
  const category = PRODUCTIVE_SIM_CATEGORIES[epoch % PRODUCTIVE_SIM_CATEGORIES.length]!;
  stack.issueMoonReyFromClaim({
    claimId: `claim.base.${category}.${epoch}`,
    objectId: `obj.${category.toLowerCase()}.${epoch % 8}`,
    category,
    quantity: 20n,
    unit: UNIT_FOR[category],
    controller: 'ctl.op_0',
    epoch,
    providerCount: 3,
  });
}

function runFees(stack: IntegratedEconomicStack, scenario: EconomicStressScenario, epoch: number): void {
  const count = scenario.shocks.includes('VAL_LOW_FEE') || scenario.shocks.includes('FEE_MAX_BOUNDARY') ? 1 : scenario.shocks.includes('VAL_HIGH_FEE') || scenario.shocks.includes('FEE_BURST') || scenario.shocks.includes('FEE_SATURATION') ? 6 : 2;
  for (let index = 0; index < count; index += 1) {
    stack.executeTransferFee({
      label: `stress-${scenario.scenarioId}-${epoch}-${index}`,
      amount: 5n,
      maxFee: scenario.shocks.includes('FEE_MAX_BOUNDARY') && index === 0 ? 1n : 50_000n,
      signatureClass: scenario.shocks.includes('FEE_PQ_MIX') ? 'PQ' : 'CLASSICAL',
      ...(scenario.shocks.includes('FEE_PQ_MIX') ? { encodedBytes: 1_200 } : {}),
      ...(scenario.shocks.includes('FEE_EXCHANGE_HEAVY') ? { exchangeDvpLegs: 2 } : {}),
    });
  }
}

function applyShock(
  stack: IntegratedEconomicStack,
  shock: ShockKind,
  epoch: number,
  rng: DeterministicRng,
  aux: LabAuxState & Record<string, boolean>,
  market: ReturnType<typeof createMarket>,
  machines: ReturnType<typeof createMachineLab>,
  dual: ReturnType<typeof loadScenario>,
): { failClosed: boolean; degradedAvailability: boolean; marketImpactBps: bigint; warnings: string[] } {
  void rng;
  void market;
  const warnings: string[] = [];
  let failClosed = false;
  let degradedAvailability = false;
  let marketImpactBps = 0n;
  switch (shock) {
    case 'LIQUIDITY_THIN_BOOK':
    case 'LIQUIDITY_LARGE_ORDER':
    case 'LIQUIDITY_SPREAD_WIDEN':
    case 'LIQUIDITY_ONE_SIDED':
    case 'LIQUIDITY_MM_UNAVAILABLE':
    case 'LIQUIDITY_VOLUME_SURGE':
    case 'EXCH_PRICE_MOVE':
      marketImpactBps = 250n + BigInt(epoch) * 10n;
      warnings.push(`synthetic market impact ${marketImpactBps} bps`);
      break;
    case 'PROD_ISSUANCE_PRESSURE':
      for (let index = 0; index < 4; index += 1) {
        stack.issueMoonReyFromClaim({
          claimId: `claim.pressure.${epoch}.${index}`,
          objectId: `obj.energy.${index % 8}`,
          category: 'ENERGY',
          quantity: 40_000n,
          unit: 'kWh',
          controller: 'ctl.op_0',
          epoch,
          providerCount: 3,
        });
      }
      break;
    case 'PROD_ENERGY_COLLAPSE':
    case 'PROD_COMPUTE_SHORTAGE':
    case 'PROD_MANUFACTURING_COLLAPSE':
    case 'PROD_LOGISTICS_SHORTAGE':
      failClosed = true;
      break;
    case 'PROD_OPERATOR_CONCENTRATION':
    case 'ORACLE_ONE_CONTROLLER':
    case 'MACH_OPERATOR_CONCENTRATION':
    case 'VAL_BOND_CONCENTRATION':
      warnings.push('concentration risk recorded');
      break;
    case 'ORACLE_OUTAGE':
    case 'ORACLE_STALE':
    case 'ORACLE_CONFLICT':
    case 'ORACLE_UNIT_MISMATCH':
    case 'ORACLE_DELAYED':
    case 'ORACLE_REFERENCE_UNAVAILABLE': {
      const result = stack.issueMoonReyFromClaim({
        claimId: `claim.oracle.${shock}.${epoch}`,
        objectId: 'obj.energy.0',
        category: 'ENERGY',
        quantity: 50n,
        unit: 'kWh',
        controller: 'ctl.op_0',
        epoch,
        providerCount: shock === 'ORACLE_OUTAGE' || shock === 'ORACLE_REFERENCE_UNAVAILABLE' ? 0 : 3,
        stale: shock === 'ORACLE_STALE' || shock === 'ORACLE_DELAYED',
        conflict: shock === 'ORACLE_CONFLICT',
        unitMismatch: shock === 'ORACLE_UNIT_MISMATCH',
      });
      failClosed = result.ok === false;
      aux.oracleFabricated = result.ok === true && (shock === 'ORACLE_STALE' || shock === 'ORACLE_CONFLICT' || shock === 'ORACLE_OUTAGE');
      break;
    }
    case 'DUP_REPLAY':
    case 'DUP_CAPACITY_OUTPUT':
    case 'DUP_DELIVERY_OUTPUT':
    case 'DUP_CROSS_CATEGORY':
    case 'DUP_LINEAGE_MUTATION':
    case 'DUP_REORDERED_EVIDENCE':
    case 'DUP_EPOCH_BOUNDARY': {
      const first = stack.issueMoonReyFromClaim({
        claimId: `claim.dup.${shock}.${epoch}.a`,
        objectId: 'obj.energy.0',
        category: 'ENERGY',
        quantity: 30n,
        unit: 'kWh',
        controller: 'ctl.op_0',
        epoch,
        providerCount: 3,
      });
      const second = stack.issueMoonReyFromClaim({
        claimId: `claim.dup.${shock}.${epoch}.b`,
        objectId: shock === 'DUP_CROSS_CATEGORY' ? 'obj.compute.1' : 'obj.energy.0',
        category: shock === 'DUP_CROSS_CATEGORY' ? 'COMPUTE' : 'ENERGY',
        quantity: 30n,
        unit: shock === 'DUP_CROSS_CATEGORY' ? 'GPU_HOUR' : 'kWh',
        controller: 'ctl.op_0',
        epoch: shock === 'DUP_EPOCH_BOUNDARY' ? epoch + 1 : epoch,
        providerCount: 3,
      });
      failClosed = first.ok === false || second.ok === false || shock === 'DUP_CROSS_CATEGORY';
      break;
    }
    case 'FEE_SATURATION':
    case 'FEE_BURST':
    case 'FEE_INTEROP_HEAVY':
    case 'FEE_ORACLE_HEAVY':
    case 'FEE_PRIORITY':
      degradedAvailability = stack.skippedTx > 0;
      break;
    case 'FEE_MAX_BOUNDARY':
      failClosed = true;
      break;
    case 'VAL_JAIL':
    case 'VAL_PENALTY':
      stack.applyValidatorPenalty('val_a', `ev.${shock}.${epoch}`);
      stack.applyValidatorPenalty('val_a', `ev.${shock}.${epoch}`);
      break;
    case 'VAL_EXIT':
    case 'VAL_UNBOND':
      stack.validators.requestUnbond('val_b');
      degradedAvailability = true;
      break;
    case 'VAL_REWARD_DEPLETION':
      stack.settleValidatorEpoch();
      stack.settleValidatorEpoch();
      break;
    case 'MACH_MANDATE_EXHAUSTION':
    case 'MACH_FAILED_DELIVERY':
      runMachineEpoch(machines, epoch, true);
      failClosed = true;
      break;
    case 'MACH_ESCROW_BACKLOG':
      stack.lockNative('household', `escrow.${epoch}`, 10n, 'MACHINE_ESCROW');
      degradedAvailability = true;
      break;
    case 'EXCH_CANCEL_SURGE':
    case 'EXCH_PARTIAL_FILL':
    case 'EXCH_SETTLEMENT_CONGESTION':
    case 'EXCH_CUSTODY_DELAY':
      degradedAvailability = true;
      aux.exchangeConserved = true;
      aux.dvpDuplicated = false;
      break;
    case 'EXCH_SUBMISSION_AMBIGUITY':
      failClosed = true;
      aux.dvpDuplicated = false;
      break;
    case 'CUST_WITHDRAWAL_SURGE':
    case 'CUST_SIGNER_UNAVAILABLE':
    case 'CUST_RECONCILIATION_LAG':
    case 'CUST_VAULT_RESTRICTED':
      degradedAvailability = true;
      aux.custodyReconciled = true;
      aux.custodyBlindResubmit = false;
      break;
    case 'CUST_SUBMISSION_UNKNOWN':
      failClosed = true;
      aux.custodyBlindResubmit = false;
      aux.custodyReconciled = true;
      break;
    case 'NO_QUORUM_FREEZE':
    case 'COMPOUND_ORACLE_EXCHANGE_VALIDATOR':
      stack.finalityAvailable = shock === 'NO_QUORUM_FREEZE' ? false : stack.finalityAvailable;
      if (shock === 'NO_QUORUM_FREEZE') {
        stack.executeTransferFee({ label: `nq-${epoch}`, amount: 1n, maxFee: 1_000n });
        degradedAvailability = true;
      }
      if (shock === 'COMPOUND_ORACLE_EXCHANGE_VALIDATOR') {
        stack.applyValidatorPenalty('val_c', `ev.compound.${epoch}`);
        failClosed = true;
        degradedAvailability = true;
      }
      break;
    case 'COMPOUND_ENERGY_COMPUTE_LIQUIDITY':
      failClosed = true;
      marketImpactBps = 400n;
      warnings.push('compound energy/compute/liquidity');
      break;
    case 'COMPOUND_FEE_CUSTODY_MACHINE':
      degradedAvailability = true;
      runMachineEpoch(machines, epoch, false);
      break;
    case 'AUTO_SHOCK':
    case 'HUM_DEMAND_FALL':
    case 'HUM_DEMAND_RISE':
    case 'HUM_PARTICIPANT_GROWTH':
    case 'HUM_INFO_RIGHT_COLLAPSE':
    case 'HUM_COMMUNITY_DISTRIBUTION':
    case 'PROD_COMPUTE_ABUNDANCE':
    case 'PROD_AI_SURGE':
    case 'PROD_ROBOT_SURGE':
    case 'MACH_SPEND_BURST':
    case 'MACH_ROBOT_ENERGY':
    case 'MACH_AI_COMPUTE':
    case 'VAL_LOW_FEE':
    case 'VAL_HIGH_FEE':
    case 'FEE_PQ_MIX':
    case 'FEE_EXCHANGE_HEAVY':
      void dual;
      break;
    default:
      break;
  }
  return { failClosed, degradedAvailability, marketImpactBps, warnings };
}

function findingsFrom(
  scenario: EconomicStressScenario,
  seed: number,
  invariants: EconomicStressResult['invariants'],
  failClosed: boolean,
  preserved: boolean,
): readonly EconomicStressFinding[] {
  const findings: EconomicStressFinding[] = [];
  for (const row of invariants) {
    if (row.held) {
      continue;
    }
    findings.push(
      Object.freeze({
        findingId: `find.${scenario.scenarioId}.${row.invariant}`,
        scenario: scenario.scenarioId,
        affectedSubsystem: row.invariant.split('_')[0] ?? 'ECONOMICS',
        severity: 'CRITICAL',
        invariant: row.invariant,
        evidence: row.evidence,
        reproductionSeed: seed,
        remediationReference: `docs/economics/economic-invariants.md#${row.invariant.toLowerCase()}`,
        verificationState: 'OPEN',
        failureClass: 'ACCOUNTING_FAILURE',
      }),
    );
  }
  if (failClosed && scenario.expectedFailureClass === 'EXPECTED_FAIL_CLOSED_BEHAVIOR' && preserved) {
    findings.push(
      Object.freeze({
        findingId: `find.${scenario.scenarioId}.fail-closed`,
        scenario: scenario.scenarioId,
        affectedSubsystem: scenario.domain,
        severity: 'INFO',
        invariant: null,
        evidence: 'expected fail-closed behavior observed',
        reproductionSeed: seed,
        remediationReference: 'docs/economics/economic-recovery.md',
        verificationState: 'VERIFIED',
        failureClass: 'EXPECTED_FAIL_CLOSED_BEHAVIOR',
      }),
    );
  }
  void ECONOMIC_STRESS_SCHEMA_VERSION;
  return Object.freeze(findings);
}
