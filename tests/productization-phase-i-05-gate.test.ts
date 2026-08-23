import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { currentRepositoryGateSnapshot } from '../packages/sunrey-chain/src/production-handoff/production-gates/index.ts';

describe('Phase I Prompt 5 productization artifacts', () => {
  it('keeps production disabled and the registry fail-closed', () => {
    const snapshot = currentRepositoryGateSnapshot();
    assert.equal(snapshot.releaseDecision, 'BLOCKED');
    assert.equal(snapshot.productionActive, false);
    assert.equal(snapshot.backendSoftwareReady, true);
    assert.equal(snapshot.externalGatesMissing, true);
    const registry = JSON.parse(
      readFileSync('docs/productization/sunrey-external-input-registry.json', 'utf8'),
    ) as { releaseDecision: string; productionActive: boolean; totalGates: number };
    assert.equal(registry.releaseDecision, 'BLOCKED');
    assert.equal(registry.productionActive, false);
    assert.equal(registry.totalGates, snapshot.inputs.length);
  });

  it('documents the handoff, ceremony, and phase record', () => {
    const report = readFileSync('docs/productization/SUNREY_PRODUCTION_GATE_REPORT.md', 'utf8');
    const assurance = readFileSync('docs/productization/SUNREY_EXTERNAL_ASSURANCE_HANDOFF.md', 'utf8');
    const ceremony = readFileSync('docs/productization/SUNREY_LAUNCH_CEREMONY_CHECKLIST.md', 'utf8');
    const phase = readFileSync('docs/productization/PHASE_I_05_PRODUCTION_GATES.md', 'utf8');
    assert.match(report, /BACKEND SOFTWARE READY=true/);
    assert.match(report, /EXTERNAL GATES MISSING=true/);
    assert.match(report, /PRODUCTION ACTIVE=false/);
    assert.match(assurance, /PENETRATION_TESTER/);
    assert.match(assurance, /LEGAL_COUNSEL/);
    assert.match(ceremony, /Do not execute/);
    assert.match(phase, /RELEASE_DECISION=BLOCKED/);
    assert.match(phase, /Do not begin Prompt 6/);
  });
});
