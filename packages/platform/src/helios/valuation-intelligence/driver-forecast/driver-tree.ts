/**
 * Evaluate hierarchical business driver trees (volume × price, segment / geo rollups).
 */

import type { CorrelatedFactorDraw } from './correlations.ts';
import type {
  DriverTreeEvaluation,
  DriverTreeNode,
} from './types.ts';

function applyGrowthShock(base: number, factor: CorrelatedFactorDraw, key: keyof CorrelatedFactorDraw): number {
  const shock = factor[key] ?? 0;
  return base * (1 + shock);
}

export function evaluateDriverTree(
  node: DriverTreeNode,
  factorDraw: CorrelatedFactorDraw,
  growthMultiplier: number,
): DriverTreeEvaluation {
  switch (node.kind) {
    case 'LEAF': {
      const shocked =
        node.growthShockFactor === null
          ? node.baseValue
          : applyGrowthShock(node.baseValue, factorDraw, node.growthShockFactor);
      const value = shocked * growthMultiplier;
      return Object.freeze({
        driverId: node.driverId,
        label: node.label,
        nodeKind: 'LEAF',
        value,
        unit: node.unit,
        children: Object.freeze([]),
      });
    }
    case 'PRODUCT': {
      const volume = evaluateDriverTree(node.volume, factorDraw, growthMultiplier);
      const price = evaluateDriverTree(node.price, factorDraw, 1);
      return Object.freeze({
        driverId: node.driverId,
        label: node.label,
        nodeKind: 'PRODUCT',
        value: volume.value * price.value,
        unit: `${volume.unit}×${price.unit}`,
        children: Object.freeze([volume, price]),
      });
    }
    case 'SUM': {
      const children = node.children.map((child) => evaluateDriverTree(child, factorDraw, growthMultiplier));
      const value = children.reduce((sum, child) => sum + child.value, 0);
      return Object.freeze({
        driverId: node.driverId,
        label: node.label,
        nodeKind: 'SUM',
        value,
        unit: children[0]?.unit ?? 'unit',
        children: Object.freeze(children),
      });
    }
    case 'MARKET_SHARE': {
      const share =
        node.shareGrowthFactor === null
          ? node.shareBase
          : node.shareBase * (1 + (factorDraw[node.shareGrowthFactor] ?? 0));
      const tam = node.addressableMarket * growthMultiplier;
      const value = tam * Math.min(Math.max(share, 0), 1);
      return Object.freeze({
        driverId: node.driverId,
        label: node.label,
        nodeKind: 'MARKET_SHARE',
        value,
        unit: node.marketUnit,
        children: Object.freeze([]),
      });
    }
    case 'CAPACITY_BIND': {
      const demand = evaluateDriverTree(node.demand, factorDraw, growthMultiplier);
      const cap = node.capacityUnits * node.utilizationCap;
      const value = Math.min(demand.value, cap);
      return Object.freeze({
        driverId: node.driverId,
        label: node.label,
        nodeKind: 'CAPACITY_BIND',
        value,
        unit: demand.unit,
        children: Object.freeze([demand]),
      });
    }
    default: {
      const exhaustive: never = node;
      throw new Error(`unsupported driver node: ${String(exhaustive)}`);
    }
  }
}
