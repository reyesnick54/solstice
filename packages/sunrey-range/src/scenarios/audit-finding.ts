import { publicFindingView } from '../../../sunrey-chain/src/audit/remediation/disclosure.ts';
import { fixtureFindings } from '../../../sunrey-chain/src/audit/remediation/fixtures.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { actor, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

/**
 * Chunk 83 / Chunk 57 safe adversarial regression. Represents a
 * restricted-disclosure finding without targeting production.
 */
export const auditFindingScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'AUDIT-FINDING-REGRESSION',
    category: 'INVARIANT_VALIDATION',
    seed: 8301,
    subsystem: 'audit-remediation',
    attack: 'public exposure of restricted exploit detail',
    actors: [actor('reviewer.shared', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'reviewer.shared', 'request public finding view')],
    expectedSecurityProperties: ['NO_RAW_PERSONAL_DATA_EGRESS'],
    expectedDetections: [detection('security_log', 'RESTRICTED_DETAIL_WITHHELD')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'disclosure classification SECURITY_RESTRICTED',
    detectiveControl: 'RESTRICTED_DETAIL_WITHHELD',
    recovery: 'none',
    preventiveOnly: false,
  }),
];

export function runAuditFinding(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const restricted = fixtureFindings().find((row) => row.disclosureClass === 'SECURITY_RESTRICTED');
  if (!restricted) {
    throw new Error('fixture finding missing');
  }
  const view = publicFindingView(restricted);
  const withheld = view.exploitDetailExposed === false && !/exploit|poc/i.test(view.description);
  if (withheld) {
    recordAlert(env, 'RESTRICTED_DETAIL_WITHHELD');
  }
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: withheld,
    safetyHeld: withheld,
    invariants: holdAll(['NO_RAW_PERSONAL_DATA_EGRESS'], 'public view withholds restricted exploit detail'),
    detections: [
      {
        channel: 'security_log',
        code: 'RESTRICTED_DETAIL_WITHHELD',
        observed: withheld,
        detail: view.description,
      },
    ],
    recovery: recovery('NONE_PREVENTIVE', false, true, true, 'preventive disclosure control'),
    notes: 'TEST_FIXTURE_NOT_EXTERNAL_AUDIT isolated finding-class regression. Not a production target.',
  });
}
