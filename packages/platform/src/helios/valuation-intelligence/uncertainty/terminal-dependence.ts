import type { ProbabilisticDcfInput, SinglePathDcfResult } from '../val04-probabilistic-dcf/types.ts';
import type { TerminalValueDependence, TerminalValueDependenceSeverity } from './types.ts';
import { percentile } from './numeric.ts';

export function pvTerminalShare(path: SinglePathDcfResult, forecastYears: number): number {
  const wacc = path.sampled.wacc;
  const pvTerminal = path.terminalValue / Math.pow(1 + wacc, forecastYears);
  if (path.enterpriseValue <= Number.EPSILON) return 0;
  return clamp01(pvTerminal / path.enterpriseValue);
}

export function buildTerminalValueDependence(input: {
  readonly paths: readonly SinglePathDcfResult[];
  readonly representativePath: SinglePathDcfResult;
  readonly forecastYears: number;
}): TerminalValueDependence {
  const shares = input.paths.map((p) => pvTerminalShare(p, input.forecastYears));
  const medianShare = percentile(shares, 0.5);
  const repShare = pvTerminalShare(input.representativePath, input.forecastYears);
  const share = medianShare;
  return Object.freeze({
    terminalValueShareOfEnterpriseValue: share,
    severity: severityFromShare(share),
    medianPathShare: repShare,
    distributionP05Share: percentile(shares, 0.05),
    distributionP95Share: percentile(shares, 0.95),
  });
}

export function severityFromShare(share: number): TerminalValueDependenceSeverity {
  if (share >= 0.9) return 'EXTREME';
  if (share >= 0.7) return 'HIGH';
  if (share >= 0.5) return 'MODERATE';
  return 'LOW';
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function terminalMethodologyBumpNote(input: ProbabilisticDcfInput): string {
  return `terminal_method=${input.terminal.method}`;
}
