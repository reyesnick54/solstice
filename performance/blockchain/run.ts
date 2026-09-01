/**
 * Blockchain benchmark wrapper — composes canonical sunrey-bench results.
 */

import { runSanity, runProfile } from '../../packages/sunrey-chain/src/perf/runner.ts';
import { toJson } from '../../packages/sunrey-chain/src/perf/result.ts';
import { measureExplorer } from '../../packages/sunrey-explorer/src/perf.ts';
import { measureExchange } from '../../packages/sunrey-exchange/src/perf.ts';
import { measureSdk } from '../../packages/sunrey-sdk/src/perf.ts';
import { captureEnvironment } from '../lib/env-metadata.ts';
import type { SuiteResult } from '../lib/report.ts';
import type { QualificationStatus } from '../lib/targets.ts';

const ports = {
  explorer: { measure: measureExplorer },
  exchange: { measure: measureExchange },
  sdk: { measure: measureSdk },
};

export async function runBlockchainBaseline(): Promise<SuiteResult> {
  const started = Date.now();
  const cases: Record<string, unknown>[] = [];

  const sanity = runSanity(ports);
  cases.push({
    name: 'sanity',
    status: sanity.invariants.every((row) => row.ok) ? 'TARGET_MET' : 'TARGET_NOT_MET',
    profile: 'sanity',
    invariants: sanity.invariants,
    cases: sanity.cases.map((row) => ({
      suite: row.suite,
      name: row.name,
      latency: row.latency,
      throughput: row.throughput,
      extras: row.extras,
    })),
  });

  const seven = runProfile({ profile: 'seven-validator', ports, latencyProfile: 'low' });
  const finalityCase = seven.cases.find((row) => row.name.includes('finality') || row.throughput);
  const sustainedTps = finalityCase?.throughput?.sustainedFinalizedPerSec ?? null;
  cases.push({
    name: 'seven-validator',
    status: seven.invariants.every((row) => row.ok) ? 'BENCHMARKED' : 'TARGET_NOT_MET',
    profile: 'seven-validator',
    validatorCount: 7,
    sustainedFinalizedTxPerSec: sustainedTps,
    finalityLatency: finalityCase?.latency,
    invariants: seven.invariants,
    caseCount: seven.cases.length,
  });

  const micro = runProfile({ profile: 'micro', ports });
  const cryptoCase = micro.cases.find((row) => row.cryptoLabeledSeparately);
  cases.push({
    name: 'micro-crypto',
    status: 'BENCHMARKED',
    profile: 'micro',
    cryptoLabeledSeparately: true,
    cryptoCase: cryptoCase
      ? { name: cryptoCase.name, latency: cryptoCase.latency, extras: cryptoCase.extras }
      : null,
  });

  const suiteStatus: QualificationStatus = cases.some((row) => row.status === 'TARGET_NOT_MET')
    ? 'TARGET_NOT_MET'
    : 'BENCHMARKED';

  return {
    suite: 'blockchain',
    status: suiteStatus,
    durationMs: Date.now() - started,
    cases,
    environment: captureEnvironment({
      validatorCount: 7,
      benchmarkTool: 'sunrey-bench',
      benchmarkToolVersion: 'chunk-58',
    }),
    notes: ['Raw bench report available via npm run sunrey-bench'],
    rawSanityJson: JSON.parse(toJson(sanity)),
  };
}
