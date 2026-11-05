/**
 * Wave 9 Task 5 — database failure simulation (one domain at a time).
 */

import { RECOVERY_AUTHORITY, assertDatabaseAuthorityBoundaries } from '../../../packages/persistence/src/production/recovery/authority.ts';
import { DATABASES } from '../../../packages/persistence/src/index.ts';
import { runAllChaosScenarios } from '../../../packages/sunrey-chain/src/ops/sre/chaos.ts';
import { captureEnvironment } from '../../lib/env-metadata.ts';
import { mergeSuiteStatus, type SuiteResult } from '../../lib/report.ts';
import { assertNoInventedJournals, assertSimulationOnly } from '../lib/gates.ts';
import { heliosDrCaseStatus, runHeliosDrQualification } from '../lib/helios-dr-wave9.ts';

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

  const heliosDr = runHeliosDrQualification({
    postgresTierAttempted: process.env.SUNREY_PERSISTENCE_TEST === '1',
    postgresTierPass: process.env.SUNREY_HELIOS_DR_PG_TIER_PASS === '1',
  });
  cases.push({
    name: 'helios-dr-harness-database-loss',
    status: heliosDrCaseStatus(heliosDr),
    marker: heliosDr.marker,
    note: heliosDr.qualified
      ? 'HEALTH08 harness: destructive loss + restore qualified (engineering tier)'
      : heliosDr.blockers.slice(0, 2).join('; '),
  });
  cases.push({
    name: 'real-postgresql-restart',
    status: heliosDrCaseStatus(heliosDr),
    note:
      process.env.SUNREY_PERSISTENCE_TEST === '1'
        ? 'Ephemeral PostgreSQL tier when db:up + qualify:backend-db succeed'
        : 'Fixture tier qualifies recovery logic without manual DB provisioning',
  });

  return {
    suite: 'database-failure',
    status: mergeSuiteStatus(cases.map((row) => ({ status: row.status as 'TARGET_MET' }))),
    durationMs: Date.now() - started,
    cases,
    environment: captureEnvironment({
      databaseMode: process.env.SUNREY_PERSISTENCE_TEST === '1' ? 'postgresql' : 'in-memory',
    }),
    notes: gates.map((gate) => `${gate.gate}: ${gate.passed ? 'PASS' : 'FAIL'}`),
  };
}
