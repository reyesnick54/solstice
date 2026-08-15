import type { Pool } from 'pg';

import type { PeveStoreSnapshot } from '../../../platform/src/value/store.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistPeveState(pool: Pool, state: PeveStoreSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const formula of state.formulas) {
        await client.query(
          `INSERT INTO peve.formula_version
             (formula_version, model_version, lifecycle, weights_canonical, weight_denominator,
              reserve_coverage_target_months, attributed_value_scale_minor_units, research_required,
              activated_at, retired_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (formula_version, model_version) DO UPDATE SET
             lifecycle = EXCLUDED.lifecycle,
             activated_at = EXCLUDED.activated_at,
             retired_at = EXCLUDED.retired_at`,
          [
            formula.formulaVersion,
            formula.modelVersion,
            formula.lifecycle,
            JSON.stringify(formula.weights),
            formula.weightDenominator,
            formula.reserveCoverageTargetMonths,
            formula.attributedValueScaleMinorUnits,
            formula.researchRequired,
            formula.activatedAt ?? null,
            formula.retiredAt ?? null,
          ],
        );
      }
      for (const snapshot of state.snapshots) {
        await client.query(
          `INSERT INTO peve.snapshot
             (snapshot_id, profile_id, subject_id, generated_at, peg_snapshot_id, formula_version,
              model_version, completeness, confidence, body_canonical, restated)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (snapshot_id) DO NOTHING`,
          [
            snapshot.snapshotId,
            snapshot.profileId,
            snapshot.subjectId,
            snapshot.generatedAt,
            snapshot.pegSnapshotId,
            snapshot.formulaVersion,
            snapshot.modelVersion,
            snapshot.completeness,
            snapshot.confidence,
            JSON.stringify(snapshot),
            snapshot.restated,
          ],
        );
        for (const dimension of snapshot.vector.dimensions) {
          await client.query(
            `INSERT INTO peve.dimension_result
               (dimension_id, snapshot_id, kind, points, formula_version, confidence, body_canonical)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (dimension_id) DO NOTHING`,
            [
              dimension.dimensionId,
              snapshot.snapshotId,
              dimension.kind,
              dimension.measure.points,
              dimension.formulaVersion,
              dimension.confidence,
              JSON.stringify(dimension),
            ],
          );
        }
      }
      for (const entry of state.attributions) {
        await client.query(
          `INSERT INTO peve.attribution_entry
             (entry_id, subject_id, group_id, source_event_id, source_key, realization,
              attribution_type, minor_units, currency, is_primary_for_group, formula_version,
              recorded_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (entry_id) DO NOTHING`,
          [
            entry.entryId,
            entry.subjectId,
            entry.groupId,
            entry.sourceEventId,
            entry.sourceKey,
            entry.realization,
            entry.attributionType,
            entry.amount.minorUnits,
            entry.amount.currency,
            entry.isPrimaryForGroup,
            entry.formulaVersion,
            entry.recordedAt,
            JSON.stringify(entry),
          ],
        );
        await client.query(
          `INSERT INTO peve.attribution_group (group_id, subject_id, source_key)
           VALUES ($1,$2,$3)
           ON CONFLICT (group_id) DO NOTHING`,
          [entry.groupId, entry.subjectId, entry.sourceKey],
        );
      }
      for (const baseline of state.baselines) {
        await client.query(
          `INSERT INTO peve.counterfactual_baseline
             (baseline_id, subject_id, kind, formula_version, body_canonical)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (baseline_id) DO NOTHING`,
          [baseline.baselineId, baseline.subjectId, baseline.kind, baseline.formulaVersion, JSON.stringify(baseline)],
        );
      }
      for (const comparison of state.comparisons) {
        await client.query(
          `INSERT INTO peve.model_comparison
             (left_formula, left_model, right_formula, right_model, body_canonical, compared_at)
           VALUES ($1,$2,$3,$4,$5, NOW())
           ON CONFLICT (left_formula, left_model, right_formula, right_model) DO UPDATE SET
             body_canonical = EXCLUDED.body_canonical`,
          [
            comparison.left.formulaVersion,
            comparison.left.modelVersion,
            comparison.right.formulaVersion,
            comparison.right.modelVersion,
            JSON.stringify(comparison),
          ],
        );
      }
      for (const contribution of state.contributions) {
        await client.query(
          `INSERT INTO peve.data_contribution
             (reference_id, subject_id, purpose, estimated_labeled, body_canonical)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (reference_id) DO UPDATE SET body_canonical = EXCLUDED.body_canonical`,
          [
            contribution.referenceId,
            contribution.subjectId,
            contribution.purpose,
            contribution.estimatedLabeled,
            JSON.stringify(contribution),
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

export async function loadPeveState(pool: Pool): Promise<PeveStoreSnapshot> {
  return withClient(pool, async (client) => {
    const snapshots = await client.query<{ body_canonical: string }>('SELECT body_canonical FROM peve.snapshot');
    const attributions = await client.query<{ body_canonical: string }>(
      'SELECT body_canonical FROM peve.attribution_entry',
    );
    const baselines = await client.query<{ body_canonical: string }>(
      'SELECT body_canonical FROM peve.counterfactual_baseline',
    );
    const formulas = await client.query<{
      formula_version: string;
      model_version: string;
      lifecycle: string;
      weights_canonical: string;
      weight_denominator: number;
      reserve_coverage_target_months: number;
      attributed_value_scale_minor_units: string;
      research_required: boolean;
      activated_at: Date | string | null;
      retired_at: Date | string | null;
    }>('SELECT * FROM peve.formula_version');
    const contributions = await client.query<{ body_canonical: string }>(
      'SELECT body_canonical FROM peve.data_contribution',
    );
    const comparisons = await client.query<{ body_canonical: string }>('SELECT body_canonical FROM peve.model_comparison');
    return {
      snapshots: Object.freeze(snapshots.rows.map((row) => JSON.parse(row.body_canonical))),
      attributions: Object.freeze(attributions.rows.map((row) => JSON.parse(row.body_canonical))),
      baselines: Object.freeze(baselines.rows.map((row) => JSON.parse(row.body_canonical))),
      formulas: Object.freeze(
        formulas.rows.map((row) => ({
          formulaVersion: row.formula_version,
          modelVersion: row.model_version,
          lifecycle: row.lifecycle,
          weights: JSON.parse(row.weights_canonical),
          weightDenominator: 10000,
          reserveCoverageTargetMonths: row.reserve_coverage_target_months,
          attributedValueScaleMinorUnits: row.attributed_value_scale_minor_units,
          debtPressureHighNumerator: 40,
          debtPressureHighDenominator: 100,
          researchRequired: true,
          ...(row.activated_at
            ? { activatedAt: row.activated_at instanceof Date ? row.activated_at.toISOString() : row.activated_at }
            : {}),
          ...(row.retired_at
            ? { retiredAt: row.retired_at instanceof Date ? row.retired_at.toISOString() : row.retired_at }
            : {}),
        })),
      ),
      contributions: Object.freeze(contributions.rows.map((row) => JSON.parse(row.body_canonical))),
      comparisons: Object.freeze(comparisons.rows.map((row) => JSON.parse(row.body_canonical))),
    } as PeveStoreSnapshot;
  });
}
