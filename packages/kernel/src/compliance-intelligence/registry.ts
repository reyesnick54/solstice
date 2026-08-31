/**
 * Compliance intelligence provider registry.
 */

import { createAllComplianceIntelligenceAdapters } from './adapters/index.ts';
import {
  buildComplianceCatalogIndex,
  type ComplianceCatalogIndex,
  type ComplianceCatalogProviderEntry,
} from './catalog-types.ts';
import {
  COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES,
  COMPLIANCE_INTELLIGENCE_CATALOG_PROVIDER_IDS,
} from './catalog-entries.ts';
import type { ComplianceIntelligenceProvider } from './provider.ts';

export const COMPLIANCE_INTELLIGENCE_CATEGORIES = Object.freeze(['compliance']);

export const COMPLIANCE_INTELLIGENCE_CAPABILITIES = Object.freeze([
  'sanctions',
  'pep_screening',
  'watchlists',
  'wanted_persons',
  'adverse_regulatory_data',
  'public_enforcement_data',
  'entity_resolution',
]);

export type ComplianceIntelligenceCatalogMatch = {
  readonly entry: ComplianceCatalogProviderEntry;
  readonly matchedCapabilities: readonly string[];
};

export function isComplianceIntelligenceCategory(entry: ComplianceCatalogProviderEntry): boolean {
  if (entry.primary_category === 'compliance') return true;
  return (entry.sunrey.domain as readonly string[]).includes('compliance');
}

export function complianceCapabilitiesOf(entry: ComplianceCatalogProviderEntry): readonly string[] {
  return entry.capabilities.filter((cap) =>
    (COMPLIANCE_INTELLIGENCE_CAPABILITIES as readonly string[]).includes(cap),
  );
}

function defaultComplianceCatalogIndex(): ComplianceCatalogIndex {
  return buildComplianceCatalogIndex(COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES);
}

export function loadComplianceIntelligenceCatalog(
  index?: ComplianceCatalogIndex,
): readonly ComplianceIntelligenceCatalogMatch[] {
  const catalogIndex = index ?? defaultComplianceCatalogIndex();
  return Object.freeze(
    COMPLIANCE_INTELLIGENCE_CATALOG_PROVIDER_IDS.map((id) => {
      const entry = catalogIndex.byId.get(id);
      if (!entry) {
        throw new Error(`compliance provider ${id} missing from catalog index`);
      }
      return Object.freeze({
        entry,
        matchedCapabilities: complianceCapabilitiesOf(entry),
      });
    }),
  );
}

export function createComplianceIntelligenceAdapterFactory() {
  const adapters = createAllComplianceIntelligenceAdapters();
  return Object.freeze({
    createAll(): readonly ComplianceIntelligenceProvider[] {
      return adapters;
    },
    getById(providerId: string): ComplianceIntelligenceProvider | undefined {
      return adapters.find((a) => a.providerId === providerId);
    },
  });
}
