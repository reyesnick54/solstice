import { PolicyEngine } from './engine.ts';
import { loadBundledPacks } from './packs/load.ts';
import { PolicyRegistry, type PolicyEventSink } from './registry.ts';
import { ManualReviewRegistry } from './review.ts';
import { POLICY_PRODUCT_BINDINGS, POLICY_SOURCES, SIMULATION_CAPABILITIES } from './seed.ts';

export function createSimulationPolicyEngine(events?: PolicyEventSink): PolicyEngine {
  const registry = new PolicyRegistry();
  registry.hydrate({
    packs: loadBundledPacks(),
    capabilities: SIMULATION_CAPABILITIES,
    products: POLICY_PRODUCT_BINDINGS,
    sources: POLICY_SOURCES,
  });
  return new PolicyEngine({
    registry,
    reviews: new ManualReviewRegistry(),
    ...(events ? { events } : {}),
  });
}
