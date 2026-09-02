export { WAVE4_ECONOMIC_AWARENESS_FABRIC_CAPABILITY } from './capability.ts';
export { createEconomicAwarenessFabric } from './fabric.ts';
export type { EconomicAwarenessFabric, EconomicAwarenessFabricPorts } from './fabric.ts';

export * as authority from './authority/index.ts';
export * as providers from './providers/index.ts';
export * as connectors from './connectors/index.ts';
export * as ingestion from './ingestion/index.ts';
export * as normalization from './normalization/index.ts';
export * as provenance from './provenance/index.ts';
export * as events from './events/index.ts';
export * as federation from './federation/index.ts';
export * as entities from './entities/index.ts';
export * as graph from './graph/index.ts';
export * as corroboration from './corroboration/index.ts';
export * as reputation from './reputation/index.ts';
export * as consensus from './consensus/index.ts';
export * as evidence from './evidence/index.ts';
export * as config from './config/index.ts';
export * as harness from './harness/index.ts';

export { FAIL_CLOSED_RULES } from './authority/fail-closed.ts';
export { capabilityBlocksMonetaryMutation } from './authority/information-authority.ts';
