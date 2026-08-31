/**
 * OpenSanctions fixture-backed adapter — sanctions, PEP, watchlists.
 * Production activation blocked pending commercial license review.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ComplianceIntelligenceProvider, ComplianceIntelligenceProviderHealth } from '../provider.ts';
import type { ComplianceScreeningQuery, ComplianceScreeningResult } from '../types.ts';
import type { AdapterScenario } from './base.ts';
import {
  buildNegativeObservation,
  loadComplianceFixture,
  parseOpenSanctionsResults,
  screeningFailure,
  screeningSuccess,
  subjectTypeIsOrganization,
} from './base.ts';

const PROVIDER_ID = 'open-sanctions';

export class OpenSanctionsAdapter implements ComplianceIntelligenceProvider {
  readonly providerId = PROVIDER_ID;
  readonly capabilities = Object.freeze([
    'sanctions',
    'pep_screening',
    'watchlists',
    'adverse_regulatory_data',
    'entity_resolution',
  ] as const);
  readonly priority = 'primary' as const;
  readonly supportedClassifications = Object.freeze(['SANCTIONS', 'PEP', 'WATCHLIST', 'OTHER'] as const);
  readonly supportedSubjectTypes = Object.freeze([
    'PERSON',
    'ORGANIZATION',
    'LEGAL_ENTITY',
    'BUSINESS',
    'BENEFICIARY',
    'COUNTERPARTY',
  ] as const);
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
      status: unavailable ? 'unavailable' : this.#scenario === 'rate_limited' ? 'degraded' : 'healthy',
      circuitState: unavailable ? 'OPEN' : 'CLOSED',
      rateLimited: this.#scenario === 'rate_limited',
      lastSuccessAt: unavailable ? null : nowUtc,
      message:
        this.#scenario === 'rate_limited'
          ? 'HTTP 429'
          : this.#scenario === 'server_error'
            ? 'HTTP 500'
            : null,
    });
  }

  async screenPerson(query: ComplianceScreeningQuery): Promise<ComplianceScreeningResult> {
    return this.#screen(query);
  }

  async screenOrganization(query: ComplianceScreeningQuery): Promise<ComplianceScreeningResult> {
    return this.#screen(query);
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
    if (this.#scenario === 'malformed') {
      return screeningFailure(query, PROVIDER_ID, 'MALFORMED_RESPONSE');
    }

    const fixture = this.#fixtureFor(query);
    const rawText = JSON.stringify(fixture);
    const evidence = parseOpenSanctionsResults(fixture, query, PROVIDER_ID);
    if (evidence.length === 0) {
      const negative = buildNegativeObservation(PROVIDER_ID, 'reference_data', query, rawText);
      return screeningSuccess(query, PROVIDER_ID, [], [negative]);
    }
    return screeningSuccess(query, PROVIDER_ID, evidence);
  }

  #fixtureFor(query: ComplianceScreeningQuery): unknown {
    const upper = query.name.trim().toUpperCase();
    const aliasUpper = (query.aliases ?? []).map((a) => a.trim().toUpperCase());
    if (aliasUpper.some((a) => a.includes('S. EXACT') || a.includes('EXACT'))) {
      return loadComplianceFixture('open-sanctions-exact-match.json');
    }
    if (this.#scenario === 'stale' || upper.includes('STALE')) {
      return loadComplianceFixture('open-sanctions-stale.json');
    }
    if (upper.includes('PEP')) {
      return loadComplianceFixture('open-sanctions-pep-match.json');
    }
    if (subjectTypeIsOrganization(query.subjectType) || upper.includes('ORG')) {
      return loadComplianceFixture('open-sanctions-org-match.json');
    }
    if (upper.includes('FUZZY')) {
      return loadComplianceFixture('open-sanctions-fuzzy-match.json');
    }
    if (upper.includes('SANCTIONED') || upper.includes('EXACT')) {
      return loadComplianceFixture('open-sanctions-exact-match.json');
    }
    if (upper.includes('ALIAS') && query.aliases && query.aliases.length > 0) {
      return loadComplianceFixture('open-sanctions-exact-match.json');
    }
    if (this.#scenario === 'disagreeing') {
      return loadComplianceFixture('open-sanctions-no-match.json');
    }
    return loadComplianceFixture('open-sanctions-no-match.json');
  }
}

export function createOpenSanctionsAdapter(): OpenSanctionsAdapter {
  return new OpenSanctionsAdapter();
}
