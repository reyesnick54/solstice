import { ProductiveEconomyEngine, type ProductiveSnapshot } from './engine.ts';
import { DEV_CLOCK } from './fixtures.ts';
import { developmentIssuancePolicy } from './policy.ts';

export type CliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

export function runProductiveCommand(
  args: readonly string[],
  engine: ProductiveEconomyEngine = new ProductiveEconomyEngine(DEV_CLOCK),
): CliResult {
  const [plane, action, target] = args;
  if (plane === 'productive') {
    switch (action) {
      case 'object':
        return ok('productive object', target ? engine.object(target) ?? null : engine.listObjects());
      case 'claim':
        return ok('productive claim', engine.listClaims());
      case 'verify':
        if (!target) {
          return fail('productive verify', 'usage: productive verify <claimId>');
        }
        return ok('productive verify', engine.verifyClaim(target));
      case 'contribution':
        return ok(
          'productive contribution',
          target ? engine.contribution(target) ?? null : engine.listContributions(),
        );
      case 'lineage':
        if (!target) {
          return fail('productive lineage', 'usage: productive lineage <contributionId>');
        }
        return ok('productive lineage', engine.lineage(target) ?? null);
      case 'graph':
        return ok('productive graph', {
          ...engine.currentGraph(),
          summary: {
            nodes: engine.currentGraph().nodes.length,
            edges: engine.currentGraph().edges.length,
            hash: engine.currentGraph().projectionHash,
          },
        });
      default:
        return fail('productive', 'expected object|claim|verify|contribution|lineage|graph');
    }
  }
  if (plane === 'moonrey') {
    switch (action) {
      case 'policy':
        return ok('moonrey policy', publicPolicy(engine.activePolicy()));
      case 'issuance':
        return ok('moonrey issuance', target ? engine.receipt(target) ?? null : engine.listReceipts());
      case 'attribution':
        return ok('moonrey attribution', engine.attribution());
      default:
        return fail('moonrey', 'expected policy|issuance|attribution');
    }
  }
  return fail('cli', 'expected productive|moonrey');
}

export function engineFromSnapshot(snapshot: ProductiveSnapshot): ProductiveEconomyEngine {
  const engine = new ProductiveEconomyEngine(DEV_CLOCK);
  engine.restoreFromSnapshot(snapshot);
  return engine;
}

function publicPolicy(policy: ReturnType<ProductiveEconomyEngine['activePolicy']>) {
  return {
    policyVersion: policy.policyVersion,
    parameterClass: policy.parameterClass,
    activationHeight: policy.activationHeight,
    roundingMode: policy.roundingMode,
    minimumOracleQuorum: policy.minimumOracleQuorum,
    eligibleCategories: policy.eligibleCategories,
    countCapacityAsProduction: policy.countCapacityAsProduction,
    countDeliveryIndependentOfOutput: policy.countDeliveryIndependentOfOutput,
  };
}

function ok(command: string, payload: unknown): CliResult {
  return { ok: true, command, payload };
}

function fail(command: string, payload: unknown): CliResult {
  return { ok: false, command, payload };
}

void developmentIssuancePolicy;
