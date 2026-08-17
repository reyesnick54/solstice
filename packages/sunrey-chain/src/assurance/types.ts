/**
 * Chunk 56 — language-neutral assurance types.
 *
 * Seeds are explicit integers. Profiles bound CI time. This is not a
 * second protocol, ledger, or formal-verification product.
 */

export const ASSURANCE_SCHEMA_VERSION = 1 as const;
export const ASSURANCE_NETWORK_ID = 'net_sunrey_simulation' as const;
export const ASSURANCE_CHAIN_ID = 'chn_sunrey_simulation' as const;

export const FUZZ_PROFILES = ['FUZZ_SMOKE', 'FUZZ_EXTENDED'] as const;
export type FuzzProfileName = (typeof FUZZ_PROFILES)[number];

export type FuzzProfile = {
  readonly name: FuzzProfileName;
  readonly propertyCases: number;
  readonly campaignOps: number;
  readonly consensusEvents: number;
  readonly replicaCount: number;
  readonly maxFieldBytes: number;
  readonly maxRepeated: number;
};

export type ReplayFixture = {
  readonly schemaVersion: typeof ASSURANCE_SCHEMA_VERSION;
  readonly id: string;
  readonly target: string;
  readonly seed: number;
  readonly profile: FuzzProfileName;
  readonly networkId: string;
  readonly chainId: string;
  readonly genesisRef: string;
  readonly actions: readonly ReplayAction[];
  readonly expected: ReplayExpectation;
};

export type ReplayAction = {
  readonly kind: string;
  readonly payload: Record<string, unknown>;
};

export type ReplayExpectation = {
  readonly ok: boolean;
  readonly rejection?: string;
  readonly stateRoots?: readonly string[];
  readonly notes?: string;
};

export type FuzzArtifact = {
  readonly seed: number;
  readonly target: string;
  readonly minimizedInput: string;
  readonly error: string;
  readonly stateRoot?: string;
  readonly sourceCommit: string;
  readonly toolVersion: string;
};

export type CoverageStatus = 'IMPLEMENTED' | 'PARTIAL' | 'NOT_APPLICABLE';

export type CoverageEntry = {
  readonly subsystem: string;
  readonly target: string;
  readonly status: CoverageStatus;
  readonly notes: string;
};

export type CampaignReport = {
  readonly name: string;
  readonly seed: number;
  readonly operations: number;
  readonly ok: true;
  readonly stateRoots: readonly string[];
  readonly notes: string;
};
