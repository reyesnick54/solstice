import type {
  Exec14BrokerAssetClass,
  Exec14BrokerOrderType,
  Exec14BrokerTimeInForce,
} from './taxonomy.ts';
import {
  availableField,
  type Exec14BooleanCapability,
  type Exec14DeclaredField,
  unavailableField,
} from './declared-field.ts';

export type Exec14BrokerRateLimits = Readonly<{
  readonly ordersPerSecond: number | null;
  readonly statusQueriesPerSecond: number | null;
  readonly streamingConnectionsMax: number | null;
  readonly notes: string | null;
}>;

export type BrokerCapabilityManifest = Readonly<{
  readonly schemaVersion: typeof import('./taxonomy.ts').HELIOS_EXEC14_SCHEMA_VERSION;
  readonly providerId: string;
  readonly displayName: string;
  readonly orderTypes: Exec14DeclaredField<readonly Exec14BrokerOrderType[]>;
  readonly timeInForce: Exec14DeclaredField<readonly Exec14BrokerTimeInForce[]>;
  readonly assetClasses: Exec14DeclaredField<readonly Exec14BrokerAssetClass[]>;
  readonly fractionalShares: Exec14BooleanCapability;
  readonly extendedHours: Exec14BooleanCapability;
  readonly cancelReplace: Exec14BooleanCapability;
  readonly statusQuery: Exec14BooleanCapability;
  readonly streamingExecutionReports: Exec14BooleanCapability;
  readonly dropCopy: Exec14BooleanCapability;
  readonly positions: Exec14BooleanCapability;
  readonly cash: Exec14BooleanCapability;
  readonly settlements: Exec14BooleanCapability;
  readonly corporateActions: Exec14BooleanCapability;
  readonly marketDataDependency: Exec14DeclaredField<readonly string[]>;
  readonly rateLimits: Exec14DeclaredField<Exec14BrokerRateLimits>;
  readonly liveOrderPlacementEnabled: false;
  readonly productionAuthorized: false;
  readonly qualificationNotes: readonly string[];
}>;

export function assertBrokerManifestFailClosed(manifest: BrokerCapabilityManifest): readonly string[] {
  const violations: string[] = [];
  if (manifest.liveOrderPlacementEnabled !== false) {
    violations.push('liveOrderPlacementEnabled must be false');
  }
  if (manifest.productionAuthorized !== false) {
    violations.push('productionAuthorized must be false');
  }
  if (!manifest.providerId.trim()) {
    violations.push('providerId missing');
  }
  const paths: Array<[string, Exec14DeclaredField<unknown> | Exec14BooleanCapability]> = [
    ['orderTypes', manifest.orderTypes],
    ['timeInForce', manifest.timeInForce],
    ['assetClasses', manifest.assetClasses],
    ['fractionalShares', manifest.fractionalShares],
    ['extendedHours', manifest.extendedHours],
    ['cancelReplace', manifest.cancelReplace],
    ['statusQuery', manifest.statusQuery],
    ['streamingExecutionReports', manifest.streamingExecutionReports],
    ['dropCopy', manifest.dropCopy],
    ['positions', manifest.positions],
    ['cash', manifest.cash],
    ['settlements', manifest.settlements],
    ['corporateActions', manifest.corporateActions],
    ['marketDataDependency', manifest.marketDataDependency],
    ['rateLimits', manifest.rateLimits],
  ];
  for (const [path, field] of paths) {
    if (field.availability !== 'AVAILABLE' && field.availability !== 'UNAVAILABLE') {
      violations.push(`${path}: capability not explicitly declared`);
    }
  }
  return Object.freeze(violations);
}

export function fixtureSandboxBrokerManifest(providerId = 'fixture_broker_exec14'): BrokerCapabilityManifest {
  return Object.freeze({
    schemaVersion: 'helios.execution-connectivity.exec14.v1',
    providerId,
    displayName: 'Fixture sandbox broker (EXEC14)',
    orderTypes: availableField(Object.freeze(['MARKET', 'LIMIT'] as const)),
    timeInForce: availableField(Object.freeze(['DAY', 'GTC'] as const)),
    assetClasses: availableField(Object.freeze(['us_equity', 'us_etf'] as const)),
    fractionalShares: availableField(true),
    extendedHours: unavailableField(),
    cancelReplace: availableField(true),
    statusQuery: availableField(true),
    streamingExecutionReports: availableField(true),
    dropCopy: unavailableField(),
    positions: availableField(true),
    cash: availableField(true),
    settlements: availableField(true),
    corporateActions: unavailableField(),
    marketDataDependency: availableField(Object.freeze(['helios-md07-us-equity'] as const)),
    rateLimits: availableField(
      Object.freeze({
        ordersPerSecond: 5,
        statusQueriesPerSecond: 20,
        streamingConnectionsMax: 2,
        notes: 'fixture limits only',
      }),
    ),
    liveOrderPlacementEnabled: false,
    productionAuthorized: false,
    qualificationNotes: Object.freeze(['fixture transport', 'no live broker connectivity']),
  });
}
