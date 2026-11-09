/**
 * ALPHA26 — canonical implementation owners for ALPHA16–ALPHA25 (current-main integration).
 */

export type CanonicalShadowModuleRow = {
  readonly packageId: string;
  readonly capability: string;
  readonly implementationOwner: string;
  readonly entryModule: string;
  readonly bridgeModule: string;
  readonly qualificationTest: string;
};

export const CANONICAL_SHADOW_MODULES: readonly CanonicalShadowModuleRow[] = Object.freeze([
  Object.freeze({
    packageId: 'ALPHA16',
    capability: 'Current-main forward-alpha evidence prerequisite',
    implementationOwner: 'packages/platform/src/helios/forward-alpha-evidence',
    entryModule: 'packages/platform/src/helios/forward-alpha-evidence/alpha15-qualification.ts',
    bridgeModule: 'packages/platform/src/helios/autonomous-shadow-lab/alpha16-current-main.ts',
    qualificationTest: 'tests/helios-alpha15-forward-alpha-qualification.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA17',
    capability: 'Autonomous forward campaign orchestrator',
    implementationOwner: 'packages/strategy-lab/src/forward-alpha/campaign-orchestrator',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha17/index.ts',
    bridgeModule: 'packages/platform/src/helios/autonomous-shadow-lab/alpha17-campaign-orchestration.ts',
    qualificationTest: 'tests/helios-alpha17-campaign-orchestrator.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA18',
    capability: 'Genuine forward data admission',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha18',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha18/index.ts',
    bridgeModule: 'packages/platform/src/helios/autonomous-shadow-lab/alpha18-forward-data-admission.ts',
    qualificationTest: 'tests/helios-forward-alpha-alpha18-forward-data-admission.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA19',
    capability: 'Outcome maturity and delayed label engine',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha19',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha19/index.ts',
    bridgeModule: 'packages/platform/src/helios/autonomous-shadow-lab/alpha19-outcome-maturity.ts',
    qualificationTest: 'tests/helios-alpha19-outcome-maturity.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA20',
    capability: 'Experimental forward cohorts',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha20',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha20/index.ts',
    bridgeModule: 'packages/platform/src/helios/autonomous-shadow-lab/alpha20-experimental-cohorts.ts',
    qualificationTest: 'tests/helios-alpha20-forward-experiments.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA21',
    capability: 'Continuous shadow portfolio runtime',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha21',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha21/index.ts',
    bridgeModule: 'packages/platform/src/helios/autonomous-shadow-lab/alpha21-continuous-shadow-portfolio.ts',
    qualificationTest: 'tests/helios-alpha21-continuous-shadow-runtime.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA22',
    capability: 'Shadow lab control room and engineering SLOs',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha22-shadow-control-room',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha22-shadow-control-room/index.ts',
    bridgeModule: 'packages/platform/src/helios/autonomous-shadow-lab/alpha22-control-room.ts',
    qualificationTest: 'tests/helios-alpha22-shadow-control-room.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA23',
    capability: 'Automatic strategy demotion',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha23',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha23/index.ts',
    bridgeModule: 'packages/platform/src/helios/autonomous-shadow-lab/alpha23-automatic-demotion.ts',
    qualificationTest: 'tests/helios-alpha23-automatic-demotion.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA24',
    capability: 'Recurring daily and weekly research books',
    implementationOwner: 'packages/platform/src/helios/forward-alpha/alpha24',
    entryModule: 'packages/platform/src/helios/forward-alpha/alpha24/index.ts',
    bridgeModule: 'packages/platform/src/helios/autonomous-shadow-lab/alpha24-recurring-evidence-reports.ts',
    qualificationTest: 'tests/helios-alpha24-research-book.test.ts',
  }),
  Object.freeze({
    packageId: 'ALPHA25',
    capability: 'Autonomous shadow lab final qualification',
    implementationOwner: 'packages/platform/src/helios/autonomous-shadow-lab',
    entryModule: 'packages/platform/src/helios/autonomous-shadow-lab/alpha25-qualification.ts',
    bridgeModule: 'packages/platform/src/helios/autonomous-shadow-lab/alpha25-qualification.ts',
    qualificationTest: 'tests/helios-alpha25-autonomous-shadow-lab-qualification.test.ts',
  }),
]);
