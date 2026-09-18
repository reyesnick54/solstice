import { JURISDICTION_CAPABILITY_PACKS } from './seed.ts';
import { createJurisdictionCapabilityRegistry, JurisdictionCapabilityRegistry } from './registry.ts';
import { JurisdictionCapabilityStore } from './store.ts';

export type JurisdictionCapabilityFramework = {
  readonly registry: JurisdictionCapabilityRegistry;
  readonly store: JurisdictionCapabilityStore;
};

export function createJurisdictionCapabilityFramework(
  options: {
    readonly registry?: JurisdictionCapabilityRegistry;
    readonly store?: JurisdictionCapabilityStore;
  } = {},
): JurisdictionCapabilityFramework {
  const registry = options.registry ?? createJurisdictionCapabilityRegistry(JURISDICTION_CAPABILITY_PACKS);
  const store = options.store ?? new JurisdictionCapabilityStore();
  return Object.freeze({ registry, store });
}
