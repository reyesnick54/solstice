import type { Pool } from 'pg';

import type { RiskStoreSnapshot } from '../../../risk/src/types.ts';
import { withClient } from '../postgres/pools.ts';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

export async function persistRiskState(pool: Pool, state: RiskStoreSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const budget of state.budgets) {
        await client.query(
          `INSERT INTO risk.budget
             (budget_id, subject_id, portfolio_id, version, review_by, engineering_only,
              cannot_loosen_mandate, body_canonical)
           VALUES ($1,$2,$3,$4,$5,TRUE,TRUE,$6)
           ON CONFLICT (budget_id) DO UPDATE SET body_canonical = EXCLUDED.body_canonical`,
          [budget.budgetId, budget.subjectId, budget.portfolioId, budget.version, budget.reviewBy, canonicalJson(budget)],
        );
      }
      for (const limit of state.limits) {
        await client.query(
          `INSERT INTO risk.limit_record
             (limit_id, dimension, priority, engineering_only, regulatory_requirement, body_canonical)
           VALUES ($1,$2,$3,TRUE,FALSE,$4)
           ON CONFLICT (limit_id) DO UPDATE SET body_canonical = EXCLUDED.body_canonical`,
          [limit.limitId, limit.dimension, limit.priority, canonicalJson(limit)],
        );
      }
      for (const snapshot of state.snapshots) {
        await client.query(
          `INSERT INTO risk.portfolio_snapshot
             (snapshot_id, portfolio_id, subject_id, as_of, currency, brokerage_cash_minor,
              simulation_only, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7)
           ON CONFLICT (snapshot_id) DO NOTHING`,
          [
            snapshot.snapshotId,
            snapshot.portfolioId,
            snapshot.subjectId,
            snapshot.asOf,
            snapshot.currency,
            snapshot.brokerageCashMinor.toString(),
            canonicalJson(snapshot),
          ],
        );
      }
      for (const assessment of state.assessments) {
        await client.query(
          `INSERT INTO risk.assessment
             (assessment_id, decision_id, snapshot_id, proposed_action_ref, model_id, model_version,
              policy_version, outcome, generated_at, guaranteed_outcome, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE,$10)
           ON CONFLICT (assessment_id) DO NOTHING`,
          [
            assessment.assessmentId,
            assessment.decisionId,
            assessment.snapshotId,
            assessment.proposedActionRef,
            String(assessment.modelId),
            String(assessment.modelVersion),
            assessment.policyVersion,
            assessment.outcome,
            assessment.generatedAt,
            canonicalJson(assessment),
          ],
        );
      }
      for (const scenario of state.scenarios) {
        await client.query(
          `INSERT INTO risk.stress_scenario
             (scenario_id, kind, version, source, status, predictive_claim, body_canonical)
           VALUES ($1,$2,$3,'ENGINEERING_FIXTURE','ACTIVE_SIMULATION',FALSE,$4)
           ON CONFLICT (scenario_id) DO NOTHING`,
          [scenario.scenarioId, scenario.kind, scenario.version, canonicalJson(scenario)],
        );
      }
      for (const run of state.runs) {
        await client.query(
          `INSERT INTO risk.stress_run
             (run_id, scenario_id, snapshot_id, estimated_loss_minor, generated_at,
              mutates_financial_state, places_orders, body_canonical)
           VALUES ($1,$2,$3,$4,$5,FALSE,FALSE,$6)
           ON CONFLICT (run_id) DO NOTHING`,
          [
            run.runId,
            run.scenarioId,
            run.snapshotId,
            run.estimatedLossMinor.toString(),
            run.generatedAt,
            canonicalJson(run),
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
