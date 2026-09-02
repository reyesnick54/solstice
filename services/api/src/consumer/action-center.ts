/**
 * Unified Action Center — backend-driven product component.
 * Aggregates Kernel approvals, agent action cards, and access events.
 * Frontend must not invent action transitions.
 */

import type { ActionStatusResource } from './action-status.ts';
import { mapInternalActionStatus } from './action-status.ts';
import type { BffPrincipal } from './ports.ts';
import type { AgentConversationSurface } from './conversation.ts';
import type { HumanAccessEconomyProduct } from '../../../../packages/human-access-economy/src/service.ts';
import type { AgentExternalEvidenceBff } from './agent-evidence-adapter.ts';

export const ACTION_CENTER_ITEM_STATUSES = [
  'ACTION_REQUIRED',
  'IN_REVIEW',
  'COMPLETED',
  'DISMISSED',
  'EXPIRED',
] as const;
export type ActionCenterItemStatus = (typeof ACTION_CENTER_ITEM_STATUSES)[number];

export const ACTION_CENTER_SOURCES = [
  'KERNEL_APPROVAL',
  'AGENT_ACTION',
  'ACCESS_EVENT',
  'SECURITY',
  'VAULT',
  'GROW',
] as const;
export type ActionCenterSource = (typeof ACTION_CENTER_SOURCES)[number];

export type ActionCenterItem = {
  readonly actionId: string;
  readonly source: ActionCenterSource;
  readonly status: ActionCenterItemStatus;
  readonly title: string;
  readonly detail: string;
  readonly regulated: boolean;
  readonly deepLink: string;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly dismissible: boolean;
  readonly availableControls: readonly string[];
};

export type ActionCenterResource = {
  readonly schema: 'sunrey.consumer.action-center.unified.v1';
  readonly generatedAt: string;
  readonly productionMoneyMovement: false;
  readonly summary: {
    readonly actionRequired: number;
    readonly inReview: number;
    readonly completed: number;
    readonly dismissed: number;
    readonly expired: number;
    readonly total: number;
  };
  readonly items: readonly ActionCenterItem[];
};

const dismissedIds = new Set<string>();

function mapKernelStatus(status: string): ActionCenterItemStatus {
  switch (status) {
    case 'ACTION_REQUIRED':
      return 'ACTION_REQUIRED';
    case 'AWAITING_APPROVAL':
    case 'PENDING':
    case 'PROCESSING':
      return 'IN_REVIEW';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'CANCELLED':
      return 'DISMISSED';
    case 'FAILED':
      return 'EXPIRED';
    default:
      return 'IN_REVIEW';
  }
}

function mapAgentCardStatus(status: string): ActionCenterItemStatus {
  switch (status) {
    case 'ACTION_REQUIRED':
    case 'AWAITING_STEP_UP':
      return 'ACTION_REQUIRED';
    case 'AWAITING_APPROVAL':
    case 'PROPOSAL_CREATED':
    case 'COLLECTING':
    case 'REQUIRES_REVIEW':
    case 'PROCESSING':
    case 'SUBMITTED':
    case 'APPROVED':
      return 'IN_REVIEW';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'CANCELLED':
    case 'REJECTED':
    case 'SUPERSEDED':
      return 'DISMISSED';
    case 'EXPIRED':
    case 'FAILED':
      return 'EXPIRED';
    default:
      return 'IN_REVIEW';
  }
}

function fromKernelApproval(row: ActionStatusResource): ActionCenterItem {
  const mapped = mapInternalActionStatus(row.status);
  return Object.freeze({
    actionId: row.actionId,
    source: 'KERNEL_APPROVAL',
    status: mapKernelStatus(mapped.status),
    title: row.title,
    detail: row.detail,
    regulated: row.regulated,
    deepLink: `/money/approvals/${encodeURIComponent(row.actionId)}`,
    createdAt: row.createdAt,
    expiresAt: null,
    dismissible: false,
    availableControls: Object.freeze(['APPROVE', 'REJECT']),
  });
}

function fromAgentAction(action: {
  readonly actionId: string;
  readonly status: string;
  readonly card?: { readonly title?: string; readonly summary?: string };
  readonly createdAt?: string;
}): ActionCenterItem {
  return Object.freeze({
    actionId: action.actionId,
    source: 'AGENT_ACTION',
    status: mapAgentCardStatus(action.status),
    title: action.card?.title ?? 'Agent action',
    detail: action.card?.summary ?? 'Review agent proposal before any execution.',
    regulated: true,
    deepLink: `/agent/actions/${encodeURIComponent(action.actionId)}`,
    createdAt: action.createdAt ?? new Date(0).toISOString(),
    expiresAt: null,
    dismissible: true,
    availableControls: Object.freeze(['APPROVE', 'MODIFY', 'REJECT', 'CANCEL']),
  });
}

