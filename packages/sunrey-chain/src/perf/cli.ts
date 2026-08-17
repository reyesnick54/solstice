import { readFileSync, writeFileSync } from 'node:fs';

import type { BenchPorts } from './ports.ts';
import { compareReports, regressionFailed } from './regression.ts';
import { toHumanSummary, toJson } from './result.ts';
import { runProfile, runSanity } from './runner.ts';
import { BENCH_PROFILES, type BenchProfile, type BenchReport, type LatencyProfile, LATENCY_PROFILES } from './types.ts';

export function perfUsage(): string {
  return [
    'sunrey-bench <profile|sanity|compare> [--json path] [--summary path] [--baseline path] [--soak-ms n] [--latency low|regional|intercontinental]',
    `profiles: ${BENCH_PROFILES.join(' ')}`,
    'Results are ENGINEERING_MEASUREMENT values, not production guarantees.',
  ].join('\n');
}

function isProfile(value: string): value is BenchProfile {
  return (BENCH_PROFILES as readonly string[]).includes(value);
}

function isLatency(value: string): value is LatencyProfile {
  return (LATENCY_PROFILES as readonly string[]).includes(value);
}

export function runSunreyBench(argv: readonly string[], ports?: BenchPorts): number {
  const command = argv[0] ?? 'sanity';
  const jsonAt = argv.indexOf('--json');
  const summaryAt = argv.indexOf('--summary');
  const baselineAt = argv.indexOf('--baseline');
  const soakAt = argv.indexOf('--soak-ms');
  const latencyAt = argv.indexOf('--latency');
  const soakMs = soakAt >= 0 ? Number.parseInt(argv[soakAt + 1] ?? '250', 10) : undefined;
  const latencyProfile = latencyAt >= 0 && argv[latencyAt + 1] && isLatency(argv[latencyAt + 1]!) ? argv[latencyAt + 1] : undefined;

  let report: BenchReport;
  if (command === 'sanity') {
    report = runSanity(ports);
  } else if (command === 'compare') {
    if (baselineAt < 0 || !argv[baselineAt + 1]) {
      console.error('compare requires --baseline <file>');
      return 2;
    }
    report = runSanity(ports);
    const baseline = JSON.parse(readFileSync(argv[baselineAt + 1]!, 'utf8')) as BenchReport;
    const findings = compareReports(baseline, report);
    for (const finding of findings) {
      console.log(`${finding.flagged ? 'REGRESSION' : 'ok'} ${finding.name} ratio=${finding.ratio.toFixed(2)}`);
    }
    if (jsonAt >= 0 && argv[jsonAt + 1]) {
      writeFileSync(argv[jsonAt + 1]!, toJson(report));
    }
    console.log(toHumanSummary(report));
    return regressionFailed(findings) ? 1 : 0;
  } else if (isProfile(command)) {
    report = runProfile({
      profile: command,
      ...(ports !== undefined ? { ports } : {}),
      ...(soakMs !== undefined ? { soakMs } : {}),
      ...(latencyProfile !== undefined ? { latencyProfile } : {}),
    });
  } else {
    console.error(perfUsage());
    return 2;
  }

  if (jsonAt >= 0 && argv[jsonAt + 1]) {
    writeFileSync(argv[jsonAt + 1]!, toJson(report));
  }
  if (summaryAt >= 0 && argv[summaryAt + 1]) {
    writeFileSync(argv[summaryAt + 1]!, toHumanSummary(report));
  }
  console.log(toHumanSummary(report));
  return report.invariants.every((row) => row.ok) ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runSunreyBench(process.argv.slice(2)));
}
