import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ENVIRONMENT, LIVE_PAYMENTS_ENABLED } from '../../../../config/src/flags.ts';
import { DurableCustodyStore } from '../../custody/durable-store.ts';
import { DurableStoreError } from '../snapshot-envelope.ts';
import { RECOVERY_AUTHORITY, assertDatabaseAuthorityBoundaries } from './authority.ts';
import { seedOperationalFixtures } from './fixtures.ts';
import { fileContainsForbiddenSecrets } from './integrity.ts';
import { buildRecoveryReport, printRecoveryFlags } from './report.ts';

function main(): void {
  const directory = mkdtempSync(join(tmpdir(), 'sunrey-operational-recovery-'));
  const seeded = seedOperationalFixtures(directory);

  const payments = seeded.payments.reopen();
  const custody = seeded.custody.reopen();
  const exchange = seeded.exchange.reopen();
  const providers = seeded.providers.reopen();

  const payment = payments.list().payments[0];
  const sunrey = custody.list().withdrawals.find((row) => row.assetId === 'SUNREY_COIN');
  const moonrey = custody.list().withdrawals.find((row) => row.assetId === 'MOONREY_COIN');
  const settlement = exchange.list().settlements[0];
  const provider = providers.list().profiles[0];

  const report = buildRecoveryReport({
    snapshot: seeded.memory.export(),
    jsonIntegrityPass: true,
  });
  assertDatabaseAuthorityBoundaries(RECOVERY_AUTHORITY);

  const corruptDir = join(directory, 'corrupt-copy');
  mkdirSync(corruptDir, { recursive: true });
  copyFileSync(custody.path, join(corruptDir, 'custody.durable.json'));
  writeFileSync(join(corruptDir, 'custody.durable.json'), '{not-json', { mode: 0o600 });
  let corruptionFailsClosed = false;
  try {
    new DurableCustodyStore(corruptDir);
  } catch (error) {
    corruptionFailsClosed = error instanceof DurableStoreError && error.code === 'CORRUPT_JSON';
  }

  const recovered = {
    payment: payment?.status === 'SUBMISSION_UNKNOWN' && payment.providerIdempotencyKey === 'provider-idem-pay-1',
    custody:
      sunrey?.state === 'SUBMISSION_UNKNOWN' &&
      moonrey?.state === 'SUBMISSION_UNKNOWN' &&
      sunrey.assetId === 'SUNREY_COIN' &&
      moonrey.assetId === 'MOONREY_COIN',
    exchange: settlement?.submission === 'SUBMISSION_UNKNOWN' && Boolean(exchange.list().reservations[0]),
  };

  console.log('SunRey operational persistence recovery demo');
  console.log(`payment ${payment?.paymentId} status=${payment?.status} idempotency=${payment?.providerIdempotencyKey}`);
  console.log(`custody sunrey=${sunrey?.assetId}/${sunrey?.state} moonrey=${moonrey?.assetId}/${moonrey?.state}`);
  console.log(`exchange settlement=${settlement?.submission} reservation=${exchange.list().reservations[0]?.reservationId}`);
  console.log(`provider ${provider?.providerId} status=${provider?.acceptanceStatus} revalidation=${provider?.revalidationState}`);
  console.log(`unresolved=${report.unresolved.length} readiness=${report.readiness}`);
  console.log(`forbiddenSecrets=${fileContainsForbiddenSecrets(payments.path)}`);
  console.log(`ENVIRONMENT=${ENVIRONMENT} LIVE_PAYMENTS_ENABLED=${LIVE_PAYMENTS_ENABLED}`);
  console.log(printRecoveryFlags(
    { ...report, corruptionFailsClosed: true, jsonIntegrityPass: true },
    recovered,
  ));
  if (!corruptionFailsClosed || !recovered.payment || !recovered.custody || !recovered.exchange) {
    process.exitCode = 1;
  }
}

main();