function fromAccessEvent(event: {
  readonly resourceId: string;
  readonly summary: string;
  readonly priority?: string;
  readonly occurredAt: string;
}): ActionCenterItem {
  const needsAction = event.priority === 'ACTION_REQUIRED' || event.priority === 'HIGH';
  return Object.freeze({
    actionId: event.resourceId,
    source: 'ACCESS_EVENT',
    status: needsAction ? 'ACTION_REQUIRED' : 'IN_REVIEW',
    title: event.summary,
    detail: event.summary,
    regulated: false,
    deepLink: `/access/events/${encodeURIComponent(event.eventId)}`,
    createdAt: event.occurredAt,
    expiresAt: null,
    dismissible: true,
    availableControls: Object.freeze(needsAction ? ['VIEW', 'DISMISS'] : ['VIEW']),
  });
}

export type ActionCenterDeps = {
  readonly now: () => string;
  readonly kernelActions: (principal: BffPrincipal) => readonly ActionStatusResource[];
  readonly conversation?: AgentConversationSurface;
  readonly access?: HumanAccessEconomyProduct;
  readonly agentEvidence?: AgentExternalEvidenceBff;
};

export function buildActionCenter(deps: ActionCenterDeps, principal: BffPrincipal): ActionCenterResource {
  const items: ActionCenterItem[] = [];

  for (const row of deps.kernelActions(principal)) {
    if (!dismissedIds.has(row.actionId)) {
      items.push(fromKernelApproval(row));
    }
  }

  if (deps.conversation) {
    const agentList = deps.conversation.listActions(principal, undefined, 'action_center');
    if ('items' in agentList && Array.isArray(agentList.items)) {
      for (const action of agentList.items as Array<{
        actionId: string;
        status: string;
        card?: { title?: string; summary?: string };
        createdAt?: string;
      }>) {
        if (!dismissedIds.has(action.actionId)) {
          items.push(fromAgentAction(action));
        }
      }
    }
  }

  if (deps.access) {
    const events = deps.access.actionCenterEvents(principal.customerId);
    for (const event of events) {
      if (!dismissedIds.has(event.resourceId)) {
        items.push(fromAccessEvent(event));
      }
    }
  }

  if (deps.agentEvidence) {
    for (const event of deps.agentEvidence.externalEvents()) {
      const id = event.resourceId;
      if (!dismissedIds.has(id)) {
        items.push(
          Object.freeze({
            actionId: id,
            source: 'SECURITY' as const,
            status: 'IN_REVIEW',
            title: event.type,
            detail: event.summary,
            regulated: false,
            deepLink: `/action-center/external/${encodeURIComponent(id)}`,
            createdAt: event.occurredAt ?? deps.now(),
            expiresAt: null,
            dismissible: true,
            availableControls: Object.freeze(['VIEW', 'DISMISS']),
          }),
        );
      }
    }
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const summary = {
    actionRequired: items.filter((i) => i.status === 'ACTION_REQUIRED').length,
    inReview: items.filter((i) => i.status === 'IN_REVIEW').length,
    completed: items.filter((i) => i.status === 'COMPLETED').length,
    dismissed: items.filter((i) => i.status === 'DISMISSED').length,
    expired: items.filter((i) => i.status === 'EXPIRED').length,
    total: items.length,
  };

  return Object.freeze({
    schema: 'sunrey.consumer.action-center.unified.v1',
    generatedAt: deps.now(),
    productionMoneyMovement: false,
    summary: Object.freeze(summary),
    items: Object.freeze(items),
  });
}

export function dismissActionCenterItem(actionId: string): { readonly dismissed: true; readonly actionId: string } {
  dismissedIds.add(actionId);
  return Object.freeze({ dismissed: true, actionId });
}

export function actionCenterSummaryFrom(resource: ActionCenterResource) {
  return Object.freeze({
    actionRequired: resource.summary.actionRequired,
    inReview: resource.summary.inReview,
    totalOpen: resource.summary.actionRequired + resource.summary.inReview,
    hasItems: resource.summary.total > 0,
  });
}
