/**
 * Vast.ai GPU offer search — read-only, no instance rental.
 */

import { BaseLiveAccessAdapter, type BaseLiveAdapterDeps } from './base.ts';
import type { AccessLiveOffer, LiveProviderAdapterResult, LiveProviderSearchRequest } from '../types.ts';

type VastBundle = {
  readonly id?: number;
  readonly gpu_name?: string;
  readonly num_gpus?: number;
  readonly gpu_ram?: number;
  readonly cpu_cores?: number;
  readonly cpu_ram?: number;
  readonly disk_space?: number;
  readonly geolocation?: string;
  readonly reliability2?: number;
  readonly inet_down?: number;
  readonly inet_up?: number;
  readonly cuda_max_good?: number;
  readonly dph_total?: number;
  readonly dlperf?: number;
  readonly rentable?: boolean;
  readonly verified?: boolean;
  readonly external?: boolean;
};

type VastSearchResponse = {
  readonly offers?: readonly VastBundle[];
};

export class VastAiLiveAdapter extends BaseLiveAccessAdapter {
  constructor(deps: BaseLiveAdapterDeps = {}) {
    super(
      {
        providerId: 'vast-ai',
        displayName: 'Vast.ai',
        categories: Object.freeze(['COMPUTE']),
        consumerCategories: Object.freeze(['COMPUTE_AI']),
        authenticationType: 'BEARER',
        termsClassification: 'FREE_API_KEY_REQUIRED',
        credentialEnvKey: 'VAST_API_KEY',
        cacheTtlSeconds: 45,
        requiredCredential: (config) => config.vastApiKey !== null,
      },
      deps,
    );
  }

  async search(request: LiveProviderSearchRequest): Promise<LiveProviderAdapterResult<readonly AccessLiveOffer[]>> {
    const blocked = this.requireCredentials();
    if (blocked) return blocked;

    const cacheKey = `vast-ai:${request.query ?? ''}:${request.limit ?? 50}`;
    return this.withCache(cacheKey, 45, async () => {
      const response = await this.http.requestJson<VastSearchResponse>({
        providerId: this.providerId,
        method: 'POST',
        url: 'https://console.vast.ai/api/v0/bundles/',
        headers: {
          Authorization: `Bearer ${this.envConfig.vastApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rentable: true,
          rented: false,
          verified: true,
          limit: request.limit ?? 50,
          ...(request.query ? { gpu_name: { eq: request.query } } : {}),
        }),
      });

      if (!response.ok) {
        return this.fail(response.code, response.message);
      }

      const retrievedAt = this.nowUtc();
      const offers = (response.data.offers ?? []).map((bundle) => {
        const offerId = `vast_${bundle.id ?? Math.random()}`;
        const pricePerHour = bundle.dph_total ?? null;
        const provenance = this.buildProvenance({
          providerRecordId: offerId,
          providerUrl: 'https://vast.ai',
          retrievedAt,
          sourceTimestamp: null,
          liveRead: true,
          simulation: false,
          stale: false,
        });
        const priceMinorUnits =
          pricePerHour !== null ? BigInt(Math.round(pricePerHour * 100)) : null;
        return this.buildOffer({
          offerId,
          category: 'COMPUTE',
          title: bundle.gpu_name ?? 'GPU Offer',
          description: `${bundle.num_gpus ?? 1} GPU(s), ${bundle.cpu_cores ?? '?'} CPU cores`,
          location: bundle.geolocation ?? null,
          city: null,
          country: bundle.geolocation ?? null,
          latitude: null,
          longitude: null,
          priceMinorUnits,
          currency: 'USD',
          priceLabel: pricePerHour !== null ? `$${pricePerHour.toFixed(2)}/hr` : null,
          imageUrl: null,
          externalUrl: bundle.id ? `https://vast.ai/console/create/${bundle.id}` : null,
          availability: bundle.rentable ? 'AVAILABLE' : 'UNAVAILABLE',
          metadata: Object.freeze({
            gpuName: bundle.gpu_name ?? null,
            numGpus: bundle.num_gpus ?? null,
            gpuRam: bundle.gpu_ram ?? null,
            cpuCores: bundle.cpu_cores ?? null,
            cpuRam: bundle.cpu_ram ?? null,
            storage: bundle.disk_space ?? null,
            reliability: bundle.reliability2 ?? null,
            inetDown: bundle.inet_down ?? null,
            inetUp: bundle.inet_up ?? null,
            cudaCapability: bundle.cuda_max_good ?? null,
            dlPerf: bundle.dlperf ?? null,
            verified: bundle.verified ?? null,
            rentable: bundle.rentable ?? null,
          }),
          provenance,
        });
      });

      const provenance = this.buildProvenance({
        providerRecordId: 'vast-ai-search',
        providerUrl: 'https://console.vast.ai/api/v0/bundles/',
        retrievedAt,
        sourceTimestamp: null,
        liveRead: true,
        simulation: false,
        stale: false,
      });
      return this.succeed(Object.freeze(offers), provenance);
    });
  }
}

export function createVastAiLiveAdapter(deps?: BaseLiveAdapterDeps): VastAiLiveAdapter {
  return new VastAiLiveAdapter(deps);
}
