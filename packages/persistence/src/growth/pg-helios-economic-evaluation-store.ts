import type { Pool } from 'pg';

import type { EconomicEvaluationStoreSnapshot } from '../../../platform/src/helios/economic-evaluation/store.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistHeliosEconomicEvaluationState(
  pool: Pool,
  state: EconomicEvaluationStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const experiment of Object.values(state.experiments)) {
        await client.query(
          `INSERT INTO growth.helios_economic_experiment
             (experiment_id, customer_id, state, frozen_hash, body_canonical, frozen_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (experiment_id) DO NOTHING`,
          [
            experiment.experimentId,
            experiment.customerId,
            experiment.state,
            experiment.frozenHash,
            JSON.stringify(experiment),
            experiment.frozenAt,
          ],
        );
      }
      for (const challenge of Object.values(state.challenges)) {
        await client.query(
          `INSERT INTO growth.helios_microcapital_challenge
             (challenge_id, experiment_id, body_canonical, frozen_at)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (challenge_id) DO NOTHING`,
          [challenge.challengeId, challenge.experimentId, JSON.stringify(challenge), challenge.frozenAt],
        );
      }
      for (const run of state.runs) {
        await client.query(
          `INSERT INTO growth.helios_economic_evaluation_run
             (run_id, experiment_id, customer_id, outcome, body_canonical, started_at, ended_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (run_id) DO NOTHING`,
          [
            run.runId,
            run.experimentId,
            run.customerId,
            run.outcome,
            JSON.stringify(run),
            run.startedAt,
            run.endedAt,
          ],
        );
      }
      for (const report of state.reports) {
        await client.query(
          `INSERT INTO growth.helios_economic_evaluation_report
             (report_id, experiment_id, body_canonical, generated_at)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (report_id) DO NOTHING`,
          [report.reportId, report.experiment.experimentId, JSON.stringify(report), report.generatedAt],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function loadHeliosEconomicEvaluationState(
  pool: Pool,
): Promise<EconomicEvaluationStoreSnapshot> {
  return withClient(pool, async (client) => {
    const experiments = await client.query(
      `SELECT body_canonical FROM growth.helios_economic_experiment ORDER BY frozen_at ASC`,
    );
    const challenges = await client.query(
      `SELECT body_canonical FROM growth.helios_microcapital_challenge ORDER BY frozen_at ASC`,
    );
    const runs = await client.query(
      `SELECT body_canonical FROM growth.helios_economic_evaluation_run ORDER BY started_at ASC`,
    );
    const reports = await client.query(
      `SELECT body_canonical FROM growth.helios_economic_evaluation_report ORDER BY generated_at ASC`,
    );
    const experimentEntries: [string, EconomicEvaluationStoreSnapshot['experiments'][string]][] = [];
    for (const row of experiments.rows) {
      const parsed = JSON.parse(row.body_canonical);
      experimentEntries.push([parsed.experimentId, parsed]);
    }
    const challengeEntries: [string, EconomicEvaluationStoreSnapshot['challenges'][string]][] = [];
    for (const row of challenges.rows) {
      const parsed = JSON.parse(row.body_canonical);
      challengeEntries.push([parsed.challengeId, parsed]);
    }
    return Object.freeze({
      experiments: Object.freeze(Object.fromEntries(experimentEntries)),
      challenges: Object.freeze(Object.fromEntries(challengeEntries)),
      runs: Object.freeze(runs.rows.map((row) => JSON.parse(row.body_canonical))),
      reports: Object.freeze(reports.rows.map((row) => JSON.parse(row.body_canonical))),
    });
  });
}
