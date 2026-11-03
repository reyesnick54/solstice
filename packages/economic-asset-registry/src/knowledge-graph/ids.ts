import { createHash } from 'node:crypto';

import { type Brand, brandAs } from '../../../domain/src/brand.ts';

export type KnowledgeNodeId = Brand<string, 'KnowledgeNodeId'>;
export type KnowledgeEdgeId = Brand<string, 'KnowledgeEdgeId'>;
export type KnowledgeAliasId = Brand<string, 'KnowledgeAliasId'>;
export type CanonicalEntityId = Brand<string, 'CanonicalEntityId'>;
export type EntityResolutionId = Brand<string, 'EntityResolutionId'>;
export type MatchSuggestionId = Brand<string, 'MatchSuggestionId'>;

export const KNOWLEDGE_ID_PREFIXES = Object.freeze({
  node: 'ekg_n_',
  edge: 'ekg_e_',
  alias: 'ekg_a_',
  entity: 'ekg_ent_',
  resolution: 'ekg_res_',
  suggestion: 'ekg_sug_',
});

const HEX_BODY = /^[a-f0-9]{16,64}$/;

function digest(material: string): string {
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}

function asPrefixedHex<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix)) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  const body = value.slice(prefix.length);
  if (!HEX_BODY.test(body)) {
    throw new TypeError(`${label} body must be lowercase hex`);
  }
  return brandAs<string, T>(value);
}

export function knowledgeNodeIdFor(material: string): KnowledgeNodeId {
  return brandAs<string, 'KnowledgeNodeId'>(`${KNOWLEDGE_ID_PREFIXES.node}${digest(material)}`);
}

export function knowledgeEdgeIdFor(material: string): KnowledgeEdgeId {
  return brandAs<string, 'KnowledgeEdgeId'>(`${KNOWLEDGE_ID_PREFIXES.edge}${digest(material)}`);
}

export function knowledgeAliasIdFor(material: string): KnowledgeAliasId {
  return brandAs<string, 'KnowledgeAliasId'>(`${KNOWLEDGE_ID_PREFIXES.alias}${digest(material)}`);
}

export function canonicalEntityIdFor(material: string): CanonicalEntityId {
  return brandAs<string, 'CanonicalEntityId'>(`${KNOWLEDGE_ID_PREFIXES.entity}${digest(material)}`);
}

export function entityResolutionIdFor(material: string): EntityResolutionId {
  return brandAs<string, 'EntityResolutionId'>(`${KNOWLEDGE_ID_PREFIXES.resolution}${digest(material)}`);
}

export function matchSuggestionIdFor(material: string): MatchSuggestionId {
  return brandAs<string, 'MatchSuggestionId'>(`${KNOWLEDGE_ID_PREFIXES.suggestion}${digest(material)}`);
}

export function asKnowledgeNodeId(value: string): KnowledgeNodeId {
  return asPrefixedHex(value, KNOWLEDGE_ID_PREFIXES.node, 'KnowledgeNodeId');
}

export function asCanonicalEntityId(value: string): CanonicalEntityId {
  return asPrefixedHex(value, KNOWLEDGE_ID_PREFIXES.entity, 'CanonicalEntityId');
}
