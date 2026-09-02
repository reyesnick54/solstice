/**
 * Database and ledger qualification — in-process baseline plus optional PostgreSQL.
 */

import { FrozenClock } from '../../packages/config/src/clock.ts';
import { addMs } from '../../packages/config/src/clock.ts';
import { asUtcInstant } from '../../packages/domain/src/time.ts';
import { Money } from '../../packages/money/src/money.ts';
import { AUTHORITY_TTL_MS, AuthorityIssuer } from '../../packages/permissions/src/execution-authority.ts';
import { Ledger } from '../../packages/ledger/src/journal.ts';
import { SIMULATION_FUNDING_SOURCE_ID } from '../../packages/ledger/src/types.ts';
import { captureEnvironment } from '../lib/env-metadata.ts';
import type { SuiteResult } from '../lib/report.ts';
import { evaluateLatencyTarget, QUALIFICATION_TARGETS, type QualificationStatus } from '../lib/targets.ts';
import { runConcurrent, summarizeLatencyMs, timeMs } from '../lib/stats.ts';

const NOW = asUtcInstant('2026-08-31T12:00:00.000Z');
const SAMPLES = 80;

function buildLedger(): { ledger: Ledger; issuer: AuthorityIssuer } {
  const issuer = new AuthorityIssuer('perf-db-secret');
  const ledger = new Ledger(issuer, new FrozenClock(NOW));
  return { ledger, issuer };
}

async function tryPostgresQualification(): Promise<Record<string, unknown> | null> {
  if (process.env.SUNREY_PERSISTENCE_TEST !== '1') {
    return {
      name: 'postgresql',
      status: 'ENVIRONMENT_LIMITED',
      note: 'Set SUNREY_PERSISTENCE_TEST=1 and run npm run db:up && npm run db:migrate for PostgreSQL qualification',
    };
  }
  return {
    name: 'postgresql',
    status: 'ENVIRONMENT_LIMITED',
    note: 'Use npm run qualify:backend-db for full PostgreSQL RC qualification; not duplicated here',
  };
}

export async function runDatabaseBaseline(): Promise<SuiteResult> {
  const started = Date.now();
  const cases: Record<string, unknown>[] = [];
  const { ledger, issuer } = buildLedger();
  let lastId = '';

  const postSamples: number[] = [];
  const lookupSamples: number[] = [];
  const historySamples: number[] = [];
  const paginationSamples: number[] = [];

  for (let i = 0; i < SAMPLES; i += 1) {
    const key = `db_perf_${i}`;
    const ea = issuer.issue({
      authorityId: `ea_${key}`,
      actionType: 'POST_DEPOSIT',
      accountId: SIMULATION_FUNDING_SOURCE_ID,
      intentId: key,
      idempotencyKey: key,
      amount: Money.fromMinorUnits(10n, 'USD'),
      issuedAt: NOW,
      expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
    });
    const postMs = await timeMs(() => {
      const journal = ledger.postJournal({
        idempotencyKey: key,
        executionAuthority: ea,
        actionType: 'POST_DEPOSIT',
        postings: [
          { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'DEBIT', amount: Money.fromMinorUnits(10n, 'USD') },
          { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'CREDIT', amount: Money.fromMinorUnits(10n, 'USD') },
        ],
      });
      lastId = journal.id;
    });
    postSamples.push(postMs);
    lookupSamples.push(await timeMs(() => {
      ledger.getJournal(lastId);
    }));
    historySamples.push(await timeMs(() => {
      ledger.history({ limit: 20 });
    }));
    paginationSamples.push(await timeMs(() => {
      ledger.history({ limit: 50, cursor: lastId });
    }));
  }

  const balanceMs = await timeMs(() => {
    ledger.projectAccountBalance(SIMULATION_FUNDING_SOURCE_ID);
  });
  const concurrentWrites: number[] = [];
  const { ledger: concurrentLedger, issuer: concurrentIssuer } = buildLedger();
  await runConcurrent(10, 40, async (index) => {
    const key = `concurrent_${index}`;
    const ea = concurrentIssuer.issue({
      authorityId: `ea_${key}`,
      actionType: 'POST_DEPOSIT',
      accountId: SIMULATION_FUNDING_SOURCE_ID,
      intentId: key,
      idempotencyKey: key,
      amount: Money.fromMinorUnits(1n, 'USD'),
      issuedAt: NOW,
      expiresAt: addMs(NOW, AUTHORITY_TTL_MS),
    });
    const ms = await timeMs(() => {
      concurrentLedger.postJournal({
        idempotencyKey: key,
        executionAuthority: ea,
        actionType: 'POST_DEPOSIT',
        postings: [
          { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'DEBIT', amount: Money.fromMinorUnits(1n, 'USD') },
          { accountId: SIMULATION_FUNDING_SOURCE_ID, direction: 'CREDIT', amount: Money.fromMinorUnits(1n, 'USD') },
        ],
      });
    });
    concurrentWrites.push(ms);
  });

  const posting = summarizeLatencyMs(postSamples);
  const lookup = summarizeLatencyMs(lookupSamples);
  const history = summarizeLatencyMs(historySamples);
  const pagination = summarizeLatencyMs(paginationSamples);
  const concurrent = summarizeLatencyMs(concurrentWrites);

  const postingStatus = evaluateLatencyTarget(QUALIFICATION_TARGETS.ledger.posting, posting);
  const lookupStatus = evaluateLatencyTarget(QUALIFICATION_TARGETS.ledger.lookup, lookup);

  cases.push(
    { name: 'single-row-posting', status: postingStatus, latency: posting },
    { name: 'journal-lookup', status: lookupStatus, latency: lookup },
    { name: 'history-pagination', status: 'BENCHMARKED', latency: history },
    { name: 'offset-pagination', status: 'BENCHMARKED', latency: pagination },
    { name: 'balance-projection', status: 'BENCHMARKED', latencyMs: balanceMs },
    { name: 'concurrent-writes-10x40', status: 'BENCHMARKED', latency: concurrent },
  );

  const pgCase = await tryPostgresQualification();
  if (pgCase) cases.push(pgCase);

  const suiteStatus: QualificationStatus =
    postingStatus === 'TARGET_NOT_MET' || lookupStatus === 'TARGET_NOT_MET' ? 'TARGET_NOT_MET' : 'TARGET_MET';

  return {
    suite: 'database',
    status: suiteStatus,
    durationMs: Date.now() - started,
    cases,
    environment: captureEnvironment({ databaseMode: 'in-process' }),
  };
}
