import { ProductiveEconomyEngine } from '../engine.ts';
import { DEV_CLOCK } from '../fixtures.ts';
import { auditMoonReyIssuance } from './audit.ts';
import { developmentCategoryPolicies } from './categories.ts';
import { developmentPolicyBundle, MoonReyPolicyRegistry } from './registry.ts';
import { MoonReyPolicyImpactSimulator, POLICY_SIMULATION_SCENARIOS } from './simulator.ts';
import { buildSupplyPressureReport } from './supply-pressure.ts';
import { emptyMoonReySupply } from '../supply.ts';

export type EconomicsCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

export function runMoonReyEconomicsCommand(
  args: readonly string[],
  engine: ProductiveEconomyEngine = new ProductiveEconomyEngine(DEV_CLOCK),
  registry: MoonReyPolicyRegistry = new MoonReyPolicyRegistry(),
): EconomicsCliResult {
  const [plane, action, target, extra] = args;
  if (plane !== 'moonrey') {
    return fail('cli', 'usage: sunrey-economics moonrey <policy|categories|simulate|issuance|verify|supply-pressure>');
  }
  switch (action) {
    case 'policy':
      return ok('moonrey policy', publicBundle(registry.activeAt(engine.activePolicy().activationHeight) ?? developmentPolicyBundle()));
    case 'categories':
      return ok('moonrey categories', developmentCategoryPolicies());
    case 'simulate': {
      const scenario = POLICY_SIMULATION_SCENARIOS.includes(target as (typeof POLICY_SIMULATION_SCENARIOS)[number])
        ? (target as (typeof POLICY_SIMULATION_SCENARIOS)[number])
        : undefined;
      const simulator = new MoonReyPolicyImpactSimulator(registry.activeAt(1) ?? developmentPolicyBundle());
      return ok('moonrey simulate', scenario ? simulator.run(scenario) : simulator.runAll());
    }
    case 'issuance':
      if (target === 'verify') {
        return verifyIssuance(engine, registry, extra);
      }
      return ok('moonrey issuance', target ? engine.receipt(target) ?? null : engine.listReceipts());
    case 'verify':
      return verifyIssuance(engine, registry, target);
    case 'supply-pressure': {
      const bundle = registry.activeAt(1) ?? developmentPolicyBundle();
      const receipts = engine.listReceipts();
      const byCategory: Record<string, bigint> = {};
      for (const receipt of receipts) {
        byCategory[receipt.category] = (byCategory[receipt.category] ?? 0n) + receipt.moonreyQuantity;
      }
      return ok(
        'moonrey supply-pressure',
        buildSupplyPressureReport({
          epoch: 0,
          issuancePerEpoch: receipts.reduce((sum, receipt) => sum + receipt.moonreyQuantity, 0n),
          issuanceByCategory: byCategory,
          issuanceByOperator: {},
          issuanceByObjectClass: {},
          issuanceByRegion: {},
          priorEpochIssuance: 0n,
          priorSupply: 0n,
          supply: engine.currentSupply(),
          warnAtBps: bundle.concentrationWarnBps,
          categoryCap: bundle.budget.perCategory,
          epochCap: bundle.budget.perEpoch,
        }),
      );
    }
    default:
      return fail('moonrey', 'expected policy|categories|simulate|issuance|verify|supply-pressure');
  }
}

function verifyIssuance(
  engine: ProductiveEconomyEngine,
  registry: MoonReyPolicyRegistry,
  target: string | undefined,
): EconomicsCliResult {
  if (!target) {
    return fail('moonrey verify', 'usage: sunrey-economics moonrey issuance verify <receiptId|contributionId>');
  }
  const receipt = engine.receipt(target) ?? engine.listReceipts().find((item) => item.productiveContributionId === target);
  const contribution = engine.contribution(receipt?.productiveContributionId ?? target);
  if (!contribution) {
    return fail('moonrey verify', 'contribution not found');
  }
  const bundle = registry.get(receipt?.policyVersion ?? contribution.schemaVersion) ?? developmentPolicyBundle();
  return ok(
    'moonrey issuance verify',
    auditMoonReyIssuance({
      contribution,
      bundle,
      receipt,
      supply: engine.currentSupply(),
      expectedFingerprint: contribution.fingerprint,
      issuanceBasis: contribution.normalizedQuantity,
    }),
  );
}

function publicBundle(bundle: ReturnType<typeof developmentPolicyBundle>) {
  return {
    policyVersion: bundle.policyVersion,
    contentHash: bundle.contentHash,
    activationHeight: bundle.activationHeight,
    eligibleCategories: bundle.eligibleCategories,
    parameterClass: bundle.parameterClass,
    productionCaps: bundle.budget.productionCaps,
    ticker: 'NOT_ASSIGNED',
    assetId: 'MOONREY_COIN',
  };
}

function ok(command: string, payload: unknown): EconomicsCliResult {
  return { ok: true, command, payload };
}

function fail(command: string, payload: unknown): EconomicsCliResult {
  return { ok: false, command, payload };
}

void emptyMoonReySupply;
