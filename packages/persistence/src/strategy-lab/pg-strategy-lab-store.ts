import type { Pool } from 'pg';

import type { StrategyLabSnapshot } from '../../../strategy-lab/src/store.ts';
import { withClient } from '../postgres/pools.ts';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

export async function persistStrategyLabState(pool: Pool, state: StrategyLabSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const strategy of state.strategies) {
        await client.query(
          `INSERT INTO strategy_lab.strategy
             (strategy_id, version, specification_id, compiler_version, compiled_hash, lifecycle,
              subject_id, created_at, mesh_proposal_id, live_approved, simulation_only, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE,TRUE,$10)
           ON CONFLICT (strategy_id, version) DO UPDATE SET
             lifecycle = EXCLUDED.lifecycle,
             compiled_hash = EXCLUDED.compiled_hash,
             body_canonical = EXCLUDED.body_canonical`,
          [
            strategy.strategyId,
            strategy.version,
            strategy.specificationId,
            strategy.compilerVersion,
            strategy.compiledHash,
            strategy.lifecycle,
            strategy.subjectId,
            strategy.createdAt,
            strategy.meshProposalId,
            canonicalJson(strategy),
          ],
        );
      }
      for (const dataset of state.datasets) {
        await client.query(
          `INSERT INTO strategy_lab.dataset
             (dataset_id, version, hash, currency, source, live_market_data, body_canonical)
           VALUES ($1,$2,$3,$4,'SYNTHETIC_FIXTURE',FALSE,$5)
           ON CONFLICT (dataset_id, version) DO NOTHING`,
          [dataset.datasetId, dataset.version, dataset.hash, dataset.currency, canonicalJson(dataset)],
        );
      }
      for (const experiment of state.experiments) {
        await client.query(
          `INSERT INTO strategy_lab.experiment
             (experiment_id, strategy_id, dataset_id, dataset_version, selection_criteria,
              results_retained, generated_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,TRUE,$6,$7)
           ON CONFLICT (experiment_id) DO NOTHING`,
          [
            experiment.experimentId,
            experiment.strategyId,
            experiment.datasetId,
            experiment.datasetVersion,
            experiment.selectionCriteria,
            experiment.generatedAt,
            canonicalJson(experiment),
          ],
        );
        for (const parameterSet of experiment.parameterSets) {
          await client.query(
            `INSERT INTO strategy_lab.parameter_set
               (parameter_set_id, experiment_id, values_canonical, hidden)
             VALUES ($1,$2,$3,FALSE)
             ON CONFLICT (parameter_set_id) DO NOTHING`,
            [parameterSet.parameterSetId, experiment.experimentId, canonicalJson(parameterSet.values)],
          );
        }
      }
      for (const run of state.backtests) {
        await client.query(
          `INSERT INTO strategy_lab.backtest_run
             (run_id, strategy_id, strategy_version, compiler_version, compiled_hash, dataset_id,
              dataset_version, partition, starting_capital_minor, output_hash, generated_at,
              train_unbiased_claim, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,FALSE,$12)
           ON CONFLICT (run_id) DO NOTHING`,
          [
            run.runId,
            run.strategyId,
            run.strategyVersion,
            run.compilerVersion,
            run.compiledHash,
            run.datasetId,
            run.datasetVersion,
            run.partition,
            run.startingCapitalMinor.toString(),
            run.outputHash,
            run.generatedAt,
            canonicalJson(run),
          ],
        );
      }
      for (const run of state.walkForwards) {
        await client.query(
          `INSERT INTO strategy_lab.walk_forward_run
             (run_id, strategy_id, strategy_version, dataset_id, dataset_version, generated_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (run_id) DO NOTHING`,
          [run.runId, run.strategyId, run.strategyVersion, run.datasetId, run.datasetVersion, run.generatedAt, canonicalJson(run)],
        );
      }
      for (const report of state.validations) {
        await client.query(
          `INSERT INTO strategy_lab.validation_report
             (validation_id, strategy_id, strategy_version, compiler_version, compiled_hash,
              generated_at, train_unbiased_expected_performance, future_return_guarantee, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,FALSE,FALSE,$7)
           ON CONFLICT (validation_id) DO NOTHING`,
          [
            report.validationId,
            report.strategyId,
            report.strategyVersion,
            report.compilerVersion,
            report.compiledHash,
            report.generatedAt,
            canonicalJson(report),
          ],
        );
      }
      for (const run of state.shadowRuns) {
        await client.query(
          `INSERT INTO strategy_lab.shadow_run
             (run_id, strategy_id, strategy_version, dataset_id, dataset_version, started_at,
              sends_orders, changes_investment_state, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,FALSE,FALSE,$7)
           ON CONFLICT (run_id) DO NOTHING`,
          [run.runId, run.strategyId, run.strategyVersion, run.datasetId, run.datasetVersion, run.startedAt, canonicalJson(run)],
        );
      }
      for (const decision of state.shadowDecisions) {
        await client.query(
          `INSERT INTO strategy_lab.shadow_decision
             (decision_id, run_id, timestamp, would_trade, broker_submission, body_canonical)
           VALUES ($1,$2,$3,$4,FALSE,$5)
           ON CONFLICT (decision_id) DO NOTHING`,
          [decision.decisionId, decision.runId, decision.timestamp, decision.wouldTrade, canonicalJson(decision)],
        );
      }
      for (const run of state.paperRuns) {
        await client.query(
          `INSERT INTO strategy_lab.paper_run
             (run_id, strategy_id, strategy_version, investment_account_id, started_at, halt_reason,
              track, merged_into_backtest, live_broker, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,'PAPER',FALSE,FALSE,$7)
           ON CONFLICT (run_id) DO NOTHING`,
          [
            run.runId,
            run.strategyId,
            run.strategyVersion,
            run.investmentAccountId,
            run.startedAt,
            run.haltReason,
            canonicalJson(run),
          ],
        );
      }
      for (const review of state.reviews) {
        await client.query(
          `INSERT INTO strategy_lab.promotion_review
             (review_id, strategy_id, strategy_version, target, actor_id, subject_id, session_id,
              actor_kind, reason, decided_at, accepted, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'HUMAN_OPERATOR',$8,$9,$10,$11)
           ON CONFLICT (review_id) DO NOTHING`,
          [
            review.reviewId,
            review.strategyId,
            review.strategyVersion,
            review.target,
            review.actorId,
            review.subjectId,
            review.sessionId,
            review.reason,
            review.decidedAt,
            review.accepted,
            canonicalJson(review),
          ],
        );
      }
      await client.query(
        `INSERT INTO strategy_lab.kill_switch
           (id, active, reason, activated_at, blocks_new_orders, history_immutable, body_canonical)
         VALUES ('current',$1,$2,$3,TRUE,TRUE,$4)
         ON CONFLICT (id) DO UPDATE SET
           active = EXCLUDED.active,
           reason = EXCLUDED.reason,
           activated_at = EXCLUDED.activated_at,
           body_canonical = EXCLUDED.body_canonical`,
        [state.killSwitch.active, state.killSwitch.reason, state.killSwitch.activatedAt, canonicalJson(state.killSwitch)],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
