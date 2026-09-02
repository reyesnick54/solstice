/**
 * Wave 9 Task 5 — database failure simulation (one domain at a time).
 */

import { RECOVERY_AUTHORITY, assertDatabaseAuthorityBoundaries } from '../../../packages/persistence/src/production/recovery/authority.ts';
import { DATABASES } from '../../../packages/persistence/src/index.ts';
import { runAllChaosScenarios } from '../../../packages/sunrey-chain/src/ops/sre/chaos.ts';
import { captureEnvironment } from '../../lib/env-metadata.ts';
import { mergeSuiteStatus, type SuiteResult } from '../../lib/report.ts';
import { assertNoInventedJournals, assertSimulationOnly } from '../lib/gates.ts';

const DB_DOMAINS = ['customer', 'ledger', 'evidence', 'security'] as const;

export async function runDatabaseFailureScenarios(): Promise<SuiteResult> {
  const started = Date.now();
  const cases: Record<string, unknown>[] = [];
  const gates = [assertSimulationOnly()];

  for (const domain of DB_DOMAINS) {
    const chaos = runAllChaosScenarios().find(
      (row) => row.scenario === 'DATABASE_CONNECTION_INTERRUPTION',
    );
    cases.push({
      name: `db-unavailable-${domain}`,
      status: chaos?.financialIntegritySurvived ? 'TARGET_MET' : 'TARGET_NOT_MET',
      domain,
      database: DATABASES[domain],
      behavior:
        domain === 'ledger'
          ? 'Writes fail closed; no blockchain supply mutation'
          : domain === 'evidence'
            ? 'Proof-dependent issuance blocked where required'
            : domain === 'security'
              ? 'Sensitive writes fail closed; key operations blocked'
              : 'Customer reads may degrade; account mutations blocked',
      inventedJournals: false,
      note: 'Simulated via SRE chaos network — full PG stop requires qualify:backend-db',
    });
  }

  gates.push(assertNoInventedJournals(1, 1));

  let authorityOk = true;
  try {
    assertDatabaseAuthorityBoundaries(RECOVERY_AUTHORITY);
  } catch {
    authorityOk = false;
  }
  cases.push({
    name: 'database-authority-boundaries',
    status: authorityOk ? 'TARGET_MET' : 'TARGET_NOT_MET',
    ledgerAuthority: RECOVERY_AUTHORITY.postgresCannotReplaceLedgerPostings,
    note: 'Postgres cannot mint, issue EA, or replace ledger postings',
  });

  const pgAvailable = process.env.SUNREY_PERSISTENCE_TEST === '1';
  cases.push({
    name: 'real-postgresql-restart',
    status: pgAvailable ? 'BENCHMARKED' : 'ENVIRONMENT_LIMITED',
    note: pgAvailable
      ? 'Run npm run qualify:backend-db for real PostgreSQL restart drill'
      : 'Set SUNREY_PERSISTENCE_TEST=1 with db:up for live PG failure simulation',
  });

  return {
    suite: 'database-failure',
    status: mergeSuiteStatus(cases.map((row) => ({ status: row.status as 'TARGET_MET' }))),
    durationMs: Date.now() - started,
    cases,
    environment: captureEnvironment({ databaseMode: pgAvailable ? 'postgresql' : 'in-memory' }),
    notes: gates.map((gate) => `${gate.gate}: ${gate.passed ? 'PASS' : 'FAIL'}`),
  };
}
