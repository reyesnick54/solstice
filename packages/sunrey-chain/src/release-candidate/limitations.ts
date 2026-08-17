import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { KnownSecurityLimitation } from './types.ts';

/**
 * Chunk 62 KnownSecurityLimitations import.
 *
 * When Chunk 62 lands a machine-readable register, this loader reads it.
 * Until then the RC carries the explicit testnet limitation set so release
 * notes cannot hide them.
 */
export const CHUNK_62_LIMITATIONS_REL = 'packages/sunrey-chain/src/security-limitations/known-limitations.json';

export const BUILTIN_KNOWN_LIMITATIONS: readonly KnownSecurityLimitation[] = Object.freeze([
  Object.freeze({
    id: 'NOT_MAINNET',
    title: 'This candidate is a TESTNET release. It does not activate mainnet or production financial services.',
    severity: 'critical',
    source: 'chunk-63',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'TICKERS_NOT_ASSIGNED',
    title: 'Public tickers remain NOT_ASSIGNED. Test units have no implied monetary value.',
    severity: 'critical',
    source: 'chunk-53',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'SIMULATION_ENVIRONMENT',
    title: 'ENVIRONMENT stays simulation. Every LIVE_* flag stays false.',
    severity: 'critical',
    source: 'packages/config',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'PQC_NOT_QUANTUM_PROOF',
    title: 'Standardized PQ provider is TESTNET_APPROVED only. Not quantum-proof. Not production cryptographic approval.',
    severity: 'warning',
    source: 'chunk-60',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'FORMAL_SUITE_ABSENT',
    title: 'Chunk 61 formal verification is not merged. FORMAL qualification records property/invariant smoke, not machine-checked proofs.',
    severity: 'warning',
    source: 'chunk-61-absent',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'PERFORMANCE_NOT_CORRECTNESS',
    title: 'Benchmark numbers are engineering measurements. No arbitrary performance number alone determines correctness.',
    severity: 'info',
    source: 'chunk-58',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'ADVERSARIAL_IN_PROCESS',
    title: 'Adversarial range red actors are in-process test doubles. Detector output is not legal guilt.',
    severity: 'info',
    source: 'chunk-57',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'RELEASE_AUTHORITY_NOT_EXECUTION',
    title: 'ReleaseAuthority signs artifacts only. It does not issue Execution Authority or change blockchain state.',
    severity: 'critical',
    source: 'chunk-59',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'NO_PUBLIC_STAKING',
    title: 'Public staking is EXCLUDED_FROM_RC.',
    severity: 'info',
    source: 'chunk-53',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'NO_LIVE_HSM',
    title: 'No live HSM/KMS. Development/test signing only.',
    severity: 'warning',
    source: 'chunk-4',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'ENDURANCE_NOT_CLAIMED',
    title: 'Do not claim a multi-day endurance run unless that duration actually completed.',
    severity: 'warning',
    source: 'chunk-63',
    hiddenFromReleaseNotes: false,
  }),
]);

export function loadKnownSecurityLimitations(root: string): readonly KnownSecurityLimitation[] {
  const chunk62 = join(root, CHUNK_62_LIMITATIONS_REL);
  if (existsSync(chunk62)) {
    const parsed = JSON.parse(readFileSync(chunk62, 'utf8')) as { readonly limitations?: readonly KnownSecurityLimitation[] };
    const imported = (parsed.limitations ?? []).map((row) =>
      Object.freeze({
        ...row,
        hiddenFromReleaseNotes: false as const,
        source: row.source ?? 'chunk-62',
      }),
    );
    return mergeLimitations(imported, BUILTIN_KNOWN_LIMITATIONS);
  }
  return BUILTIN_KNOWN_LIMITATIONS;
}

export function mergeLimitations(
  imported: readonly KnownSecurityLimitation[],
  fallback: readonly KnownSecurityLimitation[],
): readonly KnownSecurityLimitation[] {
  const byId = new Map<string, KnownSecurityLimitation>();
  for (const row of fallback) {
    byId.set(row.id, row);
  }
  for (const row of imported) {
    byId.set(row.id, Object.freeze({ ...row, hiddenFromReleaseNotes: false }));
  }
  return Object.freeze([...byId.values()]);
}

export function limitationsHidden(rows: readonly KnownSecurityLimitation[]): boolean {
  return rows.some((row) => row.hiddenFromReleaseNotes !== false);
}
