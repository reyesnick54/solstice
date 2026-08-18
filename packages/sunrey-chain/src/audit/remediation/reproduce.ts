import type { ExternalSecurityFinding } from './types.ts';

export type FindingReproductionResult = {
  readonly findingId: string;
  readonly isolatedFixture: true;
  readonly productionTarget: false;
  readonly adaptedFromExternalExample: boolean;
  readonly reproduced: boolean;
  readonly evidenceReference: string;
  readonly notes: string;
};

/**
 * Safe finding reproduction harness. External exploit examples are
 * adapted to isolated development/testnet fixtures. They never target
 * production.
 */
export function reproduceFinding(input: {
  readonly finding: ExternalSecurityFinding;
  readonly isolatedFixtureId: string;
  readonly adaptedFromExternalExample: boolean;
  readonly reproduced: boolean;
  readonly evidenceReference: string;
}): FindingReproductionResult {
  if (!input.isolatedFixtureId.trim()) {
    throw new Error('reproduction requires an isolated development/testnet fixture');
  }
  if (/prod|mainnet|live/i.test(input.isolatedFixtureId)) {
    throw new Error('external exploit examples must not target production');
  }
  return Object.freeze({
    findingId: input.finding.findingId,
    isolatedFixture: true,
    productionTarget: false,
    adaptedFromExternalExample: input.adaptedFromExternalExample,
    reproduced: input.reproduced,
    evidenceReference: input.evidenceReference,
    notes: input.reproduced
      ? 'Reproduced against an isolated development/testnet fixture.'
      : 'Not reproducible with the supplied isolated fixture evidence.',
  });
}
