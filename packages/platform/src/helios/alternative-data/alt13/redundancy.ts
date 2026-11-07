/**
 * HELIOS ALT13 — latent-demand redundancy and feature-count inflation guard.
 */

import { pearsonCorrelation } from './metrics.ts';
import {
  ALT13_DEMAND_PROXY_CHANNELS,
  ALT13_REDUNDANCY_CORRELATION_THRESHOLD,
  type Alt13DemandProxyChannel,
} from './taxonomy.ts';
import type { SignalRedundancyCluster, SignalRedundancyState } from './types.ts';

const CHANNEL_TO_FEATURE: Record<Alt13DemandProxyChannel, string> = {
  JOB_GROWTH: 'alt_job_growth',
  SEARCH_GROWTH: 'alt_search_growth',
  WEB_TRAFFIC: 'alt_web_traffic',
  PRODUCT_DEMAND: 'alt_product_demand',
};

export type DemandProxySeries = Readonly<Record<string, readonly number[]>>;

export function detectDemandRedundancy(seriesByFeatureId: DemandProxySeries): SignalRedundancyState {
  const featureIds = ALT13_DEMAND_PROXY_CHANNELS.map((c) => CHANNEL_TO_FEATURE[c]);
  const clusters: SignalRedundancyCluster[] = [];
  const visited = new Set<string>();

  for (let i = 0; i < featureIds.length; i += 1) {
    const anchor = featureIds[i]!;
    if (visited.has(anchor)) continue;
    const members: string[] = [anchor];
    let maxAbs = 0;

    for (let j = i + 1; j < featureIds.length; j += 1) {
      const other = featureIds[j]!;
      const a = seriesByFeatureId[anchor];
      const b = seriesByFeatureId[other];
      if (!a || !b) continue;
      const rho = pearsonCorrelation(a, b);
      if (rho === null) continue;
      const abs = Math.abs(rho);
      if (abs >= ALT13_REDUNDANCY_CORRELATION_THRESHOLD) {
        members.push(other);
        maxAbs = Math.max(maxAbs, abs);
        visited.add(other);
      }
    }

    if (members.length > 1) {
      visited.add(anchor);
      clusters.push(
        Object.freeze({
          clusterId: `demand-shock:${anchor}`,
          memberFeatureIds: Object.freeze([...members]),
          latentShockLabel: 'LATENT_DEMAND_SHOCK',
          maxAbsCorrelation: maxAbs,
        }),
      );
    }
  }

  return Object.freeze({
    clusters: Object.freeze(clusters),
    inflationRisk: clusters.length > 0,
    grantsExecutionAuthority: false,
  });
}
