// @ts-nocheck
/**
 * Wave 8 — unified Action Center.
 * Driven by durable backend state; frontend notifications are not source of truth.
 */

import type { ConsumerBff } from './orchestrator.ts';
import type { AgentConversationSurface } from './conversation.ts';
import type { BffPrincipal } from './ports.ts';
import { isBffError } from './errors.ts';
import { ACTION_CENTER_VIEWS } from '../../../../packages/sunrey-agent/src/conversation/taxonomy.ts';

export const ACTION_CENTER_ITEM_KINDS = [
  'VERIFY_IDENTITY',
  'REVIEW_CONSENT',
  'APPROVE_AGENT_MANDATE',
  'RESOLVE_CLAIM_ISSUE',
  'COMPLETE_WALLET_ACTION',
  'REVIEW_TRANSACTION',
  'PROVIDER_WARNING',
  'GOVERNANCE_ACTION',
  'PAYMENT_APPROVAL',
  'EXCHANGE_PROPOSAL',
  'GROW_PROPOSAL',
  'ACCESS_BOOKING',
] as const;
export type ActionCenterItemKind = (typeof ACTION_CENTER_ITEM_KINDS)[number];

export type ActionCenterItem = {
  readonly actionId: string;
  readonly kind: ActionCenterItemKind | string;
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly view: string;
  readonly priority: number;
  readonly createdAt: string;
  readonly durableSource: string;
  readonly availableActions: readonly string[];
  readonly productionMoneyMovement: false;
};

export type ActionCenterListResponse = {
  readonly schema: 'sunrey.consumer.action-center.unified.v1';
  readonly requestId: string;
  readonly view: string;
  readonly items: readonly ActionCenterItem[];
  readonly totalCount: number;
  readonly productionMoneyMovement: false;
  readonly frontendIsNotSourceOfTruth: true;
};

export type ActionCenterSources = {
  readonly bff: ConsumerBff;
  readonly conversation?: AgentConversationSurface;
  readonly accessEvents?: (customerId: string) => readonly {
    readonly type: string;
    readonly occurredAt: string;
    readonly providerId: string | null;
    readonly resourceId: string;
    readonly summary: string;
    readonly evidenceRef: string | null;
    readonly autoNotify: false;
  }[];
  readonly externalEvents?: () => readonly {
    readonly type: string;
    readonly occurredAt: string;
    readonly providerId: string | null;
    readonly resourceId: string;
    readonly summary: string;
    readonly evidenceRef: string | null;
    readonly autoNotify: false;
  }[];
};

function mapHomeApproval(item: {
  readonly actionId: string;
  readonly kind: string;
  readonly status: string;
  readonly title: string;
  readonly detail: string;
  readonly createdAt: string;
}): ActionCenterItem {
  return Object.freeze({
    actionId: item.actionId,
    kind: item.kind,
    title: item.title,
    summary: item.detail,
    status: item.status,
    view: viewForStatus(item.status),
    priority: item.status === 'ACTION_REQUIRED' ? 10 : 50,
    createdAt: item.createdAt,
    durableSource: 'services/accounts.pendingApprovals',
    availableActions: Object.freeze(['APPROVE', 'REJECT', 'VIEW_DETAIL']),
    productionMoneyMovement: false,
  });
}

function viewForStatus(status: string): string {
  switch (status) {
    case 'AWAITING_APPROVAL':
    case 'ACTION_REQUIRED':
      return 'AWAITING_APPROVAL';
    case 'PROCESSING':
    case 'PENDING':
      return 'PROCESSING';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'FAILED':
      return 'REJECTED';
    case 'CANCELLED':
      return 'EXPIRED';
    default:
      return 'REQUIRES_ATTENTION';
  }
}

function matchesView(item: ActionCenterItem, view: string | undefined): boolean {
  if (!view || view === 'ALL') return true;
  return item.view === view;
}

export function listUnifiedActions(
  sources: ActionCenterSources,
  principal: BffPrincipal,
  requestId: string,
  view?: string,
): ActionCenterListResponse {
  const items: ActionCenterItem[] = [];

  const home = sources.bff.home(principal, requestId);
  if (!isBffError(home) && Array.isArray(home.pendingApprovals)) {
    for (const row of home.pendingApprovals as {
      actionId: string;
      kind: string;
      status: string;
      title: string;
      detail: string;
      createdAt: string;
    }[]) {
      const mapped = mapHomeApproval(row);
      if (matchesView(mapped, view)) items.push(mapped);
    }
  }

  if (sources.conversation) {
    const agentList = sources.conversation.listActions(principal, view, requestId);
    if (!isBffError(agentList) && Array.isArray((agentList as { items?: unknown[] }).items)) {
      for (const row of (agentList as { items: { actionId: string; type: string; title: string; status: string; view: string; availableActions: string[] }[] }).items) {
        const mapped: ActionCenterItem = Object.freeze({
          actionId: row.actionId,
          kind: row.type,
          title: row.title,
          summary: row.title,
          status: row.status,
          view: row.view,
          priority: 30,
          createdAt: new Date().toISOString(),
          durableSource: 'packages/sunrey-agent.actionCenter',
          availableActions: Object.freeze([...row.availableActions]),
          productionMoneyMovement: false,
        });
        if (matchesView(mapped, view)) items.push(mapped);
      }
    }
  }

  const accessEvents = sources.accessEvents?.(principal.customerId) ?? [];
  for (const event of accessEvents) {
    const mapped: ActionCenterItem = Object.freeze({
      actionId: `access:${event.resourceId}:${event.occurredAt}`,
      kind: 'ACCESS_BOOKING',
      title: event.type,
      summary: event.summary,
      status: 'ACTION_REQUIRED',
      view: 'REQUIRES_ATTENTION',
      priority: 20,
      createdAt: event.occurredAt,
      durableSource: 'packages/human-access-economy.actionCenter',
      availableActions: Object.freeze(['VIEW_DETAIL']),
      productionMoneyMovement: false,
    });
    if (matchesView(mapped, view)) items.push(mapped);
  }

  const external = sources.externalEvents?.() ?? [];
  for (const event of external) {
    const mapped: ActionCenterItem = Object.freeze({
      actionId: `external:${event.resourceId}:${event.occurredAt}`,
      kind: 'PROVIDER_WARNING',
      title: event.type,
      summary: event.summary,
      status: 'ACTION_REQUIRED',
      view: 'REQUIRES_ATTENTION',
      priority: 40,
      createdAt: event.occurredAt,
      durableSource: 'packages/external-data.actionCenterBridge',
      availableActions: Object.freeze(['VIEW_DETAIL', 'DISMISS']),
      productionMoneyMovement: false,
    });
    if (matchesView(mapped, view)) items.push(mapped);
  }

  items.sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));

  const resolvedView = view && (ACTION_CENTER_VIEWS as readonly string[]).includes(view) ? view : 'ALL';

  return Object.freeze({
    schema: 'sunrey.consumer.action-center.unified.v1',
    requestId,
    view: resolvedView,
    items: Object.freeze(items),
    totalCount: items.length,
    productionMoneyMovement: false,
    frontendIsNotSourceOfTruth: true,
  });
}
