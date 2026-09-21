/**
 * HELIOS M15 cross-asset graph identifier helpers.
 */

import { createHash } from 'node:crypto';

import type { CrossAssetEdgeType, CrossAssetGraphNodeClass } from './taxonomy.ts';

export function nodeIdForInstrument(instrumentId: string): string {
  return `cag:node:instrument:${instrumentId}`;
}

export function nodeIdForAssetClass(assetClass: string): string {
  return `cag:node:asset_class:${assetClass}`;
}

export function nodeIdForCurrency(currency: string): string {
  return `cag:node:currency:${currency.toUpperCase()}`;
}

export function nodeIdForRegime(regimeId: string): string {
  return `cag:node:market_regime:${regimeId}`;
}

export function nodeIdForMacroVariable(variableId: string): string {
  return `cag:node:macro_variable:${variableId}`;
}

export function nodeIdForEvent(eventId: string): string {
  return `cag:node:event:${eventId}`;
}

export function nodeIdForStrategyCandidate(candidateId: string): string {
  return `cag:node:strategy_candidate:${candidateId}`;
}

export function nodeIdForProvider(providerId: string): string {
  return `cag:node:provider_data_source:${providerId}`;
}

export function edgeIdForPair(
  relationshipType: CrossAssetEdgeType,
  fromNodeId: string,
  toNodeId: string,
  relationshipClass: string,
  customerId: string | null,
): string {
  const scope = customerId ?? 'global';
  const raw = `${relationshipType}|${fromNodeId}|${toNodeId}|${relationshipClass}|${scope}`;
  const digest = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  return `cag:edge:${digest}`;
}

export function snapshotHash(nodes: readonly { nodeId: string }[], edges: readonly { edgeId: string; version: number }[]): string {
  const payload = JSON.stringify({
    nodes: nodes.map((row) => row.nodeId).sort(),
    edges: edges.map((row) => `${row.edgeId}@${row.version}`).sort(),
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function nodeClassFromId(nodeId: string): CrossAssetGraphNodeClass | null {
  const prefix = 'cag:node:';
  if (!nodeId.startsWith(prefix)) {
    return null;
  }
  const rest = nodeId.slice(prefix.length);
  const classPart = rest.split(':')[0];
  if (
    classPart === 'instrument' ||
    classPart === 'asset_class' ||
    classPart === 'currency' ||
    classPart === 'market_regime' ||
    classPart === 'macro_variable' ||
    classPart === 'event' ||
    classPart === 'strategy_candidate' ||
    classPart === 'provider_data_source'
  ) {
    return classPart;
  }
  return null;
}
