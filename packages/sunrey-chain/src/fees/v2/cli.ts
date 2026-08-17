import { developmentFeePolicyV2, hashFeePolicyV2 } from './policy.ts';
import { initialBaseResourcePriceState, nextBaseResourcePrice } from './price.ts';
import { estimateFeeV2 } from './quote.ts';
import { AdaptiveFeeSimulator, FEE_MARKET_SCENARIOS } from './simulator.ts';
import { buildFeeMarketVerificationReport } from './verify.ts';
import { feeMarketReadiness } from './readiness.ts';
import { usageV2ForTransaction } from './meter.ts';
import type { ExecutableTransaction } from '../types.ts';

function json(value: unknown): string {
  return `${JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item), 2)}\n`;
}

function sampleTx(bytes = 240, sigs = 1, maxFee = 50_000n): ExecutableTransaction {
  return {
    transactionId: 'cli-estimate',
    operation: 'NATIVE_TRANSFER',
    payerAuthenticated: true,
    encodedBytes: bytes,
    signatureCount: sigs,
    budget: {
      maxExecutionUnits: 10_000n,
      maxFee,
      feeAsset: 'SUNREY_COIN',
      feePayer: 'cli',
      exemption: 'NONE',
    },
  };
}

export function runSunreyEconomicsCli(argv: readonly string[] = process.argv.slice(2)): string {
  const [domain, command, ...rest] = argv;
  if (domain !== 'fees') {
    return 'usage: sunrey-economics fees <policy|price|estimate|simulate|verify|history>\n';
  }
  const policy = developmentFeePolicyV2();
  switch (command) {
    case 'policy':
      return json({
        policyVersion: policy.policyVersion,
        version: policy.version,
        formulaVersion: policy.formulaVersion,
        feeAsset: policy.feeAsset,
        moonreyFeeEnabled: policy.moonreyFeeEnabled,
        productionParametersConfigured: policy.productionParametersConfigured,
        aiCannotAuthorize: policy.aiCannotAuthorize,
        minimumFee: policy.minimumFee,
        bounds: policy.bounds,
        hash: hashFeePolicyV2(policy),
        historicPolicy: 'FeeSchedule v1 remains the historic policy and is not reinterpreted',
      });
    case 'price': {
      const used = BigInt(rest[0] ?? '1000000');
      const state = nextBaseResourcePrice(initialBaseResourcePriceState(policy.bounds, 100n, 0), used, policy.bounds, 1);
      return json(state);
    }
    case 'estimate': {
      const bytes = Number(rest[0] ?? '240');
      const sigs = Number(rest[1] ?? '1');
      const tx = sampleTx(bytes, sigs);
      const quote = estimateFeeV2(policy, tx, 100n);
      return json({
        informational: true,
        authorization: 'signed canonical max_fee',
        usage: usageV2ForTransaction(tx),
        quote: quote.ok ? quote.quote : quote,
      });
    }
    case 'simulate': {
      const scenario = FEE_MARKET_SCENARIOS.includes(rest[0] as (typeof FEE_MARKET_SCENARIOS)[number])
        ? (rest[0] as (typeof FEE_MARKET_SCENARIOS)[number])
        : 'TARGET_UTILIZATION';
      const result = new AdaptiveFeeSimulator(policy).run(scenario, 8);
      return json({ classification: 'ENGINEERING_SIMULATION', ...result, blocks: result.blocks.length });
    }
    case 'verify':
      return json(buildFeeMarketVerificationReport(policy));
    case 'history': {
      let state = initialBaseResourcePriceState(policy.bounds, 100n, 0);
      const rows = [state];
      const path = [0n, 200_000n, 1_000_000n, 1_800_000n, 1_000_000n];
      path.forEach((used, index) => {
        state = nextBaseResourcePrice(state, used, policy.bounds, index + 1);
        rows.push(state);
      });
      return json({
        formulaVersion: 'BASE_PRICE_FORMULA_V1',
        productionParametersConfigured: false,
        history: rows,
        readiness: feeMarketReadiness(buildFeeMarketVerificationReport(policy), policy),
      });
    }
    default:
      return 'usage: sunrey-economics fees <policy|price|estimate|simulate|verify|history>\n';
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(runSunreyEconomicsCli());
}
