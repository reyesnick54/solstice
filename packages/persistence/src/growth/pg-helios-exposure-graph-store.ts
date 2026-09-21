import type { Pool } from 'pg';

import type { PortfolioExposureGraphSnapshot } from '@solstice/platform';
import { persistenceJsonStringify } from '../json.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistHeliosPortfolioExposureGraphState(
  pool: Pool,
  state: PortfolioExposureGraphSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const graph of state.graphs) {
        await client.query(
          `INSERT INTO growth.helios_portfolio_exposure_graph
             (graph_id, portfolio_id, as_of, body_canonical, created_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (graph_id) DO UPDATE SET
             body_canonical = EXCLUDED.body_canonical,
             as_of = EXCLUDED.as_of`,
          [graph.graphId, graph.portfolioId, graph.asOf, persistenceJsonStringify(graph), graph.asOf],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function loadHeliosPortfolioExposureGraphState(
  pool: Pool,
): Promise<PortfolioExposureGraphSnapshot> {
  return withClient(pool, async (client) => {
    const result = await client.query(
      `SELECT body_canonical FROM growth.helios_portfolio_exposure_graph ORDER BY as_of ASC`,
    );
    return Object.freeze({
      graphs: Object.freeze(result.rows.map((row) => JSON.parse(String(row.body_canonical)))),
    });
  });
}
