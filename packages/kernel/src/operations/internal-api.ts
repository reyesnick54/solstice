/**
 * Internal operations HTTP contract. Served only from services/api
 * `/internal/v1`. Not a Lovable / consumer BFF surface.
 */
export const INTERNAL_API_BASE = '/internal/v1' as const;

export const INTERNAL_API_ROUTES = [
  'GET /internal/v1/health',
  'GET /internal/v1/me',
  'GET /internal/v1/cases',
  'POST /internal/v1/cases',
  'GET /internal/v1/cases/:caseId',
  'POST /internal/v1/cases/:caseId/assign',
  'POST /internal/v1/cases/:caseId/transition',
  'POST /internal/v1/cases/:caseId/notes',
  'POST /internal/v1/cases/:caseId/resolve',
  'GET /internal/v1/search',
  'GET /internal/v1/timeline/:ref',
  'GET /internal/v1/payments',
  'GET /internal/v1/treasury',
  'GET /internal/v1/reconciliation',
  'GET /internal/v1/surveillance',
  'GET /internal/v1/custody',
  'GET /internal/v1/providers',
  'GET /internal/v1/agents',
  'GET /internal/v1/security',
  'POST /internal/v1/actions',
  'POST /internal/v1/support/view',
] as const;

export const INTERNAL_API_POSTURE = Object.freeze({
  surface: 'INTERNAL_OPERATIONS',
  consumerBff: false,
  lovableExposed: false,
  productionReady: false,
  productionActive: false,
  liveConnectivityEnabled: false,
});
