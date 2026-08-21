/**
 * Domain-scoped pause.
 *
 * pauseCandidate narrows a capability. It cannot mint, reverse
 * history, change parameters, or create human approval.
 */

import type { PauseResult, StagedActivationDomain } from './types.ts';

export function pauseCandidate(domain: StagedActivationDomain, reason: string): PauseResult {
  return Object.freeze({
    domain,
    paused: true,
    reason,
    minted: false,
    historyRewritten: false,
    parametersChanged: false,
    humanApprovalCreated: false,
    liveEnabled: false,
  });
}

export function pauseCannotMint(result: PauseResult): boolean {
  return result.minted === false;
}

export function pauseCannotRewriteHistory(result: PauseResult): boolean {
  return result.historyRewritten === false;
}

export function pauseCannotChangeParameters(result: PauseResult): boolean {
  return result.parametersChanged === false;
}

export function pauseCannotCreateHumanApproval(result: PauseResult): boolean {
  return result.humanApprovalCreated === false;
}
