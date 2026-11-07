/**
 * Compose ProviderRegistry with AlternativeDataRightsRegistry.
 */

import type { ProviderRegistry } from '../registry.ts';
import type { AlternativeDataRightsRegistry } from './registry.ts';

export type AlternativeDataProviderBinding = {
  readonly providerId: string;
  readonly sourceId: string;
  readonly hasRightsManifest: boolean;
  readonly catalogListsAlternativeData: boolean;
  readonly grantsExecutionAuthority: false;
};

export function listAlternativeDataProviderBindings(input: {
  readonly providerRegistry: ProviderRegistry;
  readonly rightsRegistry: AlternativeDataRightsRegistry;
}): readonly AlternativeDataProviderBinding[] {
  const seen = new Set<string>();
  const out: AlternativeDataProviderBinding[] = [];

  const emitRightsRows = (providerId: string, catalogListsAlternativeData: boolean) => {
    const rightsEntries = input.rightsRegistry.getByProvider(providerId);
    if (rightsEntries.length === 0) {
      if (catalogListsAlternativeData) {
        out.push(
          Object.freeze({
            providerId,
            sourceId: `${providerId}:default`,
            hasRightsManifest: false,
            catalogListsAlternativeData: true,
            grantsExecutionAuthority: false,
          }),
        );
      }
      return;
    }
    for (const row of rightsEntries) {
      const key = `${providerId}:${row.manifest.sourceId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(
        Object.freeze({
          providerId,
          sourceId: row.manifest.sourceId,
          hasRightsManifest: true,
          catalogListsAlternativeData,
          grantsExecutionAuthority: false,
        }),
      );
    }
  };

  for (const registration of input.providerRegistry.list()) {
    const providerId = registration.provider.id;
    const catalogEntry = input.providerRegistry.getCatalogEntry(providerId);
    const catalogListsAlternativeData =
      catalogEntry?.capabilities.includes('alternative_data') === true ||
      (catalogEntry?.capabilities ?? []).some((cap) => cap === 'alternative_data');
    emitRightsRows(providerId, catalogListsAlternativeData);
  }

  for (const entry of input.rightsRegistry.list()) {
    const providerId = entry.manifest.providerId;
    const catalogEntry = input.providerRegistry.getCatalogEntry(providerId);
    const catalogListsAlternativeData =
      catalogEntry?.capabilities.includes('alternative_data') === true ||
      (catalogEntry?.capabilities ?? []).some((cap) => cap === 'alternative_data');
    emitRightsRows(providerId, catalogListsAlternativeData);
  }

  return Object.freeze(out);
}
