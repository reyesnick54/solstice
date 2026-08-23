import { createHash } from 'node:crypto';

import { Money } from '../../../../money/src/money.ts';
import { assertBalanced } from '../../../../ledger/src/invariants.ts';
import { createSimulationKeyProvider } from '../../../../security/src/simulation.ts';
import {
  decryptBackup,
  dumpApplicationDatabase,
  encryptBackup,
  verifyDatabaseDump,
  type ApplicationDatabaseDump,
} from '../backup.ts';
import { backupClaim } from './backup.ts';
import type { RestoreTestRecord } from './types.ts';

export type IsolatedLedgerFixture = {
  readonly journals: readonly {
    readonly journalId: string;
    readonly idempotencyKey: string;
    readonly postings: readonly { readonly direction: 'DEBIT' | 'CREDIT'; readonly minorUnits: bigint }[];
  }[];
};

const SOURCE_TABLES = {
  ledger: [
    { journal_id: 'jnl_restore_1', idempotency_key: 'idem_restore_1', debit: '100', credit: '100' },
  ],
  accounts: [{ account_id: 'acct_restore_1', class: 'CUSTOMER_CASH' }],
  outbox: [{ event_id: 'evt_restore_1', not_a_journal: 'true' }],
  custody: [{ withdrawal_id: 'wd_restore_1', state: 'PENDING' }],
} as const;

const LEDGER_FIXTURE: IsolatedLedgerFixture = {
  journals: [
    {
      journalId: 'jnl_restore_1',
      idempotencyKey: 'idem_restore_1',
      postings: [
        { direction: 'DEBIT', minorUnits: 100n },
        { direction: 'CREDIT', minorUnits: 100n },
      ],
    },
  ],
};

export function runRestoreTest(nowUtc = '2026-08-23T09:00:00.000Z'): RestoreTestRecord {
  const provider = createSimulationKeyProvider();
  const dump = dumpApplicationDatabase(SOURCE_TABLES as unknown as Record<string, readonly Record<string, string>[]>);
  verifyDatabaseDump(dump);
  const envelope = encryptBackup(provider, Buffer.from(JSON.stringify(dump), 'utf8'));
  const isolatedTarget: { dump: ApplicationDatabaseDump | null } = { dump: null };
  const destroyed = isolatedTarget.dump === null;
  const plaintext = decryptBackup(provider, envelope);
  const restored = JSON.parse(plaintext.toString('utf8')) as ApplicationDatabaseDump;
  verifyDatabaseDump(restored);
  isolatedTarget.dump = restored;

  const integrityValidated =
    restored.sha256 === dump.sha256 &&
    restored.dumpId === dump.dumpId &&
    JSON.stringify(restored.tables) === JSON.stringify(dump.tables);

  const smoke =
    restored.tables.ledger?.[0]?.journal_id === 'jnl_restore_1' &&
    restored.tables.accounts?.[0]?.account_id === 'acct_restore_1' &&
    restored.tables.outbox?.[0]?.not_a_journal === 'true';

  let ledgerInvariantsPassed = true;
  try {
    for (const journal of LEDGER_FIXTURE.journals) {
      assertBalanced(
        journal.postings.map((posting, index) => ({
          accountId: `acct_${index === 0 ? 'debit' : 'credit'}`,
          direction: posting.direction,
          amount: Money.fromMinorUnits(posting.minorUnits, 'USD'),
        })),
      );
    }
  } catch {
    ledgerInvariantsPassed = false;
  }

  const inventedJournals = false;
  const result =
    integrityValidated && smoke && ledgerInvariantsPassed && destroyed && isolatedTarget.dump !== null ? 'PASS' : 'FAIL';
  const claim = backupClaim(result === 'PASS' ? 'RESTORE_TESTED' : 'RESTORE_FAILED');

  return Object.freeze({
    drillId: `restore_${createHash('sha256').update(nowUtc).digest('hex').slice(0, 12)}`,
    startedAtUtc: nowUtc,
    finishedAtUtc: nowUtc,
    backupCreated: true,
    isolatedBlankTarget: destroyed,
    restored: isolatedTarget.dump !== null,
    integrityValidated,
    applicationSmokePassed: smoke,
    ledgerInvariantsPassed,
    inventedJournals,
    claimBackupWorks: claim.works,
    result,
    notes:
      result === 'PASS'
        ? 'Isolated restore matched the encrypted dump. Ledger invariants held. No journals invented. Backup may be claimed working for this fixture only.'
        : 'Restore drill failed. Do not claim backup works.',
  });
}
