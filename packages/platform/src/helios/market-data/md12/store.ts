/**
 * Append-only anomaly ledger — anomalies are never deleted automatically.
 */

import { createHash } from 'node:crypto';

import type { MarketDataAnomaly } from './types.ts';

export type Md12AnomalyStore = {
  readonly list: () => readonly MarketDataAnomaly[];
  readonly append: (anomaly: MarketDataAnomaly) => void;
  readonly get: (anomalyId: string) => MarketDataAnomaly | null;
  readonly count: () => number;
};

export function createMd12AnomalyStore(seed: readonly MarketDataAnomaly[] = []): Md12AnomalyStore {
  const anomalies: MarketDataAnomaly[] = [...seed];
  return Object.freeze({
    list: () => Object.freeze([...anomalies]),
    append: (anomaly) => {
      if (anomalies.some((row) => row.anomalyId === anomaly.anomalyId)) {
        throw new Error(`MD12_ANOMALY_EXISTS:${anomaly.anomalyId}`);
      }
      anomalies.push(anomaly);
    },
    get: (anomalyId) => anomalies.find((row) => row.anomalyId === anomalyId) ?? null,
    count: () => anomalies.length,
  });
}

export function md12AnomalyId(material: string): string {
  return `md12_anom_${createHash('sha256').update(material).digest('hex').slice(0, 24)}`;
}
