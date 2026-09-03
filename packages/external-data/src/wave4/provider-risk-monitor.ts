// @ts-nocheck
/**
 * Provider Risk Monitor — analyzes external provider health and security posture.
 *
 * May recommend provider-level quarantine via existing disable mechanisms.
 * Does NOT shut down SunRey core services, Money, Exchange, or blockchain.
 */

import type { ProviderAdapterState } from '../adapters.ts';
import type {
  EndpointSecurityObservation,
  ProviderQuarantineRecord,
  ProviderRiskDimension,
  ProviderRiskFactor,
  ProviderRiskScore,
  ProviderRiskState,
  ServiceIncidentObservation,
} from './models.ts';

export type ProviderRiskInput = {
  readonly providerId: string;
  readonly adapterState: ProviderAdapterState;
  readonly endpointSecurity?: readonly EndpointSecurityObservation[];
  readonly serviceIncidents?: readonly ServiceIncidentObservation[];
  readonly schemaChangeCount?: number;
  readonly authFailureCount?: number;
  readonly dataAnomalyCount?: number;
  readonly catalogVerified?: boolean;
  readonly quarantined?: boolean;
  readonly quarantineReason?: string | null;
};

export type ProviderRiskMonitorOptions = {
  readonly nowUtc?: string;
  readonly quarantineThreshold?: number;
  readonly suspiciousThreshold?: number;
};

const DEFAULT_QUARANTINE_THRESHOLD = 80;
const DEFAULT_SUSPICIOUS_THRESHOLD = 50;

export class ProviderRiskMonitor {
  readonly #nowUtc: string;
  readonly #quarantineThreshold: number;
  readonly #suspiciousThreshold: number;
  readonly #quarantineHistory: Map<string, ProviderQuarantineRecord[]>;
  readonly #quarantined: Set<string>;

  constructor(options: ProviderRiskMonitorOptions = {}) {
    this.#nowUtc = options.nowUtc ?? new Date().toISOString();
    this.#quarantineThreshold = options.quarantineThreshold ?? DEFAULT_QUARANTINE_THRESHOLD;
    this.#suspiciousThreshold = options.suspiciousThreshold ?? DEFAULT_SUSPICIOUS_THRESHOLD;
    this.#quarantineHistory = new Map();
    this.#quarantined = new Set();
  }

  assess(input: ProviderRiskInput): ProviderRiskScore {
    const factors: ProviderRiskFactor[] = [];
    let score = 0;

    // Availability risk
    if (input.adapterState.down) {
      factors.push({ dimension: 'availability', contribution: 40, reason: 'Provider unreachable' });
      score += 40;
    } else if (input.adapterState.rateLimited) {
      factors.push({ dimension: 'availability', contribution: 15, reason: 'Rate limited' });
      score += 15;
    } else if (input.adapterState.circuitState === 'OPEN') {
      factors.push({ dimension: 'availability', contribution: 30, reason: 'Circuit breaker open' });
      score += 30;
    }

    // Security risk — TLS/HTTP posture changes
    if (input.endpointSecurity) {
      for (const scan of input.endpointSecurity) {
        if (scan.certificateStatus === 'INVALID' || scan.certificateStatus === 'EXPIRED') {
          factors.push({ dimension: 'security', contribution: 25, reason: `Invalid TLS certificate on ${scan.host}` });
          score += 25;
        }
        if (scan.grade && ['D', 'F'].includes(scan.grade)) {
          factors.push({ dimension: 'security', contribution: 15, reason: `Poor security grade (${scan.grade}) on ${scan.host}` });
          score += 15;
        }
      }
    }

    // Data integrity risk
    if ((input.schemaChangeCount ?? 0) >= 2) {
      factors.push({ dimension: 'data_integrity', contribution: 20, reason: 'Repeated schema changes' });
      score += 20;
    }
    if ((input.dataAnomalyCount ?? 0) >= 3) {
      factors.push({ dimension: 'data_integrity', contribution: 25, reason: 'Material data anomalies' });
      score += 25;
    }
    if (input.adapterState.malformed) {
      factors.push({ dimension: 'data_integrity', contribution: 20, reason: 'Malformed response payload' });
      score += 20;
    }

    // Credential risk
    if ((input.authFailureCount ?? 0) >= 2) {
      factors.push({ dimension: 'credential', contribution: 30, reason: 'Repeated authentication failures' });
      score += 30;
    }

    // Licensing/governance risk
    if (input.catalogVerified === false) {
      factors.push({ dimension: 'licensing_governance', contribution: 10, reason: 'Catalog verification incomplete' });
      score += 10;
    }

    // Outage intelligence (supplements, does not override direct health checks)
    if (input.serviceIncidents) {
      for (const incident of input.serviceIncidents) {
        if (incident.status === 'MAJOR_OUTAGE') {
          factors.push({ dimension: 'availability', contribution: 20, reason: `External outage report: ${incident.serviceName}` });
          score += 20;
        }
      }
    }

    const cappedScore = Math.min(100, score);
    const state = this.#deriveState(cappedScore, input);
    const quarantined = input.quarantined ?? this.#quarantined.has(input.providerId);

    return Object.freeze({
      providerId: input.providerId,
      score: cappedScore,
      state,
      factors: Object.freeze(factors),
      assessedAt: this.#nowUtc,
      quarantined,
      quarantineReason: quarantined ? (input.quarantineReason ?? this.#latestQuarantineReason(input.providerId)) : null,
    });
  }

  #deriveState(score: number, input: ProviderRiskInput): ProviderRiskState {
    if (!input.adapterState.enabled || this.#quarantined.has(input.providerId)) {
      return 'DISABLED';
    }
    if (input.adapterState.down && input.adapterState.malformed) {
      return 'COMPROMISED_SUSPECTED';
    }
    if (score >= this.#quarantineThreshold) {
      return 'SUSPICIOUS';
    }
    if (score >= this.#suspiciousThreshold) {
      return 'DEGRADED';
    }
    if (score === 0 && input.adapterState.lastSuccess) {
      return 'NORMAL';
    }
    if (score === 0 && !input.adapterState.lastSuccess && !input.adapterState.lastError) {
      return 'UNKNOWN';
    }
    return score > 0 ? 'DEGRADED' : 'NORMAL';
  }

