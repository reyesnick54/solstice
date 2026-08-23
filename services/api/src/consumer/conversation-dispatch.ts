/**
 * Isolated conversation dispatcher so Lovable Agent routes can be tested
 * without loading smash-merged Grow BFF modules.
 */

import type { BffPrincipal } from './ports.ts';
import { AgentConversationSurface } from './conversation.ts';
import { isBffError } from './errors.ts';
import { statusForError } from './errors.ts';

export type ConversationHttpRequest = {
  readonly method: string;
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
  readonly body: unknown;
};

export type ConversationHttpResponse = {
  readonly status: number;
  readonly body: unknown;
};

export function dispatchConversationSurface(
  surface: AgentConversationSurface,
  principal: BffPrincipal,
  request: ConversationHttpRequest,
  requestId: string,
): ConversationHttpResponse {
  const rec = request.body && typeof request.body === 'object' && !Array.isArray(request.body)
    ? (request.body as Record<string, unknown>)
    : {};
  const { method, path, query } = request;
  const send = (value: unknown, okStatus = 200): ConversationHttpResponse => {
    if (isBffError(value)) {
      return { status: statusForError(value), body: value };
    }
    return { status: okStatus, body: value };
  };
  if (path === '/api/v1/agent/conversations' && method === 'POST') {
    return send(surface.start(principal, requestId), 201);
  }
  if (path.startsWith('/api/v1/agent/conversations/') && path.endsWith('/messages') && method === 'POST') {
    const id = path.slice('/api/v1/agent/conversations/'.length, -'/messages'.length);
    return send(surface.message(principal, id, typeof rec.text === 'string' ? rec.text : '', requestId));
  }
  if (path.startsWith('/api/v1/agent/conversations/') && path.endsWith('/events') && method === 'GET') {
    const id = path.slice('/api/v1/agent/conversations/'.length, -'/events'.length);
    const after = Number(query.after ?? '0');
    return send(surface.stream(principal, id, Number.isFinite(after) ? after : 0, requestId));
  }
  if (path.startsWith('/api/v1/agent/conversations/') && method === 'GET') {
    return send(surface.getConversation(principal, path.slice('/api/v1/agent/conversations/'.length), requestId));
  }
  if (path === '/api/v1/agent/actions' && method === 'GET') {
    return send(surface.listActions(principal, query.view, requestId));
  }
  if (path.startsWith('/api/v1/agent/actions/') && path.endsWith('/approve') && method === 'POST') {
    return send(surface.approve(principal, path.slice('/api/v1/agent/actions/'.length, -'/approve'.length), rec, requestId));
  }
  if (path.startsWith('/api/v1/agent/actions/') && path.endsWith('/modify') && method === 'POST') {
    return send(surface.modify(principal, path.slice('/api/v1/agent/actions/'.length, -'/modify'.length), rec, requestId));
  }
  if (path.startsWith('/api/v1/agent/actions/') && path.endsWith('/reject') && method === 'POST') {
    return send(surface.reject(principal, path.slice('/api/v1/agent/actions/'.length, -'/reject'.length), requestId));
  }
  if (path.startsWith('/api/v1/agent/actions/') && path.endsWith('/cancel') && method === 'POST') {
    return send(surface.cancel(principal, path.slice('/api/v1/agent/actions/'.length, -'/cancel'.length), requestId));
  }
  if (path.startsWith('/api/v1/agent/actions/') && method === 'GET') {
    return send(surface.getAction(principal, path.slice('/api/v1/agent/actions/'.length), requestId));
  }
  return { status: 404, body: { errorCode: 'NOT_FOUND' } };
}
