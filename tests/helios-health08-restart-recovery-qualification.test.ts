/**
 * HELIOS HEALTH08 — restart, backup, and disaster-recovery qualification (fast CI).
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  HELIOS_RESTART_RECOVERY_BLOCKED,
  HELIOS_RESTART_RECOVERY_QUALIFIED,
  evaluateHeliosRestartRecoveryQualification,
} from '../packages/platform/src/helios/hardening/restart-recovery-qualification.ts';
import { renderHeliosDisasterRecoveryQualificationMarkdown } from '../performance/wave9/lib/helios-dr-report.ts';
import { runHeliosDrQualification } from '../performance/wave9/lib/helios-dr-wave9.ts';

const ROOT = process.cwd();
const DOC = join(ROOT, 'docs/helios/hardening/HELIOS_DISASTER_RECOVERY_QUALIFICATION.md');

describe('HELIOS HEALTH08 — restart recovery qualification', () => {
  it('simulation harness emits HELIOS_RESTART_RECOVERY_QUALIFIED', () => {
    const qualification = runHeliosDrQualification();
    assert.equal(qualification.marker, HELIOS_RESTART_RECOVERY_QUALIFIED);
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.blockers.length, 0);
    assert.ok(qualification.report.engineeringSlo.rtoMs >= 0);
    assert.match(qualification.report.engineeringSlo.disclaimer, /Not contractual production RPO/);
  });

  it('blocks when a harness step fails', () => {
    const report = runHeliosDrQualification().report;
    const failedStep = { ...report.steps[0]!, pass: false, detail: 'simulated' };
    const blocked = evaluateHeliosRestartRecoveryQualification({
      ...report,
      steps: Object.freeze([failedStep, ...report.steps.slice(1)]),
    });
    assert.equal(blocked.marker, HELIOS_RESTART_RECOVERY_BLOCKED);
    assert.ok(blocked.blockers.some((line) => line.startsWith('step:')));
  });

  it('renders qualification markdown', () => {
    const qualification = runHeliosDrQualification();
    const md = renderHeliosDisasterRecoveryQualificationMarkdown(qualification, {
      gitSha: 'd'.repeat(40),
      evaluatedAtUtc: '2026-11-05T04:00:00.000Z',
    });
    assert.match(md, /HELIOS disaster recovery qualification \(HEALTH08\)/);
    assert.match(md, /HELIOS_RESTART_RECOVERY_QUALIFIED/);
    assert.match(md, /Engineering RPO \/ RTO/);
  });

  it('qualification doc is produced by the HEALTH08 runner', () => {
    if (!existsSync(DOC)) {
      assert.fail('run npm run helios:health08:dr:qualify to generate HELIOS_DISASTER_RECOVERY_QUALIFICATION.md');
    }
  });
});
