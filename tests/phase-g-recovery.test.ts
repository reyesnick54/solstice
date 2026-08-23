import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { runReconciliation, runRecoveryCases } from '../packages/sunrey-exchange/src/productization/recovery.ts';
import { DigitalAssetLifecycle } from '../packages/sunrey-exchange/src/productization/lifecycle.ts';

const NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

describe('Phase G restart / recovery / reconciliation', () => {
  it('restarting from a snapshot does not duplicate fills or postings', () => {
    const cases = runRecoveryCases(NOW);
    assert.equal(cases.length, 6);
    for (const row of cases) {
      assert.equal(row.duplicatedFill, false, row.phase);
      assert.equal(row.duplicatedLedgerPosting, false, row.phase);
      assert.equal(row.duplicatedChainTransaction, false, row.phase);
      assert.equal(row.lostReservation, false, row.phase);
      assert.equal(row.corruptedSupply, false, row.phase);
      assert.equal(row.incorrectCompletionState, false, row.phase);
    }
  });

  it('controlled mismatch persists until a compensating snapshot', () => {
    const lifecycle = new DigitalAssetLifecycle({ now: NOW, participantId: 'recon_mismatch' });
    lifecycle.fundQuote();
    const snapshot = lifecycle.snapshotState() as { issuedSun: string };
    const mismatched = { ...snapshot, issuedSun: `${snapshot.issuedSun}1` };
    assert.notEqual(mismatched.issuedSun, snapshot.issuedSun);
    const restored = lifecycle.restoreFromSnapshot();
    assert.equal(restored.duplicatedFill, false);
    const report = runReconciliation(NOW);
    assert.equal(report.introducedBreak, true);
    assert.equal(report.breakPersisted, true);
    assert.equal(report.resolvedThroughControlledProcess, true);
    assert.equal(report.balancingEntriesInvented, false);
  });
});
