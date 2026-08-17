import type { EconomicDataSource } from './types.ts';
import type { OracleAlert } from './types.ts';

export type ConcentrationShare = {
  readonly key: string;
  readonly count: number;
  readonly shareBps: number;
};

export type ConcentrationReport = {
  readonly provider: readonly ConcentrationShare[];
  readonly controller: readonly ConcentrationShare[];
  readonly infrastructure: readonly ConcentrationShare[];
  readonly geographic: readonly ConcentrationShare[];
  readonly upstream: readonly ConcentrationShare[];
  readonly warnings: readonly OracleAlert[];
  readonly sybilResistanceClaimed: false;
};

function shares(keys: readonly string[]): readonly ConcentrationShare[] {
  const counts = new Map<string, number>();
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = keys.length === 0 ? 1 : keys.length;
  return [...counts.entries()]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([key, count]) =>
      Object.freeze({
        key,
        count,
        shareBps: Math.floor((count * 10_000) / total),
      }),
    );
}

export function analyzeConcentration(
  sources: readonly EconomicDataSource[],
  nowUnix: bigint,
  warnAtBps = 5_000,
): ConcentrationReport {
  const provider = shares(sources.map((row) => row.providerId));
  const controller = shares(sources.map((row) => row.controllerId));
  const infrastructure = shares(sources.map((row) => row.infrastructureRegion));
  const geographic = shares(sources.map((row) => row.infrastructureRegion));
  const upstream = shares(sources.map((row) => row.upstreamOrganizationId));
  const warnings: OracleAlert[] = [];
  for (const [kind, rows] of [
    ['provider', provider],
    ['controller', controller],
    ['infrastructure', infrastructure],
    ['upstream', upstream],
  ] as const) {
    for (const row of rows) {
      if (row.shareBps >= warnAtBps) {
        warnings.push(
          Object.freeze({
            kind: 'ORACLE_PROVIDER_CONCENTRATION',
            providerId: kind === 'provider' ? row.key : null,
            feedId: null,
            sourceId: null,
            detail: `${kind} ${row.key} holds ${row.shareBps} bps; this is a concentration warning, not Sybil resistance`,
            atUnix: nowUnix,
          }),
        );
      }
    }
  }
  return Object.freeze({
    provider,
    controller,
    infrastructure,
    geographic,
    upstream,
    warnings: Object.freeze(warnings),
    sybilResistanceClaimed: false,
  });
}
