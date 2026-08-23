import type { ActionCardStatus, ActionCenterView } from './taxonomy.ts';
import type { ActionCenterItem, ConversationalAction } from './types.ts';

const VIEW_STATUSES: Readonly<Record<ActionCenterView, readonly ActionCardStatus[]>> = {
  AWAITING_APPROVAL: ['PROPOSAL_CREATED', 'AWAITING_APPROVAL', 'AWAITING_STEP_UP'],
  PROCESSING: ['APPROVED', 'PROCESSING', 'SUBMITTED'],
  COMPLETED: ['COMPLETED'],
  REJECTED: ['REJECTED'],
  EXPIRED: ['EXPIRED'],
  REQUIRES_ATTENTION: ['ACTION_REQUIRED', 'REQUIRES_REVIEW', 'FAILED'],
};

export function viewForStatus(status: ActionCardStatus): ActionCenterView | null {
  for (const view of Object.keys(VIEW_STATUSES) as ActionCenterView[]) {
    if (VIEW_STATUSES[view].includes(status)) {
      return view;
    }
  }
  return null;
}

export function toActionCenterItem(action: ConversationalAction): ActionCenterItem | null {
  const view = viewForStatus(action.status);
  if (!view) {
    return null;
  }
  return Object.freeze({
    actionId: action.actionId,
    type: action.type,
    title: action.card.title,
    status: action.status,
    view,
    proposalId: action.proposal?.proposalId ?? null,
    updatedAt: action.updatedAt,
    availableActions: action.card.availableActions,
  });
}

export function listActionCenter(
  actions: readonly ConversationalAction[],
  view?: ActionCenterView,
): readonly ActionCenterItem[] {
  return Object.freeze(
    actions
      .map(toActionCenterItem)
      .filter((item): item is ActionCenterItem => item !== null)
      .filter((item) => (view ? item.view === view : true)),
  );
}
