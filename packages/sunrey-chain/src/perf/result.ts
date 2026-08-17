import type { BenchReport, BenchCaseResult, LatencyStats, ThroughputStats } from './types.ts';
import { RESULT_CLASS } from './types.ts';

export function formatNs(ns: number): string {
  if (ns >= 1_000_000_000) {
    return `${(ns / 1_000_000_000).toFixed(3)}s`;
  }
  if (ns >= 1_000_000) {
    return `${(ns / 1_000_000).toFixed(3)}ms`;
  }
  if (ns >= 1_000) {
    return `${(ns / 1_000).toFixed(1)}us`;
  }
  return `${ns.toFixed(0)}ns`;
}

export function formatLatency(stats: LatencyStats): string {
  return `n=${stats.count} median=${formatNs(stats.medianNs)} p95=${formatNs(stats.p95Ns)} p99=${formatNs(stats.p99Ns)} min=${formatNs(stats.minNs)} max=${formatNs(stats.maxNs)}`;
}

export function formatThroughput(stats: ThroughputStats): string {
  return `submitted=${stats.submitted} accepted=${stats.accepted} finalized=${stats.finalized} rejected=${stats.rejected} sustained=${stats.sustainedFinalizedPerSec.toFixed(2)}/s burst=${stats.burstFinalizedPerSec.toFixed(2)}/s reject_rate=${stats.errorRejectionRate.toFixed(4)}`;
}

export function toJson(report: BenchReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function toHumanSummary(report: BenchReport): string {
  const lines = [
    `SunRey bench ${report.context.profile} — ${RESULT_CLASS}`,
    `commit ${report.context.sourceCommit}`,
    `hardware ${report.context.hardware.arch} ${report.context.hardware.cpus}cpu ${report.context.hardware.model}`,
    `os ${report.context.os.platform} node ${report.context.os.nodeVersion} container=${report.context.os.container}`,
    `validators=${report.context.validatorCount} latency_profile=${report.context.latencyProfile} dataset=${report.context.datasetSize}`,
    `protocol=${report.context.protocolVersion} duration_ms=${report.context.testDurationMs}`,
    '',
  ];
  for (const row of report.cases) {
    const crypto = row.cryptoLabeledSeparately ? ' [crypto-not-protocol-tps]' : '';
    lines.push(`- ${row.suite}/${row.name}${crypto}`);
    if (row.latency) {
      lines.push(`    latency ${formatLatency(row.latency)}`);
    }
    if (row.throughput) {
      lines.push(`    throughput ${formatThroughput(row.throughput)}`);
    }
    if (row.extras) {
      const extras = Object.entries(row.extras)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(' ');
      lines.push(`    ${extras}`);
    }
  }
  lines.push('');
  lines.push('invariants');
  for (const check of report.invariants) {
    lines.push(`  ${check.ok ? 'ok' : 'FAIL'} ${check.id} ${check.detail}`);
  }
  if (report.warnings.length > 0) {
    lines.push('');
    lines.push('warnings');
    for (const warning of report.warnings) {
      lines.push(`  ${warning}`);
    }
  }
  lines.push('');
  lines.push('These numbers are development/engineering measurements. They are not production guarantees.');
  return `${lines.join('\n')}\n`;
}

export function caseResult(
  suite: string,
  name: string,
  input: {
    readonly latency?: LatencyStats;
    readonly throughput?: ThroughputStats;
    readonly extras?: Readonly<Record<string, string | number | boolean>>;
    readonly cryptoLabeledSeparately?: boolean;
  },
): BenchCaseResult {
  return {
    suite,
    name,
    cryptoLabeledSeparately: input.cryptoLabeledSeparately === true,
    ...(input.latency ? { latency: input.latency } : {}),
    ...(input.throughput ? { throughput: input.throughput } : {}),
    ...(input.extras ? { extras: input.extras } : {}),
  };
}
