import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertReplayDetectsAll, runManipulationReplay } from './replay.ts';

describe('market surveillance replay', () => {
  it('detects wash, spoofing, layering, and coordinated activity with evidence', () => {
    const results = runManipulationReplay('unit-replay');
    assertReplayDetectsAll(results);
    for (const result of results) {
      assert.ok(result.alerts[0]!.explanation.length > 0);
      assert.ok(Object.keys(result.alerts[0]!.evidence).length > 0);
    }
    const second = runManipulationReplay('unit-replay');
    assert.deepEqual(
      results.map((row) => row.alerts.map((alert) => alert.id)),
      second.map((row) => row.alerts.map((alert) => alert.id)),
    );
  });
});
