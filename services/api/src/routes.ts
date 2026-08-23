import {
  API_VERSION,
  type RequestContext,
} from './context.ts';
import type { PlatformApiConfig } from './config.ts';
import { PlatformApiError } from './errors.ts';
import type { ReadinessReport } from './readiness.ts';
import type { RouteDefinition } from './http.ts';

export const FUTURE_NAMESPACES = [
  '/api/v1/auth',
  '/api/v1/me',
  '/api/v1/accounts',
  '/api/v1/payments',
  '/api/v1/fx',
  '/api/v1/cards',
  '/api/v1/grow',
  '/api/v1/agents',
  '/api/v1/exchange',
  '/api/v1/wallets',
  '/api/v1/assets',
  '/api/v1/hin',
  '/api/v1/data',
] as const;

export type RouteDependencies = {
  readonly config: PlatformApiConfig;
  readonly readiness: () => Promise<ReadinessReport>;
};

export function createRoutes(deps: RouteDependencies): readonly RouteDefinition[] {
  const routes: RouteDefinition[] = [
    {
      method: 'GET',
      path: '/health',
      endpointClass: 'public',
      requiresIdempotency: false,
      handler: async () => ({
        status: 200,
        body: {
          ok: true,
          service: 'sunrey-platform-api',
          environment: deps.config.environment,
          productionReady: false,
          productionActive: false,
          liveConnectivityEnabled: false,
        },
      }),
    },
    {
      method: 'GET',
      path: '/ready',
      endpointClass: 'public',
      requiresIdempotency: false,
      handler: async () => {
        const report = await deps.readiness();
        return {
          status: report.ready ? 200 : 503,
          body: report,
        };
      },
    },
    {
      method: 'GET',
      path: '/api/v1/version',
      endpointClass: 'public',
      requiresIdempotency: false,
      handler: async () => ({
        status: 200,
        body: {
          service: 'sunrey-platform-api',
          apiVersion: API_VERSION,
          basePath: deps.config.apiBasePath,
          environment: deps.config.environment,
          deploymentTier: deps.config.deploymentTier,
          CORE_CODE_COMPLETE_CANDIDATE: true,
          PRODUCTION_READY: false,
          PRODUCTION_ACTIVE: false,
          LIVE_CONNECTIVITY_ENABLED: false,
          production_authorized: false,
          namespaces: FUTURE_NAMESPACES,
        },
      }),
    },
    {
      method: 'GET',
      path: '/api/v1/me',
      endpointClass: 'sensitive',
      requiresIdempotency: false,
      handler: async ({ ctx }) => meHandler(ctx),
    },
  ];

  if (deps.config.featureFlags.testRoutes) {
    routes.push(
      {
        method: 'POST',
        path: '/api/v1/_test/validate',
        endpointClass: 'test',
        requiresIdempotency: false,
        schema: {
          body: {
            kind: 'object',
            required: ['name'],
            properties: {
              name: { kind: 'string', min: 1, max: 64 },
              count: { kind: 'integer', min: 0, max: 100 },
            },
          },
        },
        handler: async ({ body }) => ({
          status: 200,
          body: { accepted: true, echo: body },
        }),
      },
      {
        method: 'POST',
        path: '/api/v1/_test/idempotent',
        endpointClass: 'test',
        requiresIdempotency: true,
        schema: {
          body: {
            kind: 'object',
            required: ['nonce'],
            properties: {
              nonce: { kind: 'string', min: 1, max: 128 },
            },
          },
        },
        handler: async ({ body, ctx }) => ({
          status: 200,
          body: { accepted: true, nonce: (body as { nonce: string }).nonce, requestId: ctx.requestId },
        }),
      },
    );
  }

  return Object.freeze(routes);
}

function meHandler(ctx: RequestContext): never | { status: number; body: unknown } {
  if (!ctx.authorization.authenticated || ctx.userId === null || ctx.sessionId === null) {
    throw new PlatformApiError({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'authenticated session required',
      category: 'AUTHENTICATION',
      retryable: false,
      httpStatus: 401,
    });
  }
  return {
    status: 200,
    body: {
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      deviceId: ctx.deviceId,
      jurisdiction: ctx.jurisdiction,
      source: 'validated_session',
    },
  };
}
