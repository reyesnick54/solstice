import { type Brand, brandAs } from '../../domain/src/brand.ts';

/**
 * Graph identifiers are not ledger, account, journal, or payment IDs.
 * Runtime prefixes keep the two namespaces from being mixed by accident.
 */
export type EconomicGraphId = Brand<string, 'EconomicGraphId'>;
export type EconomicNodeId = Brand<string, 'EconomicNodeId'>;
export type EconomicEdgeId = Brand<string, 'EconomicEdgeId'>;
export type EconomicFactId = Brand<string, 'EconomicFactId'>;
export type EconomicSourceId = Brand<string, 'EconomicSourceId'>;
export type EconomicSnapshotId = Brand<string, 'EconomicSnapshotId'>;
export type EconomicOpportunityId = Brand<string, 'EconomicOpportunityId'>;
export type EconomicActivityId = Brand<string, 'EconomicActivityId'>;

const PREFIX: Readonly<Record<string, string>> = {
  EconomicGraphId: 'peg_g_',
  EconomicNodeId: 'peg_n_',
  EconomicEdgeId: 'peg_e_',
  EconomicFactId: 'peg_f_',
  EconomicSourceId: 'peg_src_',
  EconomicSnapshotId: 'peg_s_',
  EconomicOpportunityId: 'peg_o_',
  EconomicActivityId: 'peg_a_',
};

function brandPrefixed<Name extends keyof typeof PREFIX>(value: string, name: Name): Brand<string, Name> {
  if (value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  const prefix = PREFIX[name];
  if (prefix === undefined) {
    throw new TypeError(`${name} is not a graph identifier`);
  }
  if (!value.startsWith(prefix)) {
    throw new TypeError(`${name} must start with ${prefix} and must not be a ledger identifier`);
  }
  return brandAs<string, Name>(value);
}

export function asEconomicGraphId(value: string): EconomicGraphId {
  return brandPrefixed(value, 'EconomicGraphId');
}

export function asEconomicNodeId(value: string): EconomicNodeId {
  return brandPrefixed(value, 'EconomicNodeId');
}

export function asEconomicEdgeId(value: string): EconomicEdgeId {
  return brandPrefixed(value, 'EconomicEdgeId');
}

export function asEconomicFactId(value: string): EconomicFactId {
  return brandPrefixed(value, 'EconomicFactId');
}

export function asEconomicSourceId(value: string): EconomicSourceId {
  return brandPrefixed(value, 'EconomicSourceId');
}

export function asEconomicSnapshotId(value: string): EconomicSnapshotId {
  return brandPrefixed(value, 'EconomicSnapshotId');
}

export function asEconomicOpportunityId(value: string): EconomicOpportunityId {
  return brandPrefixed(value, 'EconomicOpportunityId');
}

export function asEconomicActivityId(value: string): EconomicActivityId {
  return brandPrefixed(value, 'EconomicActivityId');
}

export function graphIdForSubject(subjectId: string): EconomicGraphId {
  return asEconomicGraphId(`peg_g_${subjectId}`);
}

export function deterministicNodeId(kind: string, key: string): EconomicNodeId {
  return asEconomicNodeId(`peg_n_${kind.toLowerCase()}_${key}`);
}

export function deterministicEdgeId(kind: string, from: string, to: string): EconomicEdgeId {
  return asEconomicEdgeId(`peg_e_${kind.toLowerCase()}_${from}_${to}`);
}

export function deterministicFactId(scope: string, key: string, version: number): EconomicFactId {
  return asEconomicFactId(`peg_f_${scope}_${key}_v${String(version)}`);
}

export function deterministicSourceId(sourceType: string, sourceRef: string): EconomicSourceId {
  return asEconomicSourceId(`peg_src_${sourceType.toLowerCase()}_${sourceRef}`);
}

export function deterministicActivityId(sourceRef: string): EconomicActivityId {
  return asEconomicActivityId(`peg_a_${sourceRef}`);
}

export function deterministicSnapshotId(graphId: string, generatedAt: string): EconomicSnapshotId {
  return asEconomicSnapshotId(`peg_s_${graphId}_${generatedAt.replace(/[:.]/g, '')}`);
}

export function deterministicOpportunityId(kind: string, key: string): EconomicOpportunityId {
  return asEconomicOpportunityId(`peg_o_${kind.toLowerCase()}_${key}`);
}
