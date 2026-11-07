import type { Exec14BrokerAssetClass } from './taxonomy.ts';
import {
  availableField,
  type Exec14BooleanCapability,
  type Exec14DeclaredField,
  unavailableField,
} from './declared-field.ts';
import type { Exec14BrokerRateLimits } from './broker-capability-manifest.ts';

export type CustodyCapabilityManifest = Readonly<{
  readonly schemaVersion: typeof import('./taxonomy.ts').HELIOS_EXEC14_SCHEMA_VERSION;
  readonly providerId: string;
  readonly displayName: string;
  readonly assetClasses: Exec14DeclaredField<readonly Exec14BrokerAssetClass[]>;
  readonly fractionalShares: Exec14BooleanCapability;
  readonly positions: Exec14BooleanCapability;
  readonly cash: Exec14BooleanCapability;
  readonly settlements: Exec14BooleanCapability;
  readonly corporateActions: Exec14BooleanCapability;
  readonly marketDataDependency: Exec14DeclaredField<readonly string[]>;
  readonly rateLimits: Exec14DeclaredField<Exec14BrokerRateLimits>;
  readonly webhookIngest: Exec14BooleanCapability;
  readonly travelRulePosture: Exec14DeclaredField<'FIXTURE_ONLY' | 'PROVIDER_CANDIDATE'>;
  readonly liveNetworkConnected: false;
  readonly productionAuthorized: false;
  readonly qualificationNotes: readonly string[];
}>;

export function assertCustodyManifestFailClosed(manifest: CustodyCapabilityManifest): readonly string[] {
  const violations: string[] = [];
  if (manifest.liveNetworkConnected !== false) {
    violations.push('liveNetworkConnected must be false');
  }
  if (manifest.productionAuthorized !== false) {
    violations.push('productionAuthorized must be false');
  }
  if (!manifest.providerId.trim()) {
    violations.push('providerId missing');
  }
  return Object.freeze(violations);
}

export function fixtureSandboxCustodyManifest(providerId = 'fixture_custody_exec14'): CustodyCapabilityManifest {
  return Object.freeze({
    schemaVersion: 'helios.execution-connectivity.exec14.v1',
    providerId,
    displayName: 'Fixture sandbox custodian (EXEC14)',
    assetClasses: availableField(Object.freeze(['crypto_spot'] as const)),
    fractionalShares: unavailableField(),
    positions: availableField(true),
    cash: availableField(true),
    settlements: availableField(true),
    corporateActions: unavailableField(),
    marketDataDependency: unavailableField(),
    rateLimits: availableField(
      Object.freeze({
        ordersPerSecond: null,
        statusQueriesPerSecond: 10,
        streamingConnectionsMax: 1,
        notes: 'fixture custody API limits',
      }),
    ),
    webhookIngest: availableField(true),
    travelRulePosture: availableField('FIXTURE_ONLY'),
    liveNetworkConnected: false,
    productionAuthorized: false,
    qualificationNotes: Object.freeze(['deterministic sandbox', 'not a live custodian']),
  });
}
