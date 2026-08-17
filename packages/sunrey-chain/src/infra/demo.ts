import { runLocalProductionCandidateHarness } from './harness.ts';

const harness = runLocalProductionCandidateHarness();
console.log(`sunrey-infra environment=${harness.environment}`);
console.log(`providers=${harness.registry.list().length}`);
console.log(`identities=${harness.identities.list().length}`);
console.log(`hsm=${harness.provider.hsm().readiness}`);
console.log(`reportDigest=${harness.report.reportDigest}`);
console.log(`mainnetEnabled=${String(harness.report.mainnetEnabled)}`);
console.log(`secretValuePresent=${String(harness.report.secretValuePresent)}`);
