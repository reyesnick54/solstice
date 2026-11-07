/**
 * HELIOS ALT02 — provider alternative-data rights registry (composes with ProviderRegistry).
 */

import type { AlternativeDataRightsManifest, ProviderRevocationState } from './types.ts';
import { validateAlternativeDataRightsManifest } from './validate.ts';

export type AlternativeDataRightsRegistryEntry = {
  readonly manifest: AlternativeDataRightsManifest;
  readonly revocation: ProviderRevocationState;
  readonly grantsExecutionAuthority: false;
};

export type AlternativeDataRightsRegistry = {
  register(entry: AlternativeDataRightsRegistryEntry): void;
  unregister(providerId: string, sourceId: string): boolean;
  get(providerId: string, sourceId: string): AlternativeDataRightsRegistryEntry | undefined;
  getByProvider(providerId: string): readonly AlternativeDataRightsRegistryEntry[];
  list(): readonly AlternativeDataRightsRegistryEntry[];
};

function entryKey(providerId: string, sourceId: string): string {
  return `${providerId}\0${sourceId}`;
}

export function createAlternativeDataRightsRegistry(): AlternativeDataRightsRegistry {
  const map = new Map<string, AlternativeDataRightsRegistryEntry>();

  function register(entry: AlternativeDataRightsRegistryEntry): void {
    const validation = validateAlternativeDataRightsManifest(entry.manifest);
    if (!validation.valid) {
      throw new Error(
        `alternative-data rights manifest for ${entry.manifest.providerId} invalid: ${validation.codes.join(', ')}`,
      );
    }
    map.set(entryKey(entry.manifest.providerId, entry.manifest.sourceId), Object.freeze(entry));
  }

  function unregister(providerId: string, sourceId: string): boolean {
    return map.delete(entryKey(providerId, sourceId));
  }

  function get(providerId: string, sourceId: string): AlternativeDataRightsRegistryEntry | undefined {
    return map.get(entryKey(providerId, sourceId));
  }

  function getByProvider(providerId: string): readonly AlternativeDataRightsRegistryEntry[] {
    return Object.freeze([...map.values()].filter((row) => row.manifest.providerId === providerId));
  }

  function list(): readonly AlternativeDataRightsRegistryEntry[] {
    return Object.freeze([...map.values()]);
  }

  return Object.freeze({ register, unregister, get, getByProvider, list });
}
