import type { Pool } from 'pg';

import type { AmlRiskProfile } from '../../../kernel/src/compliance/aml.ts';
import type { ComplianceCase, HumanDecision } from '../../../kernel/src/compliance/cases.ts';
import type { CounterpartyFact } from '../../../kernel/src/compliance/counterparty.ts';
import type { FraudEvaluation } from '../../../kernel/src/compliance/fraud.ts';
import type { MonitoringAlert } from '../../../kernel/src/compliance/monitoring.ts';
import type { ProviderHealth } from '../../../kernel/src/compliance/ports.ts';
import type { ScreeningResult } from '../../../kernel/src/compliance/result.ts';
import type { ComplianceSnapshot } from '../../../kernel/src/compliance/store.ts';
import type { VelocitySnapshot } from '../../../kernel/src/compliance/velocity.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistComplianceSnapshot(pool: Pool, snapshot: ComplianceSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const row of snapshot.screenings) {
        await client.query(
          `INSERT INTO compliance.screening_result (
             screening_id, screening_type, subject_kind, subject_ref, provider_ref, provider_model,
             outcome, reason_codes, confidence, score, jurisdiction, screened_at, refresh_by,
             evidence_refs, provider_hash, policy_version_id, stale
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,false)
           ON CONFLICT (screening_id) DO UPDATE SET
             outcome = EXCLUDED.outcome,
             stale = EXCLUDED.stale`,
          [
            row.screeningId,
            row.screeningType,
            row.subjectKind,
            row.subjectRef,
            row.providerRef,
            row.providerModel,
            row.outcome,
            row.reasonCodes,
            row.confidence,
            row.score,
            row.jurisdiction,
            row.screenedAt,
            row.refreshBy,
            row.evidenceRefs,
            row.providerHash,
            row.policyVersionId,
          ],
        );
      }
      for (const row of snapshot.profiles) {
        await client.query(
          `INSERT INTO compliance.aml_profile (
             profile_id, subject_ref, version, category, reason_codes, input_hash, jurisdiction, created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (profile_id) DO NOTHING`,
          [
            row.profileId,
            row.subjectRef,
            row.version,
            row.category,
            row.reasonCodes,
            row.inputHash,
            row.jurisdiction,
            row.createdAt,
          ],
        );
      }
      for (const row of snapshot.alerts) {
        await client.query(
          `INSERT INTO compliance.alert (
             alert_id, alert_kind, rule_id, legal_confidence, subject_ref, outcome, reason_codes,
             journal_id, intent_id, created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (alert_id) DO NOTHING`,
          [
            row.alertId,
            row.alertKind,
            row.ruleId,
            row.legalConfidence,
            row.subjectRef,
            row.outcome,
            row.reasonCodes,
            row.journalId,
            row.intentId,
            row.createdAt,
          ],
        );
      }
      for (const row of snapshot.fraud) {
        await client.query(
          `INSERT INTO compliance.fraud_result (
             evaluation_id, subject_ref, outcome, reason_codes, required_assurance, evaluated_at, policy_version_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (evaluation_id) DO NOTHING`,
          [
            row.evaluationId,
            row.subjectRef,
            row.outcome,
            row.reasonCodes,
            row.requiredAssurance,
            row.evaluatedAt,
            row.policyVersionId,
          ],
        );
      }
      for (const row of snapshot.velocity) {
        await client.query(
          `INSERT INTO compliance.velocity_counter (
             counter_key, window_ms, count, amount_minor, window_started_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (counter_key) DO UPDATE SET
             count = EXCLUDED.count,
             amount_minor = EXCLUDED.amount_minor,
             updated_at = EXCLUDED.updated_at`,
          [row.counterKey, row.windowMs, row.count, row.amountMinor, row.windowStartedAt, row.updatedAt],
        );
      }
      for (const row of snapshot.cases) {
        await client.query(
          `INSERT INTO compliance.case_record (
             case_id, case_type, status, finality, reason_codes, origin_refs, subject_ref,
             counterparty_ref, jurisdiction, policy_version_id, created_at, owner_ref
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (case_id) DO UPDATE SET
             status = EXCLUDED.status,
             finality = EXCLUDED.finality,
             owner_ref = EXCLUDED.owner_ref`,
          [
            row.caseId,
            row.caseType,
            row.status,
            row.finality,
            row.reasonCodes,
            row.originRefs,
            row.subjectRef,
            row.counterpartyRef,
            row.jurisdiction,
            row.policyVersionId,
            row.createdAt,
            row.ownerRef,
          ],
        );
      }
      for (const row of snapshot.decisions) {
        await client.query(
          `INSERT INTO compliance.human_decision (
             decision_id, case_id, decision, operator_ref, actor_kind, reason, evidence_refs, decided_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (decision_id) DO NOTHING`,
          [
            row.decisionId,
            row.caseId,
            row.decision,
            row.operatorRef,
            row.actorKind,
            row.reason,
            row.evidenceRefs,
            row.decidedAt,
          ],
        );
      }
      for (const row of snapshot.providers) {
        await client.query(
          `INSERT INTO compliance.provider_health (
             provider_id, available, last_checked_at, last_error_code
           ) VALUES ($1,$2,$3,$4)
           ON CONFLICT (provider_id) DO UPDATE SET
             available = EXCLUDED.available,
             last_checked_at = EXCLUDED.last_checked_at,
             last_error_code = EXCLUDED.last_error_code`,
          [row.providerId, row.available, row.lastCheckedAt, row.lastErrorCode],
        );
      }
      for (const row of snapshot.counterparties) {
        await client.query(
          `INSERT INTO compliance.counterparty_fact (
             counterparty_ref, kind, jurisdiction, latest_sanctions_id, latest_pep_id, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (counterparty_ref) DO UPDATE SET
             latest_sanctions_id = EXCLUDED.latest_sanctions_id,
             latest_pep_id = EXCLUDED.latest_pep_id,
             updated_at = EXCLUDED.updated_at`,
          [
            row.counterpartyRef,
            row.kind,
            row.jurisdiction,
            row.latestSanctionsId,
            row.latestPepId,
            row.createdAt,
            row.updatedAt,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function loadComplianceSnapshot(pool: Pool): Promise<ComplianceSnapshot> {
  const [screenings, profiles, alerts, fraud, velocity, cases, decisions, providers, counterparties] =
    await Promise.all([
      pool.query(`SELECT * FROM compliance.screening_result`),
      pool.query(`SELECT * FROM compliance.aml_profile ORDER BY subject_ref, version`),
      pool.query(`SELECT * FROM compliance.alert`),
      pool.query(`SELECT * FROM compliance.fraud_result`),
      pool.query(`SELECT * FROM compliance.velocity_counter`),
      pool.query(`SELECT * FROM compliance.case_record`),
      pool.query(`SELECT * FROM compliance.human_decision`),
      pool.query(`SELECT * FROM compliance.provider_health`),
      pool.query(`SELECT * FROM compliance.counterparty_fact`),
    ]);
  return Object.freeze({
    screenings: Object.freeze(screenings.rows.map(mapScreening)),
    adverseMedia: Object.freeze([]),
    profiles: Object.freeze(profiles.rows.map(mapProfile)),
    alerts: Object.freeze(alerts.rows.map(mapAlert)),
    fraud: Object.freeze(fraud.rows.map(mapFraud)),
    velocity: Object.freeze(velocity.rows.map(mapVelocity)),
    cases: Object.freeze(cases.rows.map(mapCase)),
    decisions: Object.freeze(decisions.rows.map(mapDecision)),
    providers: Object.freeze(providers.rows.map(mapProvider)),
    counterparties: Object.freeze(counterparties.rows.map(mapCounterparty)),
  });
}

function mapScreening(row: Record<string, unknown>): ScreeningResult {
  return Object.freeze({
    screeningId: String(row.screening_id),
    screeningType: row.screening_type as ScreeningResult['screeningType'],
    subjectKind: row.subject_kind as ScreeningResult['subjectKind'],
    subjectRef: String(row.subject_ref),
    providerRef: String(row.provider_ref),
    providerModel: row.provider_model === null ? null : String(row.provider_model),
    outcome: row.outcome as ScreeningResult['outcome'],
    reasonCodes: Object.freeze(asStringArray(row.reason_codes)),
    confidence: row.confidence === null ? null : Number(row.confidence),
    score: row.score === null ? null : Number(row.score),
    jurisdiction: String(row.jurisdiction),
    screenedAt: asUtcInstant(asDate(row.screened_at)),
    refreshBy: asUtcInstant(asDate(row.refresh_by)),
    evidenceRefs: Object.freeze(asStringArray(row.evidence_refs)),
    providerHash: String(row.provider_hash),
    policyVersionId: row.policy_version_id === null ? null : String(row.policy_version_id),
  });
}

function mapProfile(row: Record<string, unknown>): AmlRiskProfile {
  return Object.freeze({
    profileId: String(row.profile_id),
    subjectRef: String(row.subject_ref),
    version: Number(row.version),
    category: row.category as AmlRiskProfile['category'],
    reasonCodes: Object.freeze(asStringArray(row.reason_codes)),
    inputHash: String(row.input_hash),
    jurisdiction: String(row.jurisdiction),
    createdAt: asUtcInstant(asDate(row.created_at)),
  });
}

function mapAlert(row: Record<string, unknown>): MonitoringAlert {
  return Object.freeze({
    alertId: String(row.alert_id),
    alertKind: 'TRANSACTION_MONITORING',
    ruleId: String(row.rule_id),
    legalConfidence: 'RESEARCH_REQUIRED',
    subjectRef: String(row.subject_ref),
    outcome: row.outcome as MonitoringAlert['outcome'],
    reasonCodes: Object.freeze(asStringArray(row.reason_codes)),
    journalId: row.journal_id === null ? null : String(row.journal_id),
    intentId: row.intent_id === null ? null : String(row.intent_id),
    createdAt: asUtcInstant(asDate(row.created_at)),
  });
}

function mapFraud(row: Record<string, unknown>): FraudEvaluation {
  return Object.freeze({
    evaluationId: String(row.evaluation_id),
    subjectRef: String(row.subject_ref),
    outcome: row.outcome as FraudEvaluation['outcome'],
    reasonCodes: Object.freeze(asStringArray(row.reason_codes)),
    requiredAssurance: (row.required_assurance as FraudEvaluation['requiredAssurance']) ?? null,
    evaluatedAt: asUtcInstant(asDate(row.evaluated_at)),
    policyVersionId: row.policy_version_id === null ? null : String(row.policy_version_id),
  });
}

function mapVelocity(row: Record<string, unknown>): VelocitySnapshot {
  return Object.freeze({
    counterKey: String(row.counter_key),
    windowMs: Number(row.window_ms),
    count: Number(row.count),
    amountMinor: String(row.amount_minor),
    windowStartedAt: asUtcInstant(asDate(row.window_started_at)),
    updatedAt: asUtcInstant(asDate(row.updated_at)),
  });
}

function mapCase(row: Record<string, unknown>): ComplianceCase {
  return Object.freeze({
    caseId: String(row.case_id),
    caseType: row.case_type as ComplianceCase['caseType'],
    status: row.status as ComplianceCase['status'],
    finality: row.finality as ComplianceCase['finality'],
    reasonCodes: Object.freeze(asStringArray(row.reason_codes)),
    originRefs: Object.freeze(asStringArray(row.origin_refs)),
    subjectRef: String(row.subject_ref),
    counterpartyRef: row.counterparty_ref === null ? null : String(row.counterparty_ref),
    jurisdiction: String(row.jurisdiction),
    policyVersionId: row.policy_version_id === null ? null : String(row.policy_version_id),
    createdAt: asUtcInstant(asDate(row.created_at)),
    ownerRef: row.owner_ref === null ? null : String(row.owner_ref),
  });
}

function mapDecision(row: Record<string, unknown>): HumanDecision {
  return Object.freeze({
    decisionId: String(row.decision_id),
    caseId: String(row.case_id),
    decision: row.decision as HumanDecision['decision'],
    operatorRef: String(row.operator_ref),
    actorKind: row.actor_kind as HumanDecision['actorKind'],
    reason: String(row.reason),
    evidenceRefs: Object.freeze(asStringArray(row.evidence_refs)),
    decidedAt: asUtcInstant(asDate(row.decided_at)),
  });
}

function mapProvider(row: Record<string, unknown>): ProviderHealth {
  return Object.freeze({
    providerId: String(row.provider_id),
    available: Boolean(row.available),
    lastCheckedAt: asUtcInstant(asDate(row.last_checked_at)),
    lastErrorCode: row.last_error_code === null ? null : String(row.last_error_code),
  });
}

function mapCounterparty(row: Record<string, unknown>): CounterpartyFact {
  return Object.freeze({
    counterpartyRef: String(row.counterparty_ref),
    kind: row.kind as CounterpartyFact['kind'],
    jurisdiction: row.jurisdiction === null ? null : String(row.jurisdiction),
    latestSanctionsId: row.latest_sanctions_id === null ? null : String(row.latest_sanctions_id),
    latestPepId: row.latest_pep_id === null ? null : String(row.latest_pep_id),
    createdAt: asUtcInstant(asDate(row.created_at)),
    updatedAt: asUtcInstant(asDate(row.updated_at)),
  });
}

function asStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function asDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}
