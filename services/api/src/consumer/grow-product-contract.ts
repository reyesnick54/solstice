/**
 * HELIOS Multi-Asset M26 — production-shaped Grow product contract BFF.
 * Server-owned financial truth for mobile/web consumption.
 */

import {
  buildGrowProductActivityEvents,
  buildGrowProductPerformance,
  buildGrowProductPositionsResponse,
  buildGrowProductStrategies,
  buildGrowProductSummary,
  buildPaperDisclosureContract,
  parseGrowPerformancePeriod,
  type GrowProductContractContext,
} from '@solstice/platform';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import { paginate, pageSizeOf } from './pagination.ts';
import type { BffPrincipal } from './ports.ts';
import {
  buildGrowOutcomeAttribution,
  buildReadModelInput,
  type GrowPaperCycleDeps,
} from './grow-paper-cycle.ts';

export type GrowProductContractBffOptions = {
  readonly deploymentPaused?: boolean;
  readonly pauseUpdatedAt?: string | null;
};

function buildContext(
  deps: GrowPaperCycleDeps,
  principal: BffPrincipal,
  options: GrowProductContractBffOptions = {},
): GrowProductContractContext {
  const readModel = buildReadModelInput(deps, principal);
  const attribution = buildGrowOutcomeAttribution(
    deps,
    principal.customerId,
    readModel.workOrder?.workOrderId ?? null,
  );
  return Object.freeze({
    readModel,
    attribution,
    deploymentPaused: options.deploymentPaused ?? false,
  });
}

function heliosUnavailable(requestId: string): BffErrorEnvelope {
  return bffError({
    errorCode: 'CAPABILITY_DISABLED',
    category: 'TEMPORARY_UNAVAILABLE',
    message: 'Grow HELIOS product contract requires durable Grow execution lifecycle binding',
    retryable: false,
    requestId,
    detailsSafeForClient: { growCode: 'HELIOS_BINDING_REQUIRED' },
  });
}

export function growProductSummary(
  deps: GrowPaperCycleDeps | null,
  principal: BffPrincipal,
  requestId: string,
  options: GrowProductContractBffOptions = {},
): Record<string, unknown> | BffErrorEnvelope {
  if (!deps) {
    return heliosUnavailable(requestId);
  }
  return buildGrowProductSummary(buildContext(deps, principal, options)) as Record<string, unknown>;
}

export function growProductPositions(
  deps: GrowPaperCycleDeps | null,
  principal: BffPrincipal,
  requestId: string,
  query: Readonly<Record<string, string>> = {},
  options: GrowProductContractBffOptions = {},
): Record<string, unknown> | BffErrorEnvelope {
  if (!deps) {
    return heliosUnavailable(requestId);
  }
  const response = buildGrowProductPositionsResponse(buildContext(deps, principal, options));
  const page = paginate(
    [...response.items],
    `grow-positions:${principal.customerId}`,
    query.cursor,
    pageSizeOf(query.pageSize),
  );
  if ('error' in page) {
    return bffError({
      errorCode: 'INVALID_PAGINATION_CURSOR',
      category: 'VALIDATION',
      message: 'invalid positions pagination cursor',
      retryable: false,
      requestId,
    });
  }
  return Object.freeze({
    ...response,
    items: page.items,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  }) as Record<string, unknown>;
}

export function growProductEvents(
  deps: GrowPaperCycleDeps | null,
  principal: BffPrincipal,
  requestId: string,
  query: Readonly<Record<string, string>> = {},
  options: GrowProductContractBffOptions = {},
): Record<string, unknown> | BffErrorEnvelope {
  if (!deps) {
    return heliosUnavailable(requestId);
  }
  const context = buildContext(deps, principal, options);
  const summary = buildGrowProductSummary(context);
  const items = buildGrowProductActivityEvents({
    readModel: context.readModel,
    cycleStatus: summary.cycleStatus,
    attribution: context.attribution,
    deploymentPaused: context.deploymentPaused ?? false,
    pauseUpdatedAt: options.pauseUpdatedAt ?? null,
  });
  const page = paginate(items, `grow-events:${principal.customerId}`, query.cursor, pageSizeOf(query.pageSize));
  if ('error' in page) {
    return bffError({
      errorCode: 'INVALID_PAGINATION_CURSOR',
      category: 'VALIDATION',
      message: 'invalid activity pagination cursor',
      retryable: false,
      requestId,
    });
  }
  return Object.freeze({
    schema: 'sunrey.consumer.grow.events.v1',
    customerId: principal.customerId,
    items: page.items,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    disclosure: buildPaperDisclosureContract(),
    frontendMathAuthoritative: false,
    serverOwned: true,
  });
}

export function growProductStrategies(
  deps: GrowPaperCycleDeps | null,
  principal: BffPrincipal,
  requestId: string,
  options: GrowProductContractBffOptions = {},
): Record<string, unknown> | BffErrorEnvelope {
  if (!deps) {
    return heliosUnavailable(requestId);
  }
  return buildGrowProductStrategies(buildContext(deps, principal, options)) as Record<string, unknown>;
}

export function growProductPerformance(
  deps: GrowPaperCycleDeps | null,
  principal: BffPrincipal,
  requestId: string,
  query: Readonly<Record<string, string>> = {},
  options: GrowProductContractBffOptions = {},
): Record<string, unknown> | BffErrorEnvelope {
  if (!deps) {
    return heliosUnavailable(requestId);
  }
  const period = parseGrowPerformancePeriod(query.period);
  if (query.period && !period) {
    return bffError({
      errorCode: 'VALIDATION',
      category: 'VALIDATION',
      message: 'period must be daily, weekly, monthly, or since_inception',
      retryable: false,
      requestId,
    });
  }
  return buildGrowProductPerformance(buildContext(deps, principal, options), period ?? 'since_inception') as Record<
    string,
    unknown
  >;
}
