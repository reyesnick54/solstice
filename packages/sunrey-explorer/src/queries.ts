import type { ExplorerIndexer } from './indexer.ts';
import { explorerExposurePolicy } from './privacy.ts';
import { searchProjection } from './search.ts';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, NETWORK_ENVIRONMENT_LABEL } from './taxonomy.ts';
import type {
  CanonicalProjection,
  ExplorerCursor,
  ExplorerHome,
  ExplorerLag,
  IndexedAccount,
  IndexedAsset,
  IndexedBlock,
  IndexedTransaction,
} from './types.ts';

export type Page<T> = ExplorerLag & {
  readonly items: readonly T[];
  readonly nextCursor: ExplorerCursor | null;
};

export class ExplorerQueryService {
  readonly indexer: ExplorerIndexer;

  constructor(indexer: ExplorerIndexer) {
    this.indexer = indexer;
  }

  lag(): ExplorerLag {
    const status = this.indexer.status();
    return {
      indexed_finalized_height: status.checkpoint?.lastIndexedFinalizedHeight ?? 0,
      chain_finalized_height: status.chainHeight,
      index_lag: status.lag,
    };
  }

  home(): ExplorerHome & ExplorerLag {
    const projection = this.indexer.store.projection();
    const latest = projection.blocks[projection.blocks.length - 1] ?? null;
    const sunrey = projection.assets.find((row) => row.assetId === 'SUNREY_COIN');
    const moonrey = projection.assets.find((row) => row.assetId === 'MOONREY_COIN');
    return this.public({
      ...this.lag(),
      networkClass: 'DEVELOPMENT',
      networkLabel: NETWORK_ENVIRONMENT_LABEL,
      latestFinalizedHeight: latest?.height ?? 0,
      latestBlock: latest,
      transactionActivity: projection.transactions.length,
      validatorCount: projection.validators.length,
      activeProtocolVersion: latest?.protocolVersion ?? 'sunrey-protocol-0',
      sunreyDevelopmentSupply: sunrey?.circulating ?? '0',
      moonreyDevelopmentSupply: moonrey?.circulating ?? '0',
      productiveContributionCount: projection.contributions.length,
      latestOracleFacts: projection.oracleFacts.slice(-5),
      interopClientCount: projection.interopClients.length,
      supplyIsNotMarketCap: true,
    });
  }

  blocks(cursor?: string, limit?: number): Page<IndexedBlock> {
    return this.page(this.indexer.store.projection().blocks, cursor, limit, (row) => String(row.height));
  }

  block(idOrHeight: string): (IndexedBlock & ExplorerLag) | null {
    const store = this.indexer.store;
    const block = /^\d+$/.test(idOrHeight)
      ? store.blockByHeight(Number.parseInt(idOrHeight, 10))
      : store.blockById(idOrHeight);
    return block ? this.public({ ...block, ...this.lag() }) : null;
  }

  transactions(cursor?: string, limit?: number): Page<IndexedTransaction> {
    return this.page(this.indexer.store.projection().transactions, cursor, limit, (row) => row.transactionId);
  }

  transaction(id: string): (IndexedTransaction & ExplorerLag) | null {
    const tx = this.indexer.store.transactionById(id);
    return tx ? this.public({ ...tx, ...this.lag() }) : null;
  }

  account(address: string): (IndexedAccount & ExplorerLag & { readonly history: readonly IndexedTransaction[] }) | null {
    const projection = this.indexer.store.projection();
    const account = projection.accounts.find((row) => row.address === address);
    if (!account) {
      return null;
    }
    const history = projection.transactions.filter(
      (tx) => tx.actor === address || tx.addressRefs.includes(address),
    );
    return this.public({ ...account, history, ...this.lag() });
  }

  accounts(cursor?: string, limit?: number): Page<IndexedAccount> {
    return this.page(this.indexer.store.projection().accounts, cursor, limit, (row) => row.address);
  }

  assets(): Page<IndexedAsset> {
    return this.page(this.indexer.store.projection().assets, undefined, 10, (row) => row.assetId);
  }

  asset(id: string): (IndexedAsset & ExplorerLag) | null {
    const row = this.indexer.store.projection().assets.find((item) => item.assetId === id || item.internalAssetId === id);
    return row ? this.public({ ...row, ...this.lag() }) : null;
  }

