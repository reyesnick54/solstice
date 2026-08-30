/**
 * Domain dependency rollups for graceful consumer behavior.
 */

import type { ProviderCategory } from '../types.ts';
import type { CanonicalProviderHealth, DomainDegradationLevel, DomainDependencyStatus } from './types.ts';
import { combineDomainDegradation, computeProviderDegradation } from './degradation.ts';
import type { ProviderStatusRecord } from './types.ts';

const DOMAIN_LABELS: Partial<Record<ProviderCategory, { readonly domain: string; readonly label: string }>> = {
  MARKET_DATA: { domain: 'exchange', label: 'Crypto reference providers' },
  ORACLE: { domain: 'world', label: 'Macro providers' },
  FX: { domain: 'world', label: 'FX reference providers' },
  PAYMENTS: { domain: 'payments', label: 'Payment rail providers' },
  KYC: { domain: 'compliance', label: 'KYC providers' },
};

export function rollupDependencyStatus(
  statuses: readonly ProviderStatusRecord[],
): readonly DomainDependencyStatus[] {
  const groups = new Map<string, { readonly label: string; readonly rows: ProviderStatusRecord[] }>();
  for (const status of statuses) {
    const mapping = DOMAIN_LABELS[status.category] ?? {
      domain: status.category.toLowerCase(),
      label: `${status.category} providers`,
    };
    const existing = groups.get(mapping.domain);
    if (existing) {
      groups.set(mapping.domain, Object.freeze({ ...existing, rows: [...existing.rows, status] }));
    } else {
      groups.set(mapping.domain, Object.freeze({ label: mapping.label, rows: [status] }));
    }
  }
  return Object.freeze(
    [...groups.entries()].map(([domain, group]) => {
      const healthy = group.rows.filter((row) => isHealthyEnough(row.health)).length;
      const degradations = group.rows.map((row) =>
        computeProviderDegradation({
          health: row.health,
          cacheFreshness: row.cacheFreshness,
          required: false,
        }),
      );
      return Object.freeze({
        domain,
        label: group.label,
        healthy,
        total: group.rows.length,
        degradation: combineDomainDegradation(degradations),
      });
    }),
  );
}

export function formatDependencySummary(status: DomainDependencyStatus): string {
  return `${status.label} healthy: ${status.healthy}/${status.total}`;
}

function isHealthyEnough(health: CanonicalProviderHealth): boolean {
  return health === 'healthy' || health === 'degraded';
}
