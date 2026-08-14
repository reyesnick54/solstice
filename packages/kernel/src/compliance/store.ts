import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AdverseMediaReference, ScreeningResult } from './result.ts';
import type { AmlRiskProfile } from './aml.ts';
import type { ComplianceCase, HumanDecision } from './cases.ts';
import type { CounterpartyFact } from './counterparty.ts';
import type { FraudEvaluation } from './fraud.ts';
import type { MonitoringAlert } from './monitoring.ts';
import type { ProviderHealth } from './ports.ts';
import type { VelocitySnapshot } from './velocity.ts';

export type ComplianceSnapshot = {
  readonly screenings: readonly ScreeningResult[];
  readonly adverseMedia: readonly AdverseMediaReference[];
  readonly profiles: readonly AmlRiskProfile[];
  readonly alerts: readonly MonitoringAlert[];
  readonly fraud: readonly FraudEvaluation[];
  readonly velocity: readonly VelocitySnapshot[];
  readonly cases: readonly ComplianceCase[];
  readonly decisions: readonly HumanDecision[];
  readonly providers: readonly ProviderHealth[];
  readonly counterparties: readonly CounterpartyFact[];
};

export class ComplianceStore {
  readonly screenings = new Map<string, ScreeningResult>();
  readonly adverseMedia: AdverseMediaReference[] = [];
  readonly profiles = new Map<string, AmlRiskProfile[]>();
  readonly alerts = new Map<string, MonitoringAlert>();
  readonly fraud = new Map<string, FraudEvaluation>();
  readonly velocity = new Map<string, VelocitySnapshot>();
  readonly cases = new Map<string, ComplianceCase>();
  readonly decisions = new Map<string, HumanDecision>();
  readonly providers = new Map<string, ProviderHealth>();
  readonly counterparties = new Map<string, CounterpartyFact>();

  hydrate(snapshot: ComplianceSnapshot): void {
    for (const row of snapshot.screenings) {
      this.screenings.set(row.screeningId, Object.freeze({ ...row }));
    }
    this.adverseMedia.push(...snapshot.adverseMedia.map((row) => Object.freeze({ ...row })));
    for (const row of snapshot.profiles) {
      const list = this.profiles.get(row.subjectRef) ?? [];
      list.push(Object.freeze({ ...row }));
      this.profiles.set(row.subjectRef, list);
    }
    for (const row of snapshot.alerts) {
      this.alerts.set(row.alertId, Object.freeze({ ...row }));
    }
    for (const row of snapshot.fraud) {
      this.fraud.set(row.evaluationId, Object.freeze({ ...row }));
    }
    for (const row of snapshot.velocity) {
      this.velocity.set(row.counterKey, Object.freeze({ ...row }));
    }
    for (const row of snapshot.cases) {
      this.cases.set(row.caseId, Object.freeze({ ...row }));
    }
    for (const row of snapshot.decisions) {
      this.decisions.set(row.decisionId, Object.freeze({ ...row }));
    }
    for (const row of snapshot.providers) {
      this.providers.set(row.providerId, Object.freeze({ ...row }));
    }
    for (const row of snapshot.counterparties) {
      this.counterparties.set(row.counterpartyRef, Object.freeze({ ...row }));
    }
  }

  snapshot(): ComplianceSnapshot {
    return Object.freeze({
      screenings: Object.freeze([...this.screenings.values()]),
      adverseMedia: Object.freeze([...this.adverseMedia]),
      profiles: Object.freeze([...this.profiles.values()].flat()),
      alerts: Object.freeze([...this.alerts.values()]),
      fraud: Object.freeze([...this.fraud.values()]),
      velocity: Object.freeze([...this.velocity.values()]),
      cases: Object.freeze([...this.cases.values()]),
      decisions: Object.freeze([...this.decisions.values()]),
      providers: Object.freeze([...this.providers.values()]),
      counterparties: Object.freeze([...this.counterparties.values()]),
    });
  }

  latestScreening(subjectRef: string, type: ScreeningResult['screeningType']): ScreeningResult | undefined {
    let latest: ScreeningResult | undefined;
    for (const row of this.screenings.values()) {
      if (row.subjectRef !== subjectRef || row.screeningType !== type) {
        continue;
      }
      if (!latest || row.screenedAt > latest.screenedAt) {
        latest = row;
      }
    }
    return latest;
  }

  latestProfile(subjectRef: string): AmlRiskProfile | undefined {
    const list = this.profiles.get(subjectRef) ?? [];
    return list[list.length - 1];
  }

  markProvider(providerId: string, available: boolean, now: UtcInstant, error?: string): void {
    this.providers.set(
      providerId,
      Object.freeze({
        providerId,
        available,
        lastCheckedAt: now,
        lastErrorCode: error ?? null,
      }),
    );
  }
}