  validatorEconomics(validatorId?: string) {
    const projection = this.indexer.store.projection();
    const validators = projection.validators.filter((row) => !validatorId || row.validatorId === validatorId);
    const evidence = projection.evidence.filter((row) => !validatorId || row.validatorId === validatorId);
    return this.public({
      ...this.lag(),
      policyVersion: 1,
      bondAsset: validators[0]?.bondAsset ?? 'DEVELOPMENT_SUNREY_COIN',
      validators: validators.map((row) => ({
        validatorId: row.validatorId,
        bondState: row.bondState ?? (row.tombstone ? 'TOMBSTONED' : row.jailStatus ? 'JAILED' : 'BONDED'),
        bondAsset: row.bondAsset ?? 'DEVELOPMENT_SUNREY_COIN',
        policyVersion: row.policyVersion ?? 1,
        publicRewardSummary: row.publicRewardSummary ?? { paid: '0', pending: '0' },
        publicPenalties: evidence.filter((item) => item.validatorId === row.validatorId),
        jailStatus: row.jailStatus,
        tombstone: row.tombstone,
        unbondStatus: row.unbondStatus ?? { pending: '0', releaseEpoch: null },
  monetary() {
    const assets = this.indexer.store.projection().assets;
    const moonrey = this.indexer.store.projection().moonrey;
    const categorySummary: Record<string, string> = {};
    for (const row of moonrey) {
      categorySummary[row.productiveCategory] = String(
        BigInt(categorySummary[row.productiveCategory] ?? '0') + BigInt(row.issuedQuantity),
      );
    }
    return this.public({
      ...this.lag(),
      networkEnvironmentLabel: 'DEVELOPMENT' as const,
      notMarketCapitalization: true,
      assets: assets.map((row) => ({
        assetId: row.assetId,
        policyVersion: row.policyVersion,
        genesisAllocationTotal: row.genesisAllocationTotal,
        authorizedIssuanceTotal: row.authorizedIssuanceTotal,
        burned: row.burned,
        locked: row.locked,
        circulating: row.circulating,
        supplyReconciliation: row.supplyReconciliation,
        moonreyIssuanceCategorySummary: row.assetId === 'MOONREY_COIN' ? categorySummary : undefined,
      })),
    });
  }

  collection(
    key: Exclude<keyof CanonicalProjection, 'schemaVersion' | 'checkpoint'>,
    cursor?: string,
    limit?: number,
  ): Page<Record<string, unknown>> {
    const rows = this.indexer.store.projection()[key];
    return this.page(rows as readonly Record<string, unknown>[], cursor, limit, firstId);
  }

  search(query: string) {
    const result = searchProjection(this.indexer.store.projection(), query);
    if ('code' in result) {
      return result;
    }
    return this.public({ items: result, ...this.lag() });
  }

  private page<T>(
    rows: readonly T[],
    cursor: string | undefined,
    limit: number | undefined,
    idOf: (row: T) => string,
  ): Page<T> {
    const started = this.indexer.metrics.now();
    const size = boundLimit(limit);
    const start = cursor ? rows.findIndex((row) => idOf(row) === cursor) + 1 : 0;
    const slice = start < 0 ? rows.slice(0, size) : rows.slice(start, start + size);
    const last = slice[slice.length - 1];
    const next = last && start + slice.length < rows.length ? idOf(last) : null;
    this.indexer.metrics.observeQuery('page', this.indexer.metrics.now() - started);
    return this.public({
      items: slice,
      nextCursor: next,
      ...this.lag(),
    });
  }

  private public<T>(value: T): T {
    return explorerExposurePolicy.project(value);
  }
}

function boundLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isInteger(limit) || limit <= 0) {
    return DEFAULT_PAGE_LIMIT;
  }
  return Math.min(limit, MAX_PAGE_LIMIT);
}

function firstId(row: Record<string, unknown>): string {
  for (const key of [
    'height',
    'transactionId',
    'address',
    'assetId',
    'issuanceId',
    'objectId',
    'contributionId',
    'factId',
    'providerId',
    'feedId',
    'validatorId',
    'evidenceId',
    'proposalId',
    'clientId',
    'packetId',
    'machineId',
    'settlementId',
  ]) {
    const value = row[key];
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
  }
  return '';
}
