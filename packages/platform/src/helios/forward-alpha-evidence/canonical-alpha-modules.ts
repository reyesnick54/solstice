/**
 * ALPHA16 — canonical implementation owners for ALPHA01–ALPHA15 (current-main integration).
 */

export type CanonicalAlphaModuleRow = {
  readonly packageId: string;
  readonly capability: string;
  readonly implementationOwner: string;
  readonly entryModule: string;
  readonly qualificationTest?: string;
};

export const CANONICAL_ALPHA_MODULES: readonly CanonicalAlphaModuleRow[] = Object.freeze([
  Object.freeze({
    packageId: 'ALPHA01',
    capability: 'Forward alpha evidence domain',
    implementationOwner: 'packages/platform/src/helios/forward-alpha-evidence',
    entryModule: 'packages/platform/src/helios/forward-alpha-evidence/alpha01-evidence-domain.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA02',
    capability: 'Campaign pre-registration and statistical policy freeze',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha02',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha02/index.ts',
    qualificationTest: 'tests/helios-alpha02-forward-preregistration.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA03',
    capability: 'Prequential evaluation engine',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha03',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha03/index.ts',
    qualificationTest: 'tests/helios-alpha03-prequential-engine.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA04',
    capability: 'Shadow capital forward book',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha04-shadow-capital',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha04-shadow-capital/index.ts',
    qualificationTest: 'tests/helios-alpha04-shadow-capital.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA05',
    capability: 'Benchmark attribution',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha05',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha05/index.ts',
    qualificationTest: 'tests/helios-alpha05-benchmark-attribution.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA06',
    capability: 'Execution realism overlay',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha06',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha06/index.ts',
    qualificationTest: 'tests/helios-alpha06-forward-execution-realism.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA07',
    capability: 'Sequential statistical evidence',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha07-sequential-evidence',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha07-sequential-evidence/index.ts',
    qualificationTest: 'tests/helios-forward-alpha-alpha07-sequential-evidence.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA08',
    capability: 'Multiple-testing firewall',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha08',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha08/index.ts',
    qualificationTest: 'tests/helios-forward-alpha08-data-snooping-firewall.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA09',
    capability: 'Risk and tail evidence',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha09',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha09/index.ts',
    qualificationTest: 'tests/helios-alpha09-risk-adjusted-evidence.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA10',
    capability: 'Regime robustness',
    implementationOwner: 'packages/strategy-lab/src/alpha10',
    entryModule: 'packages/strategy-lab/src/alpha10/index.ts',
    qualificationTest: 'tests/helios-alpha10-forward-regime-robustness.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA11',
    capability: 'Alpha decay and drift detection',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha11',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha11/index.ts',
    qualificationTest: 'tests/helios-alpha11-alpha-decay.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA12',
    capability: 'Capacity evidence',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha12',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha12/index.ts',
    qualificationTest: 'tests/helios-alpha12-capacity-engine.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA13',
    capability: 'Portfolio forward evidence',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha13',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha13/index.ts',
    qualificationTest: 'tests/helios-alpha13-portfolio-forward-evidence.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA14',
    capability: 'Agentic evidence committee',
    implementationOwner: 'packages/agentic-capital-mesh/src/alpha-evidence-agentic-committee',
    entryModule: 'packages/agentic-capital-mesh/src/alpha-evidence-agentic-committee/index.ts',
    qualificationTest: 'tests/helios-alpha14-agentic-evidence-committee.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA15',
    capability: 'Forward-alpha evidence qualification and reality gate',
    implementationOwner: 'packages/platform/src/helios/forward-alpha-evidence',
    entryModule: 'packages/platform/src/helios/forward-alpha-evidence/alpha15-qualification.ts',
    qualificationTest: 'tests/helios-alpha15-forward-alpha-qualification.test.ts',
  }),
]);
