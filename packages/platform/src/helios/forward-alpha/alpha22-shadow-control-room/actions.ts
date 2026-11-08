import {
  ALPHA22_FORBIDDEN_OPERATOR_EFFECTS,
  ALPHA22_OPERATOR_ACTIONS,
  type Alpha22OperatorAction,
} from './taxonomy.ts';
import type { Alpha22OperatorActionRequest, Alpha22OperatorActionResult } from './types.ts';

export function listAlpha22OperatorActions(): readonly Alpha22OperatorAction[] {
  return ALPHA22_OPERATOR_ACTIONS;
}

export function forbiddenOperatorEffects(): readonly (typeof ALPHA22_FORBIDDEN_OPERATOR_EFFECTS)[number][] {
  return ALPHA22_FORBIDDEN_OPERATOR_EFFECTS;
}

/**
 * Apply shadow-lab operator intent. Never activates live financial execution.
 */
export function applyAlpha22OperatorAction(request: Alpha22OperatorActionRequest): Alpha22OperatorActionResult {
  switch (request.action) {
    case 'PAUSE_CAMPAIGN':
      if (!request.campaignId) {
        return refuse(request.action, 'campaignId required');
      }
      return applied(request.action, `campaign ${request.campaignId} paused (simulation)`);
    case 'RESUME_CAMPAIGN':
      if (!request.campaignId) {
        return refuse(request.action, 'campaignId required');
      }
      return applied(request.action, `campaign ${request.campaignId} resumed (simulation)`);
    case 'TERMINATE_CAMPAIGN':
      if (!request.campaignId) {
        return refuse(request.action, 'campaignId required');
      }
      return applied(request.action, `campaign ${request.campaignId} terminated (simulation)`);
    case 'PAUSE_STRATEGY':
      if (!request.strategyId) {
        return refuse(request.action, 'strategyId required');
      }
      return applied(request.action, `strategy ${request.strategyId} paused (simulation)`);
    case 'FORCE_RECONCILIATION':
      return applied(request.action, 'shadow paper book reconciliation scheduled (simulation)');
    case 'ACKNOWLEDGE_INCIDENT':
      if (!request.incidentId) {
        return refuse(request.action, 'incidentId required');
      }
      return applied(request.action, `incident ${request.incidentId} acknowledged`);
    default:
      return refuse(request.action, 'unknown action');
  }
}

function applied(action: Alpha22OperatorAction, detail: string): Alpha22OperatorActionResult {
  return Object.freeze({
    outcome: 'APPLIED',
    action,
    grantsLiveExecution: false,
    simulationOnly: true,
    detail,
  });
}

function refuse(action: Alpha22OperatorAction, reason: string): Alpha22OperatorActionResult {
  return Object.freeze({ outcome: 'REFUSED', action, reason });
}
