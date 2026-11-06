import { createHash } from 'node:crypto';

import type { StrategyGenome } from '../os05/types.ts';

import { clamp01, signedTo01 } from './math.ts';
import {
  HELIOS_EVOL07_BEHAVIOR_FINGERPRINT_SCHEMA_VERSION,
  HELIOS_EVOL07_NEUTRAL_DIAGNOSTIC_DATASET_ID,
} from './taxonomy.ts';
import type { StrategyBehaviorFingerprint } from './types.ts';

/**
 * Deterministic behavioral fingerprint from genome structure + lineage hash.
 * Callers supply a real diagnostic backtest hook in production; this default keeps CI hermetic.
 */
export function computeStrategyBehaviorFingerprint(
  genome: StrategyGenome,
  options?: {
    readonly datasetId?: string;
  },
): StrategyBehaviorFingerprint {
  const digest = createHash('sha256').update(genome.lineage.genomeHash, 'utf8').digest();
  const u8 = (i: number) => digest[i % digest.length] / 255;

  return Object.freeze({
    datasetId: options?.datasetId ?? HELIOS_EVOL07_NEUTRAL_DIAGNOSTIC_DATASET_ID,
    schemaVersion: HELIOS_EVOL07_BEHAVIOR_FINGERPRINT_SCHEMA_VERSION,
    tradeFrequency: clamp01(0.12 + u8(0) * 0.55 + nodeKindMix(genome, 'SIGNAL') * 0.25),
    holdingPeriod: clamp01(0.2 + u8(1) * 0.5 + nodeKindMix(genome, 'EXIT') * 0.2),
    regimeActivation: clamp01(0.15 + u8(2) * 0.4 + nodeKindMix(genome, 'REGIME_GATE') * 0.35),
    positionDirectionBias: signedTo01(u8(3) * 2 - 1),
    factorExposure: clamp01(0.1 + u8(4) * 0.55 + nodeKindMix(genome, 'FEATURE') * 0.25),
    beta: clamp01(0.25 + u8(5) * 0.45 + nodeKindMix(genome, 'SIZING') * 0.15),
    turnover: clamp01(0.1 + u8(6) * 0.6 + flowDensity(genome) * 0.2),
    drawdownDepth: clamp01(0.15 + u8(7) * 0.55 + nodeKindMix(genome, 'RISK') * 0.2),
    drawdownRecovery: clamp01(0.2 + u8(8) * 0.5),
    returnAutocorr: clamp01(0.2 + u8(9) * 0.6),
    signalTimingLag: clamp01(0.1 + u8(10) * 0.5 + nodeKindMix(genome, 'CONDITION') * 0.25),
    assetSelectionBreadth: clamp01(0.2 + u8(11) * 0.5 + uniqueFeatureRoots(genome) * 0.25),
  });
}

function nodeKindMix(genome: StrategyGenome, kind: string): number {
  const n = genome.nodes.filter((x) => x.kind === kind).length;
  const total = Math.max(1, genome.nodes.length);
  return Math.min(1, n / total);
}

function flowDensity(genome: StrategyGenome): number {
  const flows = genome.nodes.filter((x) => x.kind === 'FLOW').length;
  const total = Math.max(1, genome.nodes.length);
  return Math.min(1, flows / total);
}

function uniqueFeatureRoots(genome: StrategyGenome): number {
  const roots = new Set<string>();
  for (const n of genome.nodes) {
    if (n.kind === 'FEATURE') {
      const parts = n.catalogRef.split(/[:/]/);
      roots.add(parts[0] ?? n.catalogRef);
    }
  }
  return roots.size === 0 ? 0 : Math.min(1, roots.size / 8);
}

export function behaviorVector(f: StrategyBehaviorFingerprint): readonly number[] {
  return [
    f.tradeFrequency,
    f.holdingPeriod,
    f.regimeActivation,
    f.positionDirectionBias,
    f.factorExposure,
    f.beta,
    f.turnover,
    f.drawdownDepth,
    f.drawdownRecovery,
    f.returnAutocorr,
    f.signalTimingLag,
    f.assetSelectionBreadth,
  ];
}
