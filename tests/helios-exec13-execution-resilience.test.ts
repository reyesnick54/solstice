import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EXEC13_KILL_SWITCH_SCOPES,
  Exec13KillSwitchRegistry,
  HELIOS_EXEC13_EXECUTION_RESILIENCE_QUALIFIED,
  evaluateExec13ExecutionResilienceQualification,
  maxExec13ResilienceState,
} from '../packages/platform/src/helios/execution-connectivity/exec13/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS EXEC13 execution resilience qualification', () => {
  it('passes HELIOS boundary guard for execution-connectivity module', () => {
    const findings = lintHeliosBoundary(process.cwd()).filter((row) =>
      row.path.includes('execution-connectivity'),
    );
    assert.deepEqual(findings, []);
  });

  it('supports seven kill-switch scopes', () => {
    assert.equal(EXEC13_KILL_SWITCH_SCOPES.length, 7);
    assert.ok(EXEC13_KILL_SWITCH_SCOPES.includes('market'));
  });

  it('rejects agent kill-switch disable', () => {
    const registry = new Exec13KillSwitchRegistry();
    const row = registry.activate({
      scope: 'strategy',
      target: 'strat_demo',
      mode: 'EXIT_ONLY',
      reason: 'test',
      actorKind: 'HUMAN_OPERATOR',
      activatedAt: '2026-11-07T16:00:00.000Z',
    });
    const refused = registry.deactivate({ killSwitchId: row.killSwitchId, actorKind: 'AGENT' });
    assert.equal(refused.ok, false);
  });

  it('combines kill-switch depth monotonically', () => {
    const merged = maxExec13ResilienceState('PAUSE_NEW', 'RECONCILIATION_REQUIRED');
    assert.equal(merged, 'RECONCILIATION_REQUIRED');
  });

  it('emits HELIOS_EXEC13_EXECUTION_RESILIENCE_QUALIFIED when harness passes', () => {
    const result = evaluateExec13ExecutionResilienceQualification();
    assert.equal(
      result.marker,
      HELIOS_EXEC13_EXECUTION_RESILIENCE_QUALIFIED,
      result.blockers.join('; '),
    );
  });
});
