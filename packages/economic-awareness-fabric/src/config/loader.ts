import { DEFAULT_FABRIC_CONFIG } from './defaults.ts';

export type FabricConfig = {
  readonly schemaVersion: string;
  readonly fabricId: string;
  readonly environment: string;
  readonly providerRegistry: {
    readonly catalogPath: string;
    readonly requireCatalogEntry: boolean;
    readonly unknownProviderTrust: string;
  };
  readonly connectorActivation: {
    readonly defaultMode: string;
    readonly allowedModes: readonly string[];
    readonly blockedInCi: string;
  };
  readonly failClosed: Readonly<Record<string, boolean>>;
};

export { DEFAULT_FABRIC_CONFIG } from './defaults.ts';

/**
 * Loads fabric configuration. Versioned YAML lives at
 * `config/economic-awareness-fabric/fabric-default.yaml` (no secrets).
 * Runtime uses typed defaults until a shared config loader is wired.
 */
export function loadFabricConfig(): FabricConfig {
  return DEFAULT_FABRIC_CONFIG;
}
