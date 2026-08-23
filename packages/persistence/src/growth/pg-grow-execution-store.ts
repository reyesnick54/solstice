import type { Pool } from 'pg';

import type { GrowStoreSnapshot } from '../../../platform/src/grow/store.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistGrowExecutionState(pool: Pool, state: GrowStoreSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const proposal of state.proposals) {
        await client.query(
          `INSERT INTO growth.financial_proposal
             (proposal_id, version, subject_id, customer_id, plan_id, state, proposal_type,
              content_hash, expires_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (proposal_id, version) DO UPDATE SET
             state = EXCLUDED.state,
             body_canonical = EXCLUDED.body_canonical`,
          [
            proposal.proposalId,
            proposal.version,
            proposal.subjectId,
            proposal.customerId,
            proposal.planId,
            proposal.state,
            proposal.proposalType,
            proposal.contentHash,
            proposal.expiresAt,
            JSON.stringify(proposal),
          ],
        );
      }
      for (const approval of state.approvals) {
        await client.query(
          `INSERT INTO growth.proposal_approval
             (approval_id, proposal_id, proposal_version, actor_id, actor_kind, approved_at,
              authentication_assurance, step_up_satisfied, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (approval_id) DO NOTHING`,
          [
            approval.approvalId,
            approval.proposalId,
            approval.proposalVersion,
            approval.actorId,
            approval.actorKind,
            approval.approvedAt,
            approval.authenticationAssurance,
            approval.stepUpSatisfied,
            JSON.stringify(approval),
          ],
        );
      }
      for (const command of state.commands) {
        await client.query(
          `INSERT INTO growth.execution_command
             (command_id, proposal_id, proposal_version, customer_id, idempotency_key,
              expires_at, domain, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (command_id) DO NOTHING`,
          [
            command.commandId,
            command.proposalId,
            command.proposalVersion,
            command.customerId,
            command.idempotencyKey,
            command.expiresAt,
            command.domain,
            JSON.stringify(command),
          ],
        );
      }
      for (const execution of state.executions) {
        await client.query(
          `INSERT INTO growth.execution_record
             (execution_id, command_id, proposal_id, customer_id, state, filled_minor_units,
              requested_minor_units, authority_id, ledger_journal_id, provider_id,
              body_canonical, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (execution_id) DO UPDATE SET
             state = EXCLUDED.state,
             filled_minor_units = EXCLUDED.filled_minor_units,
             body_canonical = EXCLUDED.body_canonical,
             updated_at = EXCLUDED.updated_at`,
          [
            execution.executionId,
            execution.commandId,
            execution.proposalId,
            execution.customerId,
            execution.state,
            execution.filledMinorUnits,
            execution.requestedMinorUnits,
            execution.authorityId,
            execution.ledgerJournalId,
            execution.providerId,
            JSON.stringify(execution),
            execution.createdAt,
            execution.updatedAt,
          ],
        );
      }
      for (const mandate of state.recurring) {
        await client.query(
          `INSERT INTO growth.recurring_mandate
             (recurring_mandate_id, subject_id, customer_id, amount_minor_units, currency,
              frequency, state, max_amount_minor_units, agent_may_increase_amount,
              perpetual_authorization, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,FALSE,$9)
           ON CONFLICT (recurring_mandate_id) DO UPDATE SET
             state = EXCLUDED.state,
             body_canonical = EXCLUDED.body_canonical`,
          [
            mandate.recurringMandateId,
            mandate.subjectId,
            mandate.customerId,
            mandate.amount.minorUnits,
            mandate.amount.currency,
            mandate.frequency,
            mandate.state,
            mandate.maxAmountMinorUnits,
            JSON.stringify(mandate),
          ],
        );
      }
      for (const plan of state.activatedPlans) {
        await client.query(
          `INSERT INTO growth.activated_plan
             (activated_plan_id, plan_id, plan_version, subject_id, customer_id, lifecycle,
              body_canonical, activated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (activated_plan_id) DO UPDATE SET
             lifecycle = EXCLUDED.lifecycle,
             body_canonical = EXCLUDED.body_canonical`,
          [
            plan.activatedPlanId,
            plan.planId,
            plan.planVersion,
            plan.subjectId,
            plan.customerId,
            plan.lifecycle,
            JSON.stringify(plan),
            plan.activatedAt,
          ],
        );
      }
      for (const cycle of state.monitoring) {
        await client.query(
          `INSERT INTO growth.monitoring_cycle
             (cycle_id, subject_id, generated_at, silent_investment_change, body_canonical)
           VALUES ($1,$2,$3,FALSE,$4)
           ON CONFLICT (cycle_id) DO NOTHING`,
          [cycle.cycleId, cycle.subjectId, cycle.generatedAt, JSON.stringify(cycle)],
        );
      }
      for (const model of state.performance) {
        await client.query(
          `INSERT INTO growth.performance_read_model
             (subject_id, plan_id, deposits_are_not_performance, body_canonical)
           VALUES ($1,$2,TRUE,$3)
           ON CONFLICT (subject_id, plan_id) DO UPDATE SET body_canonical = EXCLUDED.body_canonical`,
          [model.subjectId, model.planId, JSON.stringify(model)],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
