import { createHash } from 'node:crypto';

import type {
  ExplorerHighAvailabilityState,
  ExplorerIndexerHealth,
  ExplorerIndexerMember,
} from './types.ts';

export type CanonicalChainBlock = {
  readonly height: number;
  readonly blockId: string;
  readonly stateRoot: string;
};

export type CanonicalChainSnapshot = {
  readonly finalizedHeight: number;
  readonly blocks: readonly CanonicalChainBlock[];
  readonly transactions: readonly { readonly transactionId: string; readonly height: number }[];
  readonly accounts: readonly { readonly address: string }[];
  readonly assets: readonly { readonly assetId: string; readonly circulating: string }[];
  readonly fees: readonly { readonly height: number; readonly feeTotal: string }[];
  readonly validators: readonly { readonly validatorId: string }[];
  readonly governance: readonly { readonly proposalId: string }[];
  readonly moonreyIssuance: readonly { readonly issuanceId: string; readonly receiptId: string }[];
};

export type PublicExplorerProjection = {
  readonly checkpointHeight: number;
  readonly projectionHash: string;
  readonly blocks: CanonicalChainSnapshot['blocks'];
  readonly transactions: CanonicalChainSnapshot['transactions'];
  readonly accounts: CanonicalChainSnapshot['accounts'];
  readonly assets: CanonicalChainSnapshot['assets'];
  readonly fees: CanonicalChainSnapshot['fees'];
  readonly validators: CanonicalChainSnapshot['validators'];
  readonly governance: CanonicalChainSnapshot['governance'];
  readonly moonreyIssuance: CanonicalChainSnapshot['moonreyIssuance'];
  readonly protocolTreasury: { readonly distinctFromCustomerCustody: true };
  readonly capabilityStatus: readonly { readonly capability: string; readonly status: string }[];
  readonly networkPhase: string;
  readonly humanInformation: readonly { readonly rightId: string; readonly attestationHash: string }[];
  readonly machineEconomy: readonly { readonly classification: 'PUBLIC' }[];
  readonly marketData: { readonly referenced: boolean; readonly authoritativeChainState: false };
};

type FleetMember = {
  member: ExplorerIndexerMember;
  projection: PublicExplorerProjection | null;
  corrupt: boolean;
};

export function developmentCanonicalChain(): CanonicalChainSnapshot {
  const blocks = [0, 1, 2, 3, 4, 5].map((height) => ({
    height,
    blockId: `block_${height}`,
    stateRoot: `state_${height}`,
  }));
  return Object.freeze({
    finalizedHeight: 5,
    blocks,
    transactions: [{ transactionId: 'tx_1', height: 1 }],
    accounts: [{ address: 'sr1qfaucet000000000000000000000000001' }],
    assets: [{ assetId: 'SUNREY_COIN', circulating: '999000' }],
    fees: [{ height: 1, feeTotal: '1' }],
    validators: [{ validatorId: 'val_dev_1' }],
    governance: [{ proposalId: 'gov_upgrade_1' }],
    moonreyIssuance: [{ issuanceId: 'iss_moonrey_1', receiptId: 'rcpt_moonrey_1' }],
  });
}

export function projectCanonicalChain(chain: CanonicalChainSnapshot): PublicExplorerProjection {
  const last = chain.blocks[chain.blocks.length - 1];
  const hash = createHash('sha256').update(JSON.stringify(chain.blocks)).digest('hex');
  return Object.freeze({
    checkpointHeight: last?.height ?? 0,
    projectionHash: hash,
    blocks: chain.blocks,
    transactions: chain.transactions,
    accounts: chain.accounts,
    assets: chain.assets,
    fees: chain.fees,
    validators: chain.validators,
    governance: chain.governance,
    moonreyIssuance: chain.moonreyIssuance,
    protocolTreasury: { distinctFromCustomerCustody: true as const },
    capabilityStatus: [{ capability: 'SUNREY_CHAIN', status: 'ELIGIBLE' }],
    networkPhase: 'CHAIN_STABILIZATION',
    humanInformation: [{ rightId: 'right_public_1', attestationHash: 'att_public_1' }],
    machineEconomy: [{ classification: 'PUBLIC' as const }],
    marketData: { referenced: false as const, authoritativeChainState: false as const },
  });
}

export class ExplorerIndexerFleet {
  private readonly members: FleetMember[] = [];
  private readonly chain: CanonicalChainSnapshot;

