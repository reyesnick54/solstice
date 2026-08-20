import { scanForbiddenPayload } from '../../../human-economic-contribution/src/invariants.ts';
import { CONTRIBUTION_NOT_HUMAN_WORTH } from '../../../human-economic-contribution/src/taxonomy.ts';
import {
  AI_FINAL_VALUATION_AUTHORITY_FORBIDDEN,
  VALUATION_IS_NOT_HUMAN_WORTH,
} from '../../../human-economic-contribution/src/valuation/constitution.ts';
import { refuseStandaloneAttempt } from '../../../sunrey-chain/src/economics/human-contribution-bridge/gate.ts';
import { runProductionAttack, safetyScenario } from './production-helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import type { RangeEnvironment } from '../environment.ts';

const INVARIANTS = [
  'NO_HUMAN_WORTH_SCORING',
  'AI_CANNOT_EXECUTE',
  'CHUNK_71_MONETARY_AUTHORITY',
  'PRODUCTION_NOT_ACTIVE',
] as const;

export const humanEconomyScenarios: readonly AttackScenario[] = [
  'HUMAN-DUPLICATE',
  'HUMAN-EXPIRED-CONSENT',
  'HUMAN-REVOKED-RIGHTS',
  'HUMAN-UNVERIFIED',
  'HUMAN-PROTECTED-TRAIT',
  'HUMAN-PEVE-TOKEN',
  'HUMAN-WORTH-FIELD',
  'HUMAN-VALUATION-NO-EVIDENCE',
  'HUMAN-AI-APPROVE',
].map((scenarioId, index) =>
  safetyScenario({
    scenarioId,
    seed: 15780 + index,
    category: 'HUMAN_ECONOMY_ABUSE',
    subsystem: 'human-contribution',
    attack: scenarioId.toLowerCase().replace('human-', '').replaceAll('-', ' '),
    invariants: INVARIANTS,
    detection: 'HUMAN_WORTH_REJECTED',
  }),
);

export function runHumanEconomy(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  return runProductionAttack(env, scenario, () => {
    const trait = scanForbiddenPayload({ race: 'injected' });
    const worth = scanForbiddenPayload({ humanWorthScore: 99 });
    const peve = scanForbiddenPayload({ peveScore: 12 });
    const peveMint = refuseStandaloneAttempt({ kind: 'PEVE_SCORE', score: 99n });
    const aiMint = refuseStandaloneAttempt({ kind: 'AI_OUTPUT', outputDigest: 'digest_ai' });
    const s3mMint = refuseStandaloneAttempt({ kind: 'S3M_OUTPUT', outputDigest: 'digest_s3m' });
    const blocked =
      VALUATION_IS_NOT_HUMAN_WORTH &&
      AI_FINAL_VALUATION_AUTHORITY_FORBIDDEN &&
      CONTRIBUTION_NOT_HUMAN_WORTH.length > 0 &&
      !trait.ok &&
      !worth.ok &&
      !peve.ok &&
      peveMint.code === 'PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY' &&
      aiMint.code === 'AI_CANNOT_AUTHORIZE_ISSUANCE' &&
      s3mMint.code === 'S3M_CANNOT_AUTHORIZE_ISSUANCE';
    return {
      blocked,
      safetyHeld: blocked,
      detail: `${scenario.scenarioId} trait=${trait.ok ? 'ok' : trait.error.code} worth=${worth.ok ? 'ok' : worth.error.code} aiMint=${aiMint.code} peveMint=${peveMint.code}`,
    };
  });
}