  #latestQuarantineReason(providerId: string): string | null {
    const history = this.#quarantineHistory.get(providerId);
    if (!history || history.length === 0) {
      return null;
    }
    return history[history.length - 1].reason;
  }

  /** Quarantine a provider — no new live requests, cache subject to freshness policy. */
  quarantine(providerId: string, reason: string, triggeredBy: string, previousState: ProviderRiskState): ProviderQuarantineRecord {
    this.#quarantined.add(providerId);
    const record: ProviderQuarantineRecord = Object.freeze({
      providerId,
      quarantinedAt: this.#nowUtc,
      reason,
      triggeredBy,
      previousState,
      restoredAt: null,
      restorationValidated: false,
    });
    const history = this.#quarantineHistory.get(providerId) ?? [];
    history.push(record);
    this.#quarantineHistory.set(providerId, history);
    return record;
  }

  /** Controlled recovery — requires validation, not a single successful request. */
  beginRecovery(providerId: string): { readonly allowed: boolean; readonly reason: string } {
    const history = this.#quarantineHistory.get(providerId);
    if (!history || history.length === 0) {
      return Object.freeze({ allowed: false, reason: 'No quarantine history' });
    }
    const latest = history[history.length - 1];
    if (latest.restoredAt) {
      return Object.freeze({ allowed: false, reason: 'Already restored' });
    }
    return Object.freeze({ allowed: true, reason: 'Safe probe permitted' });
  }

  completeRecovery(providerId: string, validated: boolean): ProviderQuarantineRecord | null {
    const history = this.#quarantineHistory.get(providerId);
    if (!history || history.length === 0) {
      return null;
    }
    const latest = history[history.length - 1];
    if (latest.restoredAt) {
      return latest;
    }
    if (!validated) {
      return null;
    }
    this.#quarantined.delete(providerId);
    const restored: ProviderQuarantineRecord = Object.freeze({
      ...latest,
      restoredAt: this.#nowUtc,
      restorationValidated: true,
    });
    history[history.length - 1] = restored;
    return restored;
  }

  isQuarantined(providerId: string): boolean {
    return this.#quarantined.has(providerId);
  }

  getHistory(providerId: string): readonly ProviderQuarantineRecord[] {
    return Object.freeze(this.#quarantineHistory.get(providerId) ?? []);
  }

  assessAll(
    inputs: readonly ProviderRiskInput[],
  ): readonly ProviderRiskScore[] {
    return Object.freeze(inputs.map((input) => this.assess(input)));
  }

  /** Recommend quarantine when risk exceeds threshold — caller applies via existing disable mechanism. */
  recommendQuarantine(score: ProviderRiskScore): { readonly recommend: boolean; readonly reason: string } {
    if (score.state === 'SUSPICIOUS' || score.state === 'COMPROMISED_SUSPECTED') {
      return Object.freeze({
        recommend: true,
        reason: `Risk score ${score.score} with state ${score.state}: ${score.factors.map((f) => f.reason).join('; ')}`,
      });
    }
    return Object.freeze({ recommend: false, reason: 'Within acceptable risk bounds' });
  }
}

export function createProviderRiskMonitor(options?: ProviderRiskMonitorOptions): ProviderRiskMonitor {
  return new ProviderRiskMonitor(options);
}
