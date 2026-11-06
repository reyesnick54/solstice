import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { HELIOS_EVOL07_NOVELTY_ENGINE_BLOCKED, HELIOS_EVOL07_NOVELTY_ENGINE_QUALIFIED } from './taxonomy.ts';

export { HELIOS_EVOL07_NOVELTY_ENGINE_BLOCKED, HELIOS_EVOL07_NOVELTY_ENGINE_QUALIFIED };

export type Evol07QualificationChecks = {
  readonly behavioralFingerprintModule: boolean;
  readonly semanticFingerprintModule: boolean;
  readonly noveltyScoreModule: boolean;
  readonly distanceModule: boolean;
  readonly antiCloneModule: boolean;
  readonly researchSelectionModule: boolean;
  readonly taxonomyMarkers: boolean;
  readonly knownAnswerTestPresent: boolean;
};

export type Evol07QualificationResult = {
  readonly marker: typeof HELIOS_EVOL07_NOVELTY_ENGINE_QUALIFIED | typeof HELIOS_EVOL07_NOVELTY_ENGINE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateEvol07NoveltyEngineQualification(checks: Evol07QualificationChecks): Evol07QualificationResult {
  const entries: [keyof Evol07QualificationChecks, string][] = [
    ['behavioralFingerprintModule', 'behavior_fingerprint'],
    ['semanticFingerprintModule', 'semantic_fingerprint'],
    ['noveltyScoreModule', 'novelty_score'],
    ['distanceModule', 'distance'],
    ['antiCloneModule', 'anti_clone'],
    ['researchSelectionModule', 'research_selection'],
    ['taxonomyMarkers', 'taxonomy'],
    ['knownAnswerTestPresent', 'evol07_test'],
  ];
  const blockers = entries.filter(([k]) => !checks[k]).map(([, label]) => label);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_EVOL07_NOVELTY_ENGINE_QUALIFIED : HELIOS_EVOL07_NOVELTY_ENGINE_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

export function evol07EngineeringQualificationChecks(root: string): Evol07QualificationChecks {
  const base = join(root, 'packages/strategy-lab/src/evol07');
  const testPath = join(root, 'packages/strategy-lab/src/evol07/evol07.test.ts');
  return Object.freeze({
    behavioralFingerprintModule: existsSync(join(base, 'behavior-fingerprint.ts')),
    semanticFingerprintModule: existsSync(join(base, 'semantic-fingerprint.ts')),
    noveltyScoreModule: existsSync(join(base, 'novelty-score.ts')),
    distanceModule: existsSync(join(base, 'distance.ts')),
    antiCloneModule: existsSync(join(base, 'anti-clone.ts')),
    researchSelectionModule: existsSync(join(base, 'research-selection.ts')),
    taxonomyMarkers: existsSync(join(base, 'taxonomy.ts')),
    knownAnswerTestPresent: existsSync(testPath),
  });
}
