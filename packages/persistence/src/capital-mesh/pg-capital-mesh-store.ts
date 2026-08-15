import type { Pool } from 'pg';

import type { MeshStoreSnapshot } from '../../../agentic-capital-mesh/src/types.ts';
import { withClient } from '../postgres/pools.ts';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

export async function persistCapitalMeshState(pool: Pool, state: MeshStoreSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const run of state.runs) {
        await client.query(
          `INSERT INTO capital_mesh.run
             (run_id, mesh_id, subject_id, state, context_id, user_objective, created_at, updated_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (run_id) DO UPDATE SET
             state = EXCLUDED.state,
             updated_at = EXCLUDED.updated_at,
             body_canonical = EXCLUDED.body_canonical`,
          [
            run.runId,
            run.meshId,
            run.subjectId,
            run.state,
            run.contextId ?? null,
            run.userObjective ?? null,
            run.createdAt,
            run.updatedAt,
            canonicalJson(run),
          ],
        );
      }
      for (const context of state.contexts) {
        await client.query(
          `INSERT INTO capital_mesh.context_ref
             (context_id, mesh_id, subject_id, generated_at, write_path, body_canonical)
           VALUES ($1,$2,$3,$4,FALSE,$5)
           ON CONFLICT (context_id) DO NOTHING`,
          [context.contextId, context.meshId, context.subjectId, context.generatedAt, canonicalJson(context)],
        );
      }
      for (const thesis of state.theses) {
        await client.query(
          `INSERT INTO capital_mesh.thesis
             (thesis_id, subject_id, objective, created_at, is_trade, guaranteed_return, body_canonical)
           VALUES ($1,$2,$3,$4,FALSE,FALSE,$5)
           ON CONFLICT (thesis_id) DO NOTHING`,
          [thesis.thesisId, thesis.subjectId, thesis.objective, thesis.createdAt, canonicalJson(thesis)],
        );
      }
      for (const candidate of state.candidates) {
        await client.query(
          `INSERT INTO capital_mesh.candidate
             (candidate_id, subject_id, scale, totals_exactly, body_canonical)
           VALUES ($1,$2,8,TRUE,$3)
           ON CONFLICT (candidate_id) DO NOTHING`,
          [candidate.candidateId, candidate.subjectId, canonicalJson(candidate)],
        );
      }
      for (const review of state.reviews) {
        await client.query(
          `INSERT INTO capital_mesh.review
             (review_id, candidate_id, body_canonical)
           VALUES ($1,$2,$3)
           ON CONFLICT (review_id) DO NOTHING`,
          [review.reviewId, review.candidateId, canonicalJson(review)],
        );
      }
      for (const arbitration of state.arbitrations) {
        await client.query(
          `INSERT INTO capital_mesh.arbitration
             (arbitration_id, outcome, agent_votes_authorize, body_canonical)
           VALUES ($1,$2,FALSE,$3)
           ON CONFLICT (arbitration_id) DO NOTHING`,
          [arbitration.arbitrationId, arbitration.outcome, canonicalJson(arbitration)],
        );
      }
      for (const proposal of state.proposals) {
        await client.query(
          `INSERT INTO capital_mesh.proposal
             (proposal_id, run_id, subject_id, strategy_validation, stale, executable, created_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,FALSE,$6,$7)
           ON CONFLICT (proposal_id) DO UPDATE SET
             stale = EXCLUDED.stale,
             body_canonical = EXCLUDED.body_canonical`,
          [
            proposal.proposalId,
            proposal.runId,
            proposal.subjectId,
            proposal.strategyValidation,
            proposal.stale,
            proposal.createdAt,
            canonicalJson(proposal),
          ],
        );
      }
      for (const output of state.nodeOutputs) {
        await client.query(
          `INSERT INTO capital_mesh.node_output
             (node_id, role, stance, summary, body_canonical)
           VALUES ($1,$2,$3,$4,$5)`,
          [output.nodeId, output.role, output.stance, output.summary, canonicalJson(output)],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
