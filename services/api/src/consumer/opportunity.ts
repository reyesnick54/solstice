/**
 * Consumer BFF opportunity intelligence dispatch — read-only opportunity resources.
 */

import { omitUndefined } from './pagination.ts';
import type { OpportunityIntelligenceBff } from './opportunity-adapter.ts';

type OpportunityDispatchRequest = {
  readonly method: string;
  readonly path: string;
  readonly query?: Readonly<Record<string, string | undefined>>;
};

type OpportunityDispatchResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
};

function json(status: number, body: unknown, headers: Record<string, string>): OpportunityDispatchResponse {
  return { status, body, headers };
}

export function dispatchOpportunity(
  request: OpportunityDispatchRequest,
  requestId: string,
  headers: Record<string, string>,
  bff: OpportunityIntelligenceBff | undefined,
): OpportunityDispatchResponse | null {
  if (!bff) return null;
  const { method, path, query = {} } = request;

  if (!path.startsWith('/api/v1/opportunities') && !path.startsWith('/api/v1/world/opportunities')) {
    return null;
  }

  if (path === '/api/v1/opportunities/jobs' && method === 'GET') {
    return json(
      200,
      {
        schema: 'sunrey.bff.opportunity-jobs.v1',
        availability: 'AVAILABLE_SIMULATION',
        promise: bff.searchJobs(
          omitUndefined({
            keywords: query.keywords,
            location: query.location,
          }),
        ),
      },
      headers,
    );
  }

  if (path === '/api/v1/opportunities/skills' && method === 'GET') {
    const q = query.q ?? '';
    return json(
      200,
      {
        schema: 'sunrey.bff.opportunity-skills.v1',
        availability: 'AVAILABLE_SIMULATION',
        promise: bff.searchSkills(q),
      },
      headers,
    );
  }

  if (path === '/api/v1/opportunities/occupations' && method === 'GET') {
    const q = query.q ?? '';
    return json(
      200,
      {
        schema: 'sunrey.bff.opportunity-occupations.v1',
        availability: 'AVAILABLE_SIMULATION',
        promise: bff.searchOccupations(q),
      },
      headers,
    );
  }

  if (path === '/api/v1/opportunities/intelligence' && method === 'GET') {
    return json(
      200,
      {
        schema: 'sunrey.bff.opportunity-intelligence.v1',
        availability: 'AVAILABLE_SIMULATION',
        promise: bff.getPublicIntelligence(),
      },
      headers,
    );
  }

  if (path === '/api/v1/world/opportunities' && method === 'GET') {
    return json(
      200,
      {
        schema: 'sunrey.bff.world-opportunities.v1',
        availability: 'AVAILABLE_SIMULATION',
        promise: bff.worldSnapshot(),
      },
      headers,
    );
  }

  if (path === '/api/v1/opportunities/coverage' && method === 'GET') {
    return json(
      200,
      {
        schema: 'sunrey.bff.opportunity-coverage.v1',
        coverage: bff.coverage(),
        availability: 'AVAILABLE_SIMULATION',
      },
      headers,
    );
  }

  return json(404, { error: 'NOT_FOUND', path }, headers);
}
