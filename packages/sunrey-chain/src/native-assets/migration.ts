import { CURRENT_APPLICATION_AUTHORITY, NATIVE_BLOCKCHAIN_AUTHORITY } from './authority.ts';
import { NATIVE_ASSET_TICKER_STATUS } from '../protocol/assets.ts';

export type AssetMigrationManifest = {
  readonly schemaVersion: 1;
  readonly sourceSystem: typeof CURRENT_APPLICATION_AUTHORITY;
  readonly destinationSystem: typeof NATIVE_BLOCKCHAIN_AUTHORITY;
  readonly sourceSnapshotId: string;
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly accountMappings: readonly {
    readonly sourceAccountId: string;
    readonly destinationActorId: string;
  }[];
  readonly sourceSupplyScaled: string;
  readonly destinationSupplyScaled: string;
  readonly merkleCommitment: string;
  readonly migrationHeight: number;
  readonly signatures: readonly {
    readonly suiteId: string;
    readonly publicKeyHex: string;
    readonly signatureHex: string;
  }[];
  readonly auditEvidenceId: string;
  readonly productionMigrationPerformed: false;
  readonly tickerStatus: typeof NATIVE_ASSET_TICKER_STATUS;
};

export function developmentMigrationFixture(): AssetMigrationManifest {
  return Object.freeze({
    schemaVersion: 1,
    sourceSystem: CURRENT_APPLICATION_AUTHORITY,
    destinationSystem: NATIVE_BLOCKCHAIN_AUTHORITY,
    sourceSnapshotId: 'fixture.application.sunrey_coin.snapshot.v1',
    assetId: 'SUNREY_COIN',
    accountMappings: Object.freeze([
      Object.freeze({
        sourceAccountId: 'SUNREY.CUSTODY.alice',
        destinationActorId: 'actor.alice',
      }),
    ]),
    sourceSupplyScaled: '0',
    destinationSupplyScaled: '0',
    merkleCommitment: '00'.repeat(32),
    migrationHeight: 0,
    signatures: Object.freeze([
      Object.freeze({
        suiteId: 'SUNREY_DEV_ED25519_SHA256',
        publicKeyHex: '00'.repeat(32),
        signatureHex: '00'.repeat(64),
      }),
    ]),
    auditEvidenceId: 'ev.migration.fixture.not_executed',
    productionMigrationPerformed: false,
    tickerStatus: NATIVE_ASSET_TICKER_STATUS,
  });
}

export function assertMigrationNotExecuted(manifest: AssetMigrationManifest): void {
  if (manifest.productionMigrationPerformed) {
    throw new Error('production migration must not be performed in this chunk');
  }
  if (manifest.tickerStatus !== 'NOT_ASSIGNED') {
    throw new Error('public ticker remains NOT_ASSIGNED');
  }
  if (manifest.sourceSystem !== CURRENT_APPLICATION_AUTHORITY) {
    throw new Error('source must be CURRENT_APPLICATION_AUTHORITY');
  }
  if (manifest.destinationSystem !== NATIVE_BLOCKCHAIN_AUTHORITY) {
    throw new Error('destination must be NATIVE_BLOCKCHAIN_AUTHORITY');
  }
}
