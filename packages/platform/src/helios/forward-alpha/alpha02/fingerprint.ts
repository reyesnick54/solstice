import { createHash } from 'node:crypto';

import type {
  FrozenAdaptationPolicy,
  FrozenBenchmarkPolicy,
  FrozenCostPolicy,
  FrozenHypothesis,
  FrozenSizingPolicy,
  FrozenStrategyManifest,
} from './types.ts';

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Readonly<Record<string, unknown>>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export type CampaignFingerprintMaterial = {
  readonly manifest: FrozenStrategyManifest;
  readonly hypothesis: FrozenHypothesis;
  readonly benchmarkPolicy: FrozenBenchmarkPolicy;
  readonly costPolicy: FrozenCostPolicy;
  readonly sizingPolicy: FrozenSizingPolicy;
  readonly adaptationPolicy: FrozenAdaptationPolicy;
};

export function computeCampaignFingerprint(material: CampaignFingerprintMaterial): string {
  return createHash('sha256').update(stableStringify(material)).digest('hex');
}

export function digestRuleContent(content: unknown): string {
  return createHash('sha256').update(stableStringify(content)).digest('hex').slice(0, 64);
}
