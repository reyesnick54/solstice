import type { CapabilityTokenClaims } from '../../../contracts/src/capability-claims.ts';
import type { FinancialContextSnapshot } from '../../../contracts/src/financial-context.ts';
import type { CompiledMandate } from '../../../contracts/src/mandate-types.ts';

/**
 * The only dependencies the Personal Economy Agent is allowed to receive.
 * There is no ledger, no kernel, no authority issuer, and no write port.
 */
export type AgentRuntimePorts = {
  readonly context: FinancialContextSnapshot;
  readonly claims: CapabilityTokenClaims;
  readonly mandates: readonly CompiledMandate[];
};

export function assertReadOnlyContext(context: FinancialContextSnapshot): void {
  if (context.writePath !== false) {
    throw new Error('Financial context must declare writePath: false');
  }
  if (!Object.isFrozen(context)) {
    throw new Error('Financial context must be frozen before the agent sees it');
  }
}
