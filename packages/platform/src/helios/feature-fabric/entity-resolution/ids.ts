import { createHash } from 'node:crypto';

import { brandAs, type Brand } from '../../../../../domain/src/brand.ts';

export type TemporalEntityNodeId = Brand<string, 'TemporalEntityNodeId'>;
export type TemporalEntityEdgeId = Brand<string, 'TemporalEntityEdgeId'>;
export type ProviderMappingId = Brand<string, 'ProviderMappingId'>;

const NODE_PREFIX = 'helios_ter_n_';
const EDGE_PREFIX = 'helios_ter_e_';
const MAP_PREFIX = 'helios_ter_m_';

function digest(material: string): string {
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}

export function temporalEntityNodeIdFor(material: string): TemporalEntityNodeId {
  return brandAs<string, TemporalEntityNodeId>(`${NODE_PREFIX}${digest(material)}`);
}

export function temporalEntityEdgeIdFor(material: string): TemporalEntityEdgeId {
  return brandAs<string, TemporalEntityEdgeId>(`${EDGE_PREFIX}${digest(material)}`);
}

export function providerMappingIdFor(material: string): ProviderMappingId {
  return brandAs<string, ProviderMappingId>(`${MAP_PREFIX}${digest(material)}`);
}

export function canonicalHeliosInstrumentId(input: {
  readonly kind: 'SECURITY' | 'CRYPTO_VENUE_INSTRUMENT' | 'ECONOMIC_SERIES';
  readonly jurisdiction: string;
  readonly symbol: string;
  readonly venueOrProvider: string;
  readonly variant?: string | null;
}): string {
  const variant = input.variant ? `:${input.variant}` : '';
  return `HELIOS_INSTR:${input.kind}:${input.jurisdiction}:${input.symbol}:${input.venueOrProvider}${variant}`;
}
