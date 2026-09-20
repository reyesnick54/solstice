/**
 * M03 — execution authority guard for futures identities.
 *
 * Synthetic continuous series must never receive Execution Authority.
 */

import { assertExecutableForExecution, isExecutableFuturesContract } from './identities.ts';
import type { ExecutabilityClass } from './types.ts';

export type ExecutionResolutionResult =
  | { readonly ok: true; readonly contractId: string; readonly executability: 'EXECUTABLE' }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly executability: ExecutabilityClass };

export function resolveForExecution(instrumentId: string): ExecutionResolutionResult {
  const result = assertExecutableForExecution(instrumentId);
  if (!result.ok) {
    return Object.freeze({
      ok: false,
      code: result.code,
      message: result.message,
      executability: instrumentId.includes(':CONTINUOUS') ? 'RESEARCH_ONLY' : 'NON_EXECUTABLE',
    });
  }
  return Object.freeze({
    ok: true,
    contractId: result.contractId,
    executability: 'EXECUTABLE',
  });
}

export function grantsExecutionAuthority(_instrumentId: string): false {
  return false;
}

export { isExecutableFuturesContract, assertExecutableForExecution };
