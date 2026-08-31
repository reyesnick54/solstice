/**
 * Shared live/simulation execution for Wave 6 opportunity job adapters.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ProviderExecutionProvenance } from '../../certification/types.ts';
import { deriveExecutionProvenance } from '../../certification/types.ts';
import type { JobOpportunity, JobSearchQuery, OpportunityServiceResult } from '../types.ts';
import {
  fail,
  filterJobsByQuery,
  getAdapterScenario,
  loadOpportunityFixture,
  ok,
  simulationProvenance,
} from './base.ts';
import { OpportunityHttpClient } from '../http/client.ts';
import { LIVE_OPPORTUNITY_ENDPOINTS } from '../http/endpoints.ts';
import {
  cacheProvenance,
  readOpportunityHttpCache,
  writeOpportunityHttpCache,
} from '../http/cache.ts';
import {
  parseArbeitnowJobs,
  parseHimalayasJobs,
  parseJobicyJobs,
  parseRemotiveJobs,
  parseRemoteOkJobs,
  validateArbeitnowPayload,
  validateHimalayasPayload,
  validateJobicyPayload,
  validateRemotivePayload,
  validateRemoteOkPayload,
} from '../http/parsers.ts';
import type { OpportunityHttpClientOptions } from '../http/client.ts';

export type LiveJobAdapterConfig = {
  readonly providerId: string;
  readonly fixtureFile: string;
  readonly endpointKey: keyof typeof LIVE_OPPORTUNITY_ENDPOINTS;
  readonly validate: (raw: unknown) => boolean;
  readonly parse: (raw: unknown, providerId: string, nowUtc: UtcInstant) => readonly JobOpportunity[];
  readonly liveQuery?: (query: JobSearchQuery) => Readonly<Record<string, string | number | boolean | undefined>>;
};

export type LiveJobAdapterOptions = OpportunityHttpClientOptions & {
  readonly liveCapable?: boolean;
};

export class LiveJobOpportunityAdapter {
  readonly providerId: string;
  readonly liveCapable: boolean;
  readonly #config: LiveJobAdapterConfig;
  readonly #http: OpportunityHttpClient;
  protected scenario: import('./base.ts').AdapterScenario = 'normal';

  constructor(config: LiveJobAdapterConfig, options: LiveJobAdapterOptions = {}) {
    this.providerId = config.providerId;
    this.#config = config;
    this.liveCapable = options.liveCapable ?? true;
    this.#http = new OpportunityHttpClient(options);
  }

  setScenario(scenario: import('./base.ts').AdapterScenario): void {
    this.scenario = scenario;
  }

  protected checkAvailability(): OpportunityServiceResult<never> | null {
    const scenario = this.scenario !== 'normal' ? this.scenario : getAdapterScenario();
    if (scenario === 'timeout') {
      return fail('TIMEOUT', 'provider timeout', this.providerId, deriveExecutionProvenance({
        simulated: this.#http.mode === 'simulation',
        liveNetworkCallObserved: false,
      }));
    }
    if (scenario === 'rate_limited') {
      return fail('RATE_LIMITED', '429 rate limited', this.providerId);
    }
    if (scenario === 'unavailable') {
      return fail('UNAVAILABLE', 'provider unavailable', this.providerId);
    }
    return null;
  }

  async searchJobs(
    query: JobSearchQuery,
    nowUtc: UtcInstant,
  ): Promise<OpportunityServiceResult<readonly JobOpportunity[]>> {
    const blocked = this.checkAvailability();
    if (blocked) {
      return blocked;
    }

    if (this.#http.mode === 'simulation') {
      return this.#searchFixture(query, nowUtc);
    }

    const cacheKey = `${this.providerId}:jobs:${JSON.stringify(query)}`;
    const cached = readOpportunityHttpCache<readonly JobOpportunity[]>(cacheKey);
    if (cached) {
      return ok(Object.freeze(cached.value), [this.providerId], true, cacheProvenance(cached.retrievedAtUtc));
    }

    const endpoint = LIVE_OPPORTUNITY_ENDPOINTS[this.#config.endpointKey];
    const response = await this.#http.getJson<unknown>(endpoint, this.#config.liveQuery?.(query));
    if (!response.ok) {
      return fail(response.code, response.message, this.providerId, response.provenance);
    }
    if (!this.#config.validate(response.data)) {
      return fail('INVALID_PAYLOAD', 'unexpected provider response shape', this.providerId, response.provenance);
    }

    const jobs = this.#config.parse(response.data, this.providerId, nowUtc);
    const filtered = Object.freeze(filterJobsByQuery([...jobs], query));
    writeOpportunityHttpCache(cacheKey, filtered, 'jobSearch', nowUtc);
    return ok(filtered, [this.providerId], false, response.provenance);
  }

  #searchFixture(query: JobSearchQuery, nowUtc: UtcInstant): OpportunityServiceResult<readonly JobOpportunity[]> {
    const raw = loadOpportunityFixture(this.#config.fixtureFile);
    if (!this.#config.validate(raw)) {
      return fail('INVALID_PAYLOAD', 'fixture payload invalid', this.providerId, simulationProvenance());
    }
    const jobs = this.#config.parse(raw, this.providerId, nowUtc);
    return ok(Object.freeze(filterJobsByQuery([...jobs], query)), [this.providerId], false, simulationProvenance());
  }
}

export function mergeExecution(
  left: ProviderExecutionProvenance | undefined,
  right: ProviderExecutionProvenance | undefined,
): ProviderExecutionProvenance | undefined {
  if (!left) return right;
  if (!right) return left;
  return deriveExecutionProvenance({
    simulated: left.simulated && right.simulated,
    liveNetworkCallObserved: left.liveNetworkCallObserved || right.liveNetworkCallObserved,
    productionEndpointUsed: left.productionEndpointUsed || right.productionEndpointUsed,
    fromCache: left.fromCache || right.fromCache,
    httpStatus: right.httpStatus ?? left.httpStatus,
    latencyMs: right.latencyMs ?? left.latencyMs,
  });
}
