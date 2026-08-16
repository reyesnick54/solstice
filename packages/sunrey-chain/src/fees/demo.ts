import { receiptReconciles, runFeeGovernanceActivation, runFourValidatorFeeDemo } from './demo-helpers.ts';

export { receiptReconciles, runFeeGovernanceActivation, runFourValidatorFeeDemo };

export async function main(): Promise<void> {
  console.log('============================================================');
  console.log('SunRey native fees / resource metering demo');
  console.log('ENVIRONMENT=simulation  no fiat ledger debit  no public staking');
  console.log('============================================================');
  const demo = runFourValidatorFeeDemo();
  const receipt = demo.receipts[0];
  if (!receipt) {
    throw new Error('four-validator demo produced no receipts');
  }
  console.log('1-11 four-validator transfer', {
    reserved: receipt.reservedFee.toString(),
    actual: receipt.actualFee.toString(),
    released: receipt.releasedFee.toString(),
    sampleFee: demo.sampleFee.toString(),
    bob: demo.overBudget.bobAvailable.toString(),
    identicalReceipts: demo.stateRoots.every((root) => root === demo.stateRoots[0]),
    dispositionReconciles: receiptReconciles(receipt),
  });
  console.log('12-13 insufficient max fee rejected', demo.insufficientRejected);
  console.log('14-16 over-budget deterministic failure', demo.overBudget);
  const gov = runFeeGovernanceActivation();
  console.log('fee schedule activates only at height', gov);
  console.log('demo ok — development fee policy only');
}

await main();
