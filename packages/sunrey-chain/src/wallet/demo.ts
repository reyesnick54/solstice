import {
  runMachineMandateDemo,
  runMultiAuthDemo,
  runPqMigrationDemo,
  runRecoveryDemo,
  runTransferDemo,
} from './demo-helpers.ts';

export {
  runMachineMandateDemo,
  runMultiAuthDemo,
  runPqMigrationDemo,
  runRecoveryDemo,
  runTransferDemo,
};

export async function main(): Promise<void> {
  console.log('============================================================');
  console.log('SunRey sovereign wallets demo');
  console.log('ENVIRONMENT=simulation  tickers=NOT_ASSIGNED');
  console.log('============================================================');
  const transfer = runTransferDemo();
  console.log('four-validator transfer', {
    alice: transfer.aliceAddress,
    bob: transfer.bobAddress,
    bobAfter: transfer.bobAfter,
    estimatedFee: transfer.estimatedFee,
    maxFee: transfer.maximumAuthorizedFee,
    actualFee: transfer.actualFinalizedFee,
    rootsEqual: transfer.rootsEqual,
  });
  const multi = runMultiAuthDemo();
  console.log('multi-auth', multi);
  const recovery = runRecoveryDemo();
  console.log('recovery', recovery);
  const pq = runPqMigrationDemo();
  console.log('crypto-suite migration', pq);
  const machine = runMachineMandateDemo();
  console.log('machine mandate', machine);
  console.log('demo ok — development wallets only; not a second ledger');
}

await main();
