/**
 * Adversarial launch-execution cases. None of these may produce a
 * successful production genesis execution.
 */

import { runAuthorizedGenesisExecution, type EngineOptions } from './engine.ts';
import { resetPermitRegistry } from './permit.ts';
import type { LaunchFailureCode, LaunchExecutionSession } from './types.ts';

export const ADVERSARIAL_CASES = [
  'tampered-genesis',
  'wrong-candidate-v2',
  'wrong-rc',
  'replayed-permit',
  'rehearsal-key',
  'wrong-network',
  'wrong-chain',
  'modified-validator-set',
  'insufficient-approval',
  'ai-authorization',
  'configuration-drift',
  'signer-mismatch',
] as const;
export type AdversarialCase = (typeof ADVERSARIAL_CASES)[number];

const CASE_TO_OPTIONS: Readonly<Record<AdversarialCase, EngineOptions>> = Object.freeze({
  'tampered-genesis': { fail: 'WRONG_GENESIS' },
  'wrong-candidate-v2': { fail: 'WRONG_CANDIDATE_V2' },
  'wrong-rc': { fail: 'WRONG_MAINNET_RC' },
  'replayed-permit': { replayPermit: true },
  'rehearsal-key': { fail: 'FIXTURE_REJECTED_FROM_PRODUCTION' },
  'wrong-network': { fail: 'WRONG_NETWORK' },
  'wrong-chain': { fail: 'WRONG_CHAIN' },
  'modified-validator-set': { fail: 'MODIFIED_VALIDATOR_SET' },
  'insufficient-approval': { fail: 'INSUFFICIENT_HUMAN_AUTHORITY' },
  'ai-authorization': { aiAuthorize: true },
  'configuration-drift': { fail: 'CONFIGURATION_DRIFT' },
  'signer-mismatch': { fail: 'SIGNER_NOT_READY' },
});

export function runAdversarialCase(name: AdversarialCase, root = process.cwd()): LaunchExecutionSession {
  resetPermitRegistry();
  return runAuthorizedGenesisExecution(root, CASE_TO_OPTIONS[name]);
}

export function adversarialDidNotExecute(session: LaunchExecutionSession): boolean {
  return session.genesis?.executed !== true || session.state === 'INCIDENT' || session.incident !== null;
}

export function expectedFailureCode(name: AdversarialCase): LaunchFailureCode {
  if (name === 'replayed-permit') return 'PERMIT_REPLAYED';
  if (name === 'ai-authorization') return 'AI_CANNOT_AUTHORIZE';
  return CASE_TO_OPTIONS[name].fail ?? 'AUTHORIZATION_MISMATCH';
}
