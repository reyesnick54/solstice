import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  cf11EngineeringQualificationChecks,
  evaluateCf11EngineeringQualification,
  HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_QUALIFIED,
} from '../packages/strategy-lab/src/cf11/index.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('HELIOS CF11 safe offline policy improvement qualification', () => {
  const checks = cf11EngineeringQualificationChecks(root);
  const q = evaluateCf11EngineeringQualification(checks);
  assert.equal(q.qualified, true, q.blockers.join('; '));
  assert.equal(q.marker, HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_QUALIFIED);
  assert.equal(q.route?.nextStage, 'EVOL11_CHAMPION_CHALLENGER');
});
