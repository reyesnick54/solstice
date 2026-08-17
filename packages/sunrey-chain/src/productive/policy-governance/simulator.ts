import { emptyMoonReySupply, applyIssuance, type NativeAssetSupplyState } from '../supply.ts';
import { PRODUCTIVE_CATEGORIES, type ProductiveCategory } from '../types.ts';
import { emptyBudgetUsage, evaluateBudget } from './budget.ts';
import { analyzeIssuanceConcentration, type ConcentrationWarning } from './concentration.ts';
import { developmentPolicyBundle } from './registry.ts';
import { buildSupplyPressureReport, type MoonReySupplyPressureReport } from './supply-pressure.ts';
import { SIMULATION_CLASSIFICATION, type MoonReyIssuancePolicyBundle } from './types.ts';

export const POLICY_SIMULATION_SCENARIOS = [
  'balanced_productive_economy',
  'energy_dominant_economy',
  'compute_dominant_economy',
  'rapid_ai_robotics_growth',
  'manufacturing_boom',
  'agricultural_shortage',
  'energy_scarcity',
  'oracle_degradation',
  'one_operator_concentration',
  'one_category_concentration',
  'high_productive_growth',
  'low_productive_growth',
] as const;
export type PolicySimulationScenario = (typeof POLICY_SIMULATION_SCENARIOS)[number];

export type SimulatedClaim = {
  readonly category: ProductiveCategory;
  readonly operator: string;
  readonly objectClass: string;
  readonly region: string;
  readonly quantity: bigint;
  readonly duplicate: boolean;
  readonly rejected: boolean;
  readonly oracleConflict: boolean;
};

export type MoonReyPolicySimulationReport = {
  readonly classification: typeof SIMULATION_CLASSIFICATION;
  readonly scenario: PolicySimulationScenario;
  readonly epochs: number;
  readonly productiveContributionByCategory: Readonly<Record<string, bigint>>;
  readonly normalizedProductiveUnits: Readonly<Record<string, bigint>>;
  readonly moonreyIssuance: bigint;
  readonly supplyGrowth: bigint;
  readonly concentration: readonly ConcentrationWarning[];
  readonly capUtilization: MoonReySupplyPressureReport['capUtilization'];
  readonly rejectedClaims: number;
  readonly duplicateClaims: number;
  readonly oracleConflicts: number;
  readonly policyWarnings: readonly string[];
  readonly supplyPressure: MoonReySupplyPressureReport;
};

export class MoonReyPolicyImpactSimulator {
  private readonly bundle: MoonReyIssuancePolicyBundle;

  constructor(bundle: MoonReyIssuancePolicyBundle = developmentPolicyBundle()) {
    this.bundle = bundle;
  }

  run(scenario: PolicySimulationScenario, epochs = 4): MoonReyPolicySimulationReport {
    const claims = claimsFor(scenario, epochs);
    const byCategory: Record<string, bigint> = {};
    const npuByCategory: Record<string, bigint> = {};
    const byOperator: Record<string, bigint> = {};
    const byClass: Record<string, bigint> = {};
    const byRegion: Record<string, bigint> = {};
    let issued = 0n;
    let rejected = 0;
    let duplicates = 0;
    let conflicts = 0;
    let supply: NativeAssetSupplyState = emptyMoonReySupply();
    const seen = new Set<string>();
    const warnings: string[] = [];
    let epochIssuance = 0n;
    for (const claim of claims) {
      if (claim.oracleConflict) {
        conflicts += 1;
        rejected += 1;
        continue;
      }
      if (claim.rejected) {
        rejected += 1;
        continue;
      }
      const key = `${claim.category}|${claim.operator}|${claim.objectClass}|${claim.region}|${claim.quantity.toString()}`;
      if (claim.duplicate || seen.has(key)) {
        duplicates += 1;
        rejected += 1;
        continue;
      }
      seen.add(key);
      const budget = evaluateBudget(this.bundle.budget, { ...emptyBudgetUsage(), epoch: epochIssuance, globalEpoch: issued, category: byCategory[claim.category] ?? 0n }, claim.quantity);
      if (!budget.ok) {
        rejected += 1;
        warnings.push(`cap ${budget.code}`);
        continue;
      }
      byCategory[claim.category] = (byCategory[claim.category] ?? 0n) + claim.quantity;
      npuByCategory[claim.category] = (npuByCategory[claim.category] ?? 0n) + claim.quantity;
      byOperator[claim.operator] = (byOperator[claim.operator] ?? 0n) + claim.quantity;
      byClass[claim.objectClass] = (byClass[claim.objectClass] ?? 0n) + claim.quantity;
      byRegion[claim.region] = (byRegion[claim.region] ?? 0n) + claim.quantity;
      issued += claim.quantity;
      epochIssuance += claim.quantity;
      supply = applyIssuance(supply, claim.quantity);
    }
    const concentration = analyzeIssuanceConcentration({
      issuanceByCategory: byCategory,
      issuanceByOperator: byOperator,
      issuanceByObjectClass: byClass,
      issuanceByRegion: byRegion,
      totalIssuance: issued,
      warnAtBps: this.bundle.concentrationWarnBps,
    });
    for (const warning of concentration) {
      warnings.push(`${warning.kind}:${warning.subject}`);
    }
    const pressure = buildSupplyPressureReport({
      epoch: epochs - 1,
      issuancePerEpoch: epochIssuance,
      issuanceByCategory: byCategory,
      issuanceByOperator: byOperator,
      issuanceByObjectClass: byClass,
      issuanceByRegion: byRegion,
      priorEpochIssuance: 0n,
      priorSupply: 0n,
      supply,
      warnAtBps: this.bundle.concentrationWarnBps,
      categoryCap: this.bundle.budget.perCategory,
      epochCap: this.bundle.budget.perEpoch,
    });
    return Object.freeze({
      classification: SIMULATION_CLASSIFICATION,
      scenario,
      epochs,
      productiveContributionByCategory: Object.freeze(byCategory),
      normalizedProductiveUnits: Object.freeze(npuByCategory),
      moonreyIssuance: issued,
      supplyGrowth: supply.issued,
      concentration,
      capUtilization: pressure.capUtilization,
      rejectedClaims: rejected,
      duplicateClaims: duplicates,
      oracleConflicts: conflicts,
      policyWarnings: Object.freeze(warnings),
      supplyPressure: pressure,
    });
  }