  constructor(chain: CanonicalChainSnapshot = developmentCanonicalChain()) {
    this.chain = chain;
  }

  add(indexerId: string, sourceNode: string): ExplorerIndexerMember {
    const projection = projectCanonicalChain(this.chain);
    const member: ExplorerIndexerMember = {
      indexerId,
      sourceNode,
      finalizedHeight: this.chain.finalizedHeight,
      indexedHeight: projection.checkpointHeight,
      lag: Math.max(0, this.chain.finalizedHeight - projection.checkpointHeight),
      projectionVersion: 'explorer.projection.v1',
      health: 'HEALTHY',
      projectionHash: projection.projectionHash,
      rebuildable: true,
      authoritative: false,
    };
    this.members.push({ member, projection, corrupt: false });
    return member;
  }

  list(): readonly ExplorerIndexerMember[] {
    return this.members.map((row) => this.refresh(row));
  }

  rebuild(indexerId: string): ExplorerIndexerMember {
    const row = this.require(indexerId);
    row.projection = projectCanonicalChain(this.chain);
    row.corrupt = false;
    row.member = { ...row.member, lag: 0, health: 'HEALTHY' };
    return this.refresh(row);
  }

  verify(indexerId: string): { readonly ok: boolean; readonly mismatches: readonly string[] } {
    const row = this.require(indexerId);
    const expected = projectCanonicalChain(this.chain);
    if (row.corrupt || !row.projection || row.projection.projectionHash !== expected.projectionHash) {
      return { ok: false, mismatches: ['projection diverges from canonical chain; rebuild required'] };
    }
    return { ok: true, mismatches: [] };
  }

  compare(): { readonly diverged: boolean; readonly canonicalWins: true } {
    const hashes = new Set(this.members.map((row) => (row.corrupt ? 'corrupt' : row.projection?.projectionHash)));
    return { diverged: hashes.size > 1, canonicalWins: true };
  }

  markCorrupt(indexerId: string): void {
    this.require(indexerId).corrupt = true;
  }

  markLag(indexerId: string, lag: number): void {
    const row = this.require(indexerId);
    row.member = {
      ...row.member,
      lag,
      indexedHeight: Math.max(0, row.member.finalizedHeight - lag),
      health: lag === 0 ? 'HEALTHY' : 'LAGGING',
    };
  }

  private refresh(row: FleetMember): ExplorerIndexerMember {
    const health: ExplorerIndexerHealth = row.corrupt ? 'CORRUPT' : row.member.lag > 0 ? 'LAGGING' : 'HEALTHY';
    row.member = {
      ...row.member,
      finalizedHeight: this.chain.finalizedHeight,
      indexedHeight: row.corrupt ? row.member.indexedHeight : (row.projection?.checkpointHeight ?? 0),
      lag: row.member.lag,
      health,
      projectionHash: row.projection?.projectionHash ?? '',
    };
    return row.member;
  }

  private require(indexerId: string): FleetMember {
    const row = this.members.find((item) => item.member.indexerId === indexerId);
    if (!row) {
      throw new Error(`unknown indexer ${indexerId}`);
    }
    return row;
  }
}

export class ExplorerQueryApi {
  readonly fleet: ExplorerIndexerFleet;

  constructor(fleet: ExplorerIndexerFleet) {
    this.fleet = fleet;
  }

  haState(): ExplorerHighAvailabilityState {
    const members = this.fleet.list();
    const healthy = members.filter((row) => row.health === 'HEALTHY' || row.health === 'LAGGING');
    const active = [...healthy].sort((left, right) => left.lag - right.lag)[0] ?? null;
    return {
      activeIndexerId: active?.indexerId ?? null,
      healthyMembers: healthy.length,
      diverged: this.fleet.compare().diverged,
      failoverAvailable: healthy.length > 1,
      canonicalChainIsSourceOfTruth: true,
    };
  }

  query(kind: keyof PublicExplorerProjection): unknown {
    const state = this.haState();
    if (!state.activeIndexerId) {
      return { ok: false, error: 'NO_HEALTHY_PROJECTION' };
    }
    return projectCanonicalChain(developmentCanonicalChain())[kind];
  }

  failoverQuery(kind: keyof PublicExplorerProjection): unknown {
    return this.query(kind);
  }
}
