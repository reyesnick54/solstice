/**
 * Wave 4 — governed connector registry and bootstrap.
 */

import { loadCatalogFromYaml, getCatalogEntry } from '../catalog/loader.ts';
import type { CatalogIndex } from '../catalog/loader.ts';
import type { ProviderDefinition } from './provider-definition.ts';
import {
  catalogEntryToProviderDefinition,
  type ConnectorType,
} from './provider-definition.ts';
import type { GovernedConnector } from './governed-connector.ts';
import { RestGovernedConnector } from './rest-connector.ts';
import {
  createProviderLineageRegistry,
  type ProviderLineageRegistry,
} from './lineage.ts';
import { secretRef } from '../../../security/src/secrets.ts';
import type { ExtensibleSourceClass } from './source-class.ts';

export type ConnectorRegistryOptions = {
  readonly catalogIndex?: CatalogIndex;
  readonly lineage?: ProviderLineageRegistry;
};

export class GovernedConnectorRegistry {
  readonly #catalog: CatalogIndex;
  readonly #lineage: ProviderLineageRegistry;
  readonly #connectors = new Map<string, GovernedConnector>();
  readonly #definitions = new Map<string, ProviderDefinition>();

  constructor(options: ConnectorRegistryOptions = {}) {
    this.#catalog = options.catalogIndex ?? loadCatalogFromYaml();
    this.#lineage = options.lineage ?? createProviderLineageRegistry();
  }

  get lineage(): ProviderLineageRegistry {
    return this.#lineage;
  }

  registerDefinition(definition: ProviderDefinition): void {
    this.#definitions.set(definition.providerId, definition);
  }

  registerConnector(connector: GovernedConnector): void {
    this.#connectors.set(connector.definition.providerId, connector);
    this.#definitions.set(connector.definition.providerId, connector.definition);
  }

  getDefinition(providerId: string): ProviderDefinition | undefined {
    return this.#definitions.get(providerId);
  }

  getConnector(providerId: string): GovernedConnector | undefined {
    return this.#connectors.get(providerId);
  }

  listDefinitions(): readonly ProviderDefinition[] {
    return Object.freeze([...this.#definitions.values()]);
  }

  listConnectors(): readonly GovernedConnector[] {
    return Object.freeze([...this.#connectors.values()]);
  }

  loadDefinitionFromCatalog(
    providerId: string,
    overrides?: Partial<{
      readonly sourceClass: ExtensibleSourceClass;
      readonly connectorType: ConnectorType;
    }>,
  ): ProviderDefinition | undefined {
    const entry = getCatalogEntry(this.#catalog, providerId);
    if (!entry) {
      return undefined;
    }
    const definition = catalogEntryToProviderDefinition(entry, overrides);
    this.registerDefinition(definition);
    return definition;
  }
}

export function bootstrapWave4MigratedConnectors(
  registry: GovernedConnectorRegistry,
): readonly GovernedConnector[] {
  const lineage = registry.lineage;

  lineage.registerOrigin({
    providerId: 'eia',
    datasetId: 'eia:open-data-v2',
  });
  lineage.registerDerivation({
    providerId: 'eia-republisher-a',
    upstreamProviderId: 'eia',
    relationship: 'REPUBLISHES',
    notes: 'Fixture republisher — not independent of EIA',
  });
  lineage.registerDerivation({
    providerId: 'eia-republisher-b',
    upstreamProviderId: 'eia',
    relationship: 'REPUBLISHES',
    notes: 'Fixture republisher — not independent of EIA',
  });

  lineage.registerOrigin({
    providerId: 'national-grid-eso',
    datasetId: 'national-grid-eso:grid-generation',
  });

  const connectors: GovernedConnector[] = [];

  const nationalGridDef = registry.loadDefinitionFromCatalog('national-grid-eso', {
    sourceClass: 'PRIMARY_OPERATOR',
  });
  if (nationalGridDef) {
    const lineageRecord = lineage.get('national-grid-eso');
    const connector = new RestGovernedConnector({
      definition: nationalGridDef,
      fixtures: [{ operation: 'generation', filename: 'generation.json' }],
      ...(lineageRecord ? { lineage: lineageRecord } : {}),
    });
    registry.registerConnector(connector);
    connectors.push(connector);
  }

  const usdaDef = registry.loadDefinitionFromCatalog('usda-fooddata-central', {
    sourceClass: 'GOVERNMENT',
  });
  if (usdaDef) {
    const connector = new RestGovernedConnector({
      definition: usdaDef,
      fixtures: [{ operation: 'search', filename: 'search.json' }],
      authStrategy: {
        kind: 'api_key_query',
        paramName: 'api_key',
        secretRef: secretRef('environment', 'USDA_FDC_API_KEY'),
      },
    });
    registry.registerConnector(connector);
    connectors.push(connector);
  }

  const arbeitnowDef = registry.loadDefinitionFromCatalog('arbeitnow', {
    sourceClass: 'AGGREGATOR',
  });
  if (arbeitnowDef) {
    const arbeitnowLineage = lineage.get('arbeitnow');
    const connector = new RestGovernedConnector({
      definition: arbeitnowDef,
      fixtures: [{ operation: 'jobs', filename: 'jobs.json' }],
      ...(arbeitnowLineage ? { lineage: arbeitnowLineage } : {}),
    });
    registry.registerConnector(connector);
    connectors.push(connector);
  }

  const noozraDef = registry.loadDefinitionFromCatalog('noozra', {
    sourceClass: 'AGGREGATOR',
  });
  if (noozraDef) {
    const connector = new RestGovernedConnector({
      definition: noozraDef,
      fixtures: [{ operation: 'intelligence', filename: 'intelligence.json' }],
    });
    registry.registerConnector(connector);
    connectors.push(connector);
  }

  return Object.freeze(connectors);
}

export function createGovernedConnectorRegistry(
  options: ConnectorRegistryOptions = {},
): GovernedConnectorRegistry {
  return new GovernedConnectorRegistry(options);
}