  runAll(epochs = 4): readonly MoonReyPolicySimulationReport[] {
    return Object.freeze(POLICY_SIMULATION_SCENARIOS.map((scenario) => this.run(scenario, epochs)));
  }
}

function claimsFor(scenario: PolicySimulationScenario, epochs: number): readonly SimulatedClaim[] {
  const out: SimulatedClaim[] = [];
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    switch (scenario) {
      case 'balanced_productive_economy':
        for (const category of PRODUCTIVE_CATEGORIES) {
          out.push(claim(category, `op.${category.toLowerCase()}`, category, 'REGION_A', 1_000n + BigInt(epoch)));
        }
        break;
      case 'energy_dominant_economy':
        out.push(claim('ENERGY', 'op.energy', 'SOLAR', 'REGION_A', 20_000n));
        out.push(claim('COMPUTE', 'op.compute', 'GPU', 'REGION_B', 1_000n));
        break;
      case 'compute_dominant_economy':
        out.push(claim('COMPUTE', 'op.compute', 'GPU', 'REGION_B', 18_000n));
        out.push(claim('AI_COMPUTE', 'op.ai', 'INFERENCE', 'REGION_B', 8_000n));
        out.push(claim('ENERGY', 'op.energy', 'SOLAR', 'REGION_A', 500n));
        break;
      case 'rapid_ai_robotics_growth':
        out.push(claim('AI_COMPUTE', 'op.ai', 'INFERENCE', 'REGION_C', 5_000n * BigInt(epoch + 1)));
        out.push(claim('AUTOMATED_MACHINE_OUTPUT', 'op.robot', 'ROBOT', 'REGION_C', 4_000n * BigInt(epoch + 1)));
        break;
      case 'manufacturing_boom':
        out.push(claim('MANUFACTURING', 'op.mfg', 'FACTORY', 'REGION_D', 12_000n));
        out.push(claim('LOGISTICS_TRANSPORTATION', 'op.log', 'FLEET', 'REGION_D', 2_000n));
        break;
      case 'agricultural_shortage':
        out.push(claim('FOOD_AGRICULTURE', 'op.farm', 'FIELD', 'REGION_E', 100n));
        out.push(claim('WATER', 'op.water', 'AQUIFER', 'REGION_E', 80n));
        out.push(claim('ENERGY', 'op.energy', 'SOLAR', 'REGION_A', 3_000n));
        break;
      case 'energy_scarcity':
        out.push(claim('ENERGY', 'op.energy', 'SOLAR', 'REGION_A', 50n));
        out.push(claim('COMPUTE', 'op.compute', 'GPU', 'REGION_B', 4_000n));
        break;
      case 'oracle_degradation':
        out.push(claim('ENERGY', 'op.energy', 'SOLAR', 'REGION_A', 1_000n, { oracleConflict: true }));
        out.push(claim('COMPUTE', 'op.compute', 'GPU', 'REGION_B', 1_000n, { rejected: true }));
        break;
      case 'one_operator_concentration':
        out.push(claim('ENERGY', 'op.mono', 'SOLAR', 'REGION_A', 8_000n));
        out.push(claim('COMPUTE', 'op.mono', 'GPU', 'REGION_A', 7_000n));
        out.push(claim('MANUFACTURING', 'op.mono', 'FACTORY', 'REGION_A', 6_000n));
        break;
      case 'one_category_concentration':
        out.push(claim('ENERGY', 'op.a', 'SOLAR', 'REGION_A', 30_000n));
        out.push(claim('ENERGY', 'op.b', 'WIND', 'REGION_B', 20_000n));
        break;
      case 'high_productive_growth':
        out.push(claim('ENERGY', 'op.energy', 'SOLAR', 'REGION_A', 2_000n * BigInt(epoch + 1) * BigInt(epoch + 1)));
        out.push(claim('MANUFACTURING', 'op.mfg', 'FACTORY', 'REGION_D', 1_500n * BigInt(epoch + 1) * BigInt(epoch + 1)));
        break;
      case 'low_productive_growth':
        out.push(claim('SERVICES', 'op.svc', 'SERVICE', 'REGION_F', 10n));
        out.push(claim('STORAGE', 'op.store', 'WAREHOUSE', 'REGION_F', 12n));
        break;
    }
    if (scenario !== 'oracle_degradation') {
      out.push(claim('ENERGY', 'op.energy', 'SOLAR', 'REGION_A', 1_000n, { duplicate: epoch === 0 }));
    }
  }
  return Object.freeze(out);
}

function claim(
  category: ProductiveCategory,
  operator: string,
  objectClass: string,
  region: string,
  quantity: bigint,
  flags?: { readonly duplicate?: boolean; readonly rejected?: boolean; readonly oracleConflict?: boolean },
): SimulatedClaim {
  return Object.freeze({
    category,
    operator,
    objectClass,
    region,
    quantity,
    duplicate: flags?.duplicate === true,
    rejected: flags?.rejected === true,
    oracleConflict: flags?.oracleConflict === true,
  });
}
