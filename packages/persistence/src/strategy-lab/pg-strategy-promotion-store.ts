import type { Pool } from 'pg';

import type { StrategyPromotionSnapshot } from '../../../strategy-lab/src/promotion-store.ts';
import { withClient } from '../postgres/pools.ts';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

export async function persistStrategyPromotionState(pool: Pool, state: StrategyPromotionSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const policy of state.policies) {
        await client.query(
          `INSERT INTO strategy_lab.qualification_policy
             (policy_id, version, policy_hash, applicable_strategy_class, live_execution_permitted, body_canonical)
           VALUES ($1,$2,$3,$4,FALSE,$5)
           ON CONFLICT (policy_id) DO UPDATE SET body_canonical = EXCLUDED.body_canonical`,
          [
            policy.policyId,
            policy.version,
            policy.policyHash,
            policy.applicableStrategyClass,
            canonicalJson(policy),
          ],
        );
      }
      for (const promotion of state.promotions) {
        await client.query(
          `INSERT INTO strategy_lab.promotion_record
             (strategy_id, version, subject_id, capsule_id, capsule_fingerprint, promotion_state,
              policy_id, policy_version, policy_hash, expires_at, updated_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (strategy_id, version) DO UPDATE SET
             promotion_state = EXCLUDED.promotion_state,
             policy_hash = EXCLUDED.policy_hash,
             expires_at = EXCLUDED.expires_at,
             updated_at = EXCLUDED.updated_at,
             body_canonical = EXCLUDED.body_canonical`,
          [
            promotion.strategyId,
            promotion.strategyVersion,
            promotion.subjectId,
            promotion.capsuleId,
            promotion.capsuleFingerprint,
            promotion.promotionState,
            promotion.policyId,
            promotion.policyVersion,
            promotion.policyHash,
            promotion.expiresAt,
            promotion.updatedAt,
            canonicalJson(promotion),
          ],
        );
      }
      for (const qualification of state.qualifications) {
        await client.query(
          `INSERT INTO strategy_lab.evaluation_qualification
             (qualification_id, strategy_id, strategy_version, capsule_fingerprint,
              policy_id, policy_version, policy_hash, passed, generated_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (qualification_id) DO NOTHING`,
          [
            qualification.qualificationId,
            qualification.strategyId,
            qualification.strategyVersion,
            qualification.capsuleFingerprint,
            qualification.policyId,
            qualification.policyVersion,
            qualification.policyHash,
            qualification.passed,
            qualification.generatedAt,
            canonicalJson(qualification),
          ],
        );
      }
      for (const run of state.forwardShadowRuns) {
        await client.query(
          `INSERT INTO strategy_lab.forward_shadow_run
             (run_id, capsule_id, capsule_fingerprint, strategy_id, strategy_version,
              started_at, completed_at, observation_ref, sends_orders, financial_effect_created, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,FALSE,$9)
           ON CONFLICT (run_id) DO UPDATE SET
             completed_at = EXCLUDED.completed_at,
             body_canonical = EXCLUDED.body_canonical`,
          [
            run.runId,
            run.capsuleId,
            run.capsuleFingerprint,
            run.strategyId,
            run.strategyVersion,
            run.startedAt,
            run.completedAt,
            run.observationRef,
            canonicalJson(run),
          ],
        );
      }
      for (const decision of state.forwardShadowDecisions) {
        await client.query(
          `INSERT INTO strategy_lab.forward_shadow_decision
             (decision_id, run_id, capsule_fingerprint, decision_time, action_kind,
              broker_submission, immutable_after_outcome, body_canonical)
           VALUES ($1,$2,$3,$4,$5,FALSE,$6,$7)
           ON CONFLICT (decision_id) DO UPDATE SET
             immutable_after_outcome = EXCLUDED.immutable_after_outcome,
             body_canonical = EXCLUDED.body_canonical`,
          [
            decision.decisionId,
            decision.runId,
            decision.capsuleFingerprint,
            decision.decisionTime,
            decision.actionKind,
            decision.immutableAfterOutcome,
            canonicalJson(decision),
          ],
        );
      }
      for (const evidence of state.evidence) {
        await client.query(
          `INSERT INTO strategy_lab.promotion_decision
             (decision_id, kind, strategy_id, strategy_version, capsule_id, capsule_fingerprint,
              from_state, to_state, policy_id, policy_version, policy_hash, actor_id, actor_kind,
              live_eligible, decided_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,FALSE,$14,$15)
           ON CONFLICT (decision_id) DO NOTHING`,
          [
            evidence.decisionId,
            evidence.kind,
            evidence.strategyId,
            evidence.strategyVersion,
            evidence.capsuleId,
            evidence.capsuleFingerprint,
            evidence.fromState,
            evidence.toState,
            evidence.policyId,
            evidence.policyVersion,
            evidence.policyHash,
            evidence.actorId,
            evidence.actorKind,
            evidence.decidedAt,
            canonicalJson(evidence),
          ],
        );
      }
      for (const demotion of state.demotions) {
        await client.query(
          `INSERT INTO strategy_lab.demotion_record
             (decision_id, strategy_id, strategy_version, capsule_fingerprint, from_state, to_state,
              trigger_code, prior_evidence_preserved, decided_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9)
           ON CONFLICT (decision_id) DO NOTHING`,
          [
            demotion.decisionId,
            demotion.strategyId,
            demotion.strategyVersion,
            demotion.capsuleFingerprint,
            demotion.fromState,
            demotion.toState,
            demotion.trigger,
            demotion.decidedAt,
            canonicalJson(demotion),
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
