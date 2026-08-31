/**
 * Consumer BFF opportunity intelligence dispatch — read-only opportunity resources.
 */

import type { OpportunityIntelligenceBff } from './opportunity-adapter.ts';

export function dispatchOpportunity(
  request: { readonly method: string; readonly url: string },
  requestId: string,
  headers: Record<string, string>,
  bff: OpportunityIntelligenceBff | undefined,
): Response | null {
  if (!bff) return null;
  const url = new URL(request.url, 'http://localhost');
  const path = url.pathname;
  const method = request.method;

  if (!path.startsWith('/api/v1/opportunities') && !path.startsWith('/api/v1/world/opportunities')) {
    return null;
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...headers, 'content-type': 'application/json', 'x-request-id': requestId },
    });

  if (path === '/api/v1/opportunities/jobs' && method === 'GET') {
    const keywords = url.searchParams.get('keywords') ?? undefined;
    const location = url.searchParams.get('location') ?? undefined;
    return json({
      schema: 'sunrey.bff.opportunity-jobs.v1',
      availability: 'AVAILABLE_SIMULATION',
      promise: bff.searchJobs({ keywords, location }),
    });
  }

  if (path === '/api/v1/opportunities/skills' && method === 'GET') {
    const query = url.searchParams.get('q') ?? '';
    return json({
      schema: 'sunrey.bff.opportunity-skills.v1',
      availability: 'AVAILABLE_SIMULATION',
      promise: bff.searchSkills(query),
    });
  }

  if (path === '/api/v1/opportunities/occupations' && method === 'GET') {
    const query = url.searchParams.get('q') ?? '';
    return json({
      schema: 'sunrey.bff.opportunity-occupations.v1',
      availability: 'AVAILABLE_SIMULATION',
      promise: bff.searchOccupations(query),
    });
  }

  if (path === '/api/v1/opportunities/intelligence' && method === 'GET') {
    return json({
      schema: 'sunrey.bff.opportunity-intelligence.v1',
      availability: 'AVAILABLE_SIMULATION',
      promise: bff.getPublicIntelligence(),
    });
  }

  if (path === '/api/v1/world/opportunities' && method === 'GET') {
    return json({
      schema: 'sunrey.bff.world-opportunities.v1',
      availability: 'AVAILABLE_SIMULATION',
      promise: bff.worldSnapshot(),
    });
  }

  if (path === '/api/v1/opportunities/coverage' && method === 'GET') {
    return json({
      schema: 'sunrey.bff.opportunity-coverage.v1',
      coverage: bff.coverage(),
      availability: 'AVAILABLE_SIMULATION',
    });
  }

  return json({ error: 'NOT_FOUND', path }, 404);
}
