/**
 * Consumer BFF subscription intelligence dispatch.
 */

import type { SubscriptionIntelligenceBff } from './subscription-intelligence-adapter.ts';

export async function dispatchSubscriptions(
  request: { readonly method: string; readonly url: string; readonly body?: unknown },
  requestId: string,
  headers: Record<string, string>,
  bff: SubscriptionIntelligenceBff | undefined,
  principal: { readonly identityId: string } | null,
): Promise<Response | null> {
  if (!bff || !principal) {
    return null;
  }
  const url = new URL(request.url, 'http://localhost');
  const path = url.pathname;
  const method = request.method;

  if (!path.startsWith('/api/v1/subscriptions')) {
    return null;
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...headers, 'content-type': 'application/json', 'x-request-id': requestId },
    });

  const subjectId = principal.identityId;

  if (path === '/api/v1/subscriptions/obligations' && method === 'GET') {
    const snapshot = bff.getSnapshot(subjectId);
    return json({
      schema: 'sunrey.bff.subscription-obligations.v1',
      availability: 'AVAILABLE_SIMULATION',
      obligations: snapshot.obligations,
      potentialSubscriptions: snapshot.potentialSubscriptions,
    });
  }

  if (path === '/api/v1/subscriptions/price-changes' && method === 'GET') {
    const snapshot = bff.getSnapshot(subjectId);
    return json({
      schema: 'sunrey.bff.subscription-price-changes.v1',
      availability: 'AVAILABLE_SIMULATION',
      priceIncreases: snapshot.priceIncreases,
    });
  }

  if (path === '/api/v1/subscriptions/duplicates' && method === 'GET') {
    const snapshot = bff.getSnapshot(subjectId);
    return json({
      schema: 'sunrey.bff.subscription-duplicates.v1',
      availability: 'AVAILABLE_SIMULATION',
      duplicates: snapshot.duplicates,
    });
  }

  if (path === '/api/v1/subscriptions/opportunities' && method === 'GET') {
    const snapshot = bff.getSnapshot(subjectId);
    return json({
      schema: 'sunrey.bff.subscription-opportunities.v1',
      availability: 'AVAILABLE_SIMULATION',
      opportunities: snapshot.opportunities,
      savingsDisclaimer: 'Estimated savings are not verified until action confirmation',
    });
  }

  if (path === '/api/v1/subscriptions/savings' && method === 'GET') {
    const snapshot = bff.getSnapshot(subjectId);
    return json({
      schema: 'sunrey.bff.subscription-savings.v1',
      availability: 'AVAILABLE_SIMULATION',
      verifiedSavings: snapshot.verifiedSavings,
      estimatedOnly: snapshot.opportunities.map((item) => ({
        opportunityId: item.opportunityId,
        estimatedMonthlySavings: item.estimatedMonthlySavings,
        estimatedAnnualSavings: item.estimatedAnnualSavings,
        savingsKind: item.savingsKind,
      })),
    });
  }

  if (path === '/api/v1/subscriptions/actions' && method === 'GET') {
    const snapshot = bff.getSnapshot(subjectId);
    return json({
      schema: 'sunrey.bff.subscription-actions.v1',
      availability: 'AVAILABLE_SIMULATION',
      actions: snapshot.actions,
    });
  }

  if (path === '/api/v1/subscriptions/actions/propose' && method === 'POST') {
    const body = (request.body ?? {}) as {
      readonly opportunityId?: string;
      readonly idempotencyKey?: string;
      readonly actorKind?: string;
    };
    if (!body.opportunityId || !body.idempotencyKey) {
      return json({ error: 'VALIDATION', message: 'opportunityId and idempotencyKey required' }, 400);
    }
    const result = bff.proposeAction({
      subjectId,
      opportunityId: body.opportunityId,
      idempotencyKey: body.idempotencyKey,
      actorKind: body.actorKind ?? 'CUSTOMER',
    });
    if (!result.ok) {
      return json({ error: result.error.code, message: result.error.message }, 403);
    }
    return json({
      schema: 'sunrey.bff.subscription-action-proposed.v1',
      availability: 'AVAILABLE_SIMULATION',
      action: result.value,
    }, 201);
  }

  if (path.startsWith('/api/v1/subscriptions/actions/') && path.endsWith('/authorize') && method === 'POST') {
    const actionId = path.slice('/api/v1/subscriptions/actions/'.length, -'/authorize'.length);
    const body = (request.body ?? {}) as { readonly stepUpSatisfied?: boolean; readonly actorKind?: string };
    const result = bff.authorizeAction({
      subjectId,
      actionId,
      actorId: subjectId,
      actorKind: body.actorKind ?? 'CUSTOMER',
      stepUpSatisfied: body.stepUpSatisfied ?? true,
    });
    if (!result.ok) {
      return json({ error: result.error.code, message: result.error.message }, 403);
    }
    return json({
      schema: 'sunrey.bff.subscription-action-authorized.v1',
      availability: 'AVAILABLE_SIMULATION',
      action: result.value,
    });
  }

  if (path.startsWith('/api/v1/subscriptions/actions/') && method === 'GET') {
    const actionId = path.slice('/api/v1/subscriptions/actions/'.length);
    if (actionId === 'propose') {
      return null;
    }
    const snapshot = bff.getSnapshot(subjectId);
    const action = snapshot.actions.find((item) => item.actionId === actionId);
    if (!action) {
      return json({ error: 'NOT_FOUND', message: 'action not found' }, 404);
    }
    return json({
      schema: 'sunrey.bff.subscription-action.v1',
      availability: 'AVAILABLE_SIMULATION',
      action,
      capability: action.capability,
      requestSent: action.requestSent,
      actionConfirmed: action.actionConfirmed,
    });
  }

  if (path.startsWith('/api/v1/subscriptions/actions/') && path.endsWith('/execute') && method === 'POST') {
    const actionId = path.slice('/api/v1/subscriptions/actions/'.length, -'/execute'.length);
    const body = (request.body ?? {}) as { readonly merchantNormalized?: string; readonly actorKind?: string };
    const result = await bff.executeAction({
      subjectId,
      actionId,
      actorKind: body.actorKind ?? 'CUSTOMER',
      merchantNormalized: body.merchantNormalized ?? 'Unknown',
    });
    if (!result.ok) {
      return json({ error: result.error.code, message: result.error.message }, 422);
    }
    return json({
      schema: 'sunrey.bff.subscription-action-executed.v1',
      availability: 'AVAILABLE_SIMULATION',
      action: result.value.action,
      verifiedSavings: result.value.verifiedSavings,
    });
  }

  if (path === '/api/v1/subscriptions/audit' && method === 'GET') {
    return json({
      schema: 'sunrey.bff.subscription-audit.v1',
      availability: 'AVAILABLE_SIMULATION',
      events: bff.listAuditEvents(subjectId),
    });
  }

  return json({ error: 'NOT_FOUND', path }, 404);
}

export const SUBSCRIPTION_BFF_ROUTES = [
  'GET /api/v1/subscriptions/obligations',
  'GET /api/v1/subscriptions/price-changes',
  'GET /api/v1/subscriptions/duplicates',
  'GET /api/v1/subscriptions/opportunities',
  'GET /api/v1/subscriptions/savings',
  'GET /api/v1/subscriptions/actions',
  'GET /api/v1/subscriptions/actions/{id}',
  'POST /api/v1/subscriptions/actions/propose',
  'POST /api/v1/subscriptions/actions/{id}/authorize',
  'POST /api/v1/subscriptions/actions/{id}/execute',
  'GET /api/v1/subscriptions/audit',
] as const;
