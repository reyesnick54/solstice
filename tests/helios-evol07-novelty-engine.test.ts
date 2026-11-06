import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  evaluateEvol07NoveltyEngineQualification,
  evol07EngineeringQualificationChecks,
  HELIOS_EVOL07_NOVELTY_ENGINE_QUALIFIED,
} from '@solstice/strategy-lab';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('HELIOS EVOL07 novelty engine qualification', () => {
  const checks = evol07EngineeringQualificationChecks(root);
  const q = evaluateEvol07NoveltyEngineQualification(checks);
  assert.equal(q.qualified, true, q.blockers.join('; '));
  assert.equal(q.marker, HELIOS_EVOL07_NOVELTY_ENGINE_QUALIFIED);
});
