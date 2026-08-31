/**
 * INTERPOL Red Notices fixture-backed adapter — wanted persons only.
 * WANTED classification is distinct from SANCTIONS.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ComplianceIntelligenceProvider, ComplianceIntelligenceProviderHealth } from '../provider.ts';
import type { ComplianceScreeningQuery, ComplianceScreeningResult } from '../types.ts';
import type { AdapterScenario } from './base.ts';
import {
  buildNegativeObservation,
  loadComplianceFixture,
  parseInterpolNotices,
  screeningFailure,
  screeningSuccess,
} from './base.ts';

const PROVIDER_ID = 'interpol-red-notices';

export class InterpolRedNoticesAdapter implements ComplianceIntelligenceProvider {
  readonly providerId = PROVIDER_ID;
  readonly capabilities = Object.freeze(['wanted_persons', 'watchlists', 'public_enforcement_data'] as const);
  readonly priority = 'secondary' as const;
  readonly supportedClassifications = Object.freeze(['WANTED', 'ENFORCEMENT'] as const);
  readonly supportedSubjectTypes = Object.freeze(['PERSON', 'BENEFICIARY', 'COUNTERPARTY'] as const);
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;

  #scenario: AdapterScenario = 'normal';

  setScenario(scenario: AdapterScenario): void {
    this.#scenario = scenario;
  }

  health(nowUtc: UtcInstant): ComplianceIntelligenceProviderHealth {
    const unavailable = this.#scenario === 'unavailable' || this.#scenario === 'timeout';
    return Object.freeze({
      providerId: this.providerId,
      status: unavailable ? 'unavailable' : 'healthy',
      circuitState: unavailable ? 'OPEN' : 'CLOSED',
      rateLimited: this.#scenario === 'rate_limited',
      lastSuccessAt: unavailable ? null : nowUtc,
      message: this.#scenario === 'rate_limited' ? 'HTTP 429' : null,
    });
  }

  async screenPerson(query: ComplianceScreeningQuery): Promise<ComplianceScreeningResult> {
    return this.#screen(query);
  }

  async screenOrganization(query: ComplianceScreeningQuery): Promise<ComplianceScreeningResult> {
    return screeningSuccess(query, PROVIDER_ID, [], [
      buildNegativeObservation(PROVIDER_ID, 'authoritative_official', query, '{"not_applicable":"organization"}'),
    ]);
  }

  async searchEntity(query: ComplianceScreeningQuery): Promise<ComplianceScreeningResult> {
    return this.#screen(query);
  }

  async getRecord(providerRecordId: string, nowUtc: UtcInstant): Promise<ComplianceScreeningResult | null> {
    const query: ComplianceScreeningQuery = Object.freeze({
      subjectType: 'PERSON',
      name: providerRecordId,
      requestId: `record:${providerRecordId}`,
      screenedAt: nowUtc,
    });
    return this.#screen(query);
  }

  async #screen(query: ComplianceScreeningQuery): Promise<ComplianceScreeningResult> {
    if (this.#scenario === 'timeout') {
      return screeningFailure(query, PROVIDER_ID, 'PROVIDER_TIMEOUT');
    }
    if (this.#scenario === 'rate_limited') {
      return screeningFailure(query, PROVIDER_ID, 'RATE_LIMITED');
    }
    if (this.#scenario === 'server_error') {
      return screeningFailure(query, PROVIDER_ID, 'SERVER_ERROR');
    }
    if (this.#scenario === 'unavailable') {
      return screeningFailure(query, PROVIDER_ID, 'PROVIDER_UNAVAILABLE');
    }

    const upper = query.name.trim().toUpperCase();
    const wanted = upper.includes('WANTED') || (upper.includes('PERSON') && !this.#scenario);
    const fixture = wanted && this.#scenario !== 'disagreeing'
      ? loadComplianceFixture('interpol-wanted-match.json')
      : loadComplianceFixture('interpol-no-match.json');
    const rawText = JSON.stringify(fixture);
    const evidence = parseInterpolNotices(fixture, query, PROVIDER_ID);
    if (evidence.length === 0) {
      const negative = buildNegativeObservation(PROVIDER_ID, 'authoritative_official', query, rawText);
      return screeningSuccess(query, PROVIDER_ID, [], [negative]);
    }
    return screeningSuccess(query, PROVIDER_ID, evidence);
  }
}

export function createInterpolRedNoticesAdapter(): InterpolRedNoticesAdapter {
  return new InterpolRedNoticesAdapter();
}
