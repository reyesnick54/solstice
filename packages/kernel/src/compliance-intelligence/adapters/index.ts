/**
 * Compliance intelligence adapter factory.
 */

import { createInterpolRedNoticesAdapter, InterpolRedNoticesAdapter } from './interpol-red-notices.ts';
import { createOpenSanctionsAdapter, OpenSanctionsAdapter } from './open-sanctions.ts';

export { OpenSanctionsAdapter, createOpenSanctionsAdapter } from './open-sanctions.ts';
export { InterpolRedNoticesAdapter, createInterpolRedNoticesAdapter } from './interpol-red-notices.ts';
export * from './base.ts';

export type Wave4ComplianceFixtureProviders = {
  readonly openSanctions: OpenSanctionsAdapter;
  readonly interpol: InterpolRedNoticesAdapter;
};

export function createWave4ComplianceFixtureProviders(): Wave4ComplianceFixtureProviders {
  return Object.freeze({
    openSanctions: createOpenSanctionsAdapter(),
    interpol: createInterpolRedNoticesAdapter(),
  });
}

export function createAllComplianceIntelligenceAdapters() {
  const fixtures = createWave4ComplianceFixtureProviders();
  return Object.freeze([fixtures.openSanctions, fixtures.interpol]);
}
