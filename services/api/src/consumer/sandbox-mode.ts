/**
 * Product-wide sandbox mode metadata for consumer surfaces.
 * Sandbox is visually and programmatically distinct from production.
 */

import { ENVIRONMENT } from '../../../../packages/config/src/flags.ts';
import { SANDBOX_LABEL } from './sandbox-personas.ts';
import type { BffPrincipal } from './ports.ts';

export const SANDBOX_MODES = ['PRODUCTION', 'SANDBOX', 'SIMULATION'] as const;
export type SandboxMode = (typeof SANDBOX_MODES)[number];

export type SandboxModeMetadata = {
  readonly schema: 'sunrey.consumer.sandbox-mode.v1';
  readonly mode: SandboxMode;
  readonly environment: typeof ENVIRONMENT;
  readonly productionActive: false;
  readonly liveMoneyEnabled: false;
  readonly liveExchangeEnabled: false;
  readonly sandboxDataIsNotReal: boolean;
  readonly sandboxPersona: string | null;
  readonly label: typeof SANDBOX_LABEL | null;
  readonly frontendMathAuthoritative: false;
  readonly transactionsAreSimulated: boolean;
};

/**
 * Derive client-safe sandbox mode from principal and runtime flags.
 * Never represent simulation as production.
 */
export function buildSandboxModeMetadata(principal: BffPrincipal): SandboxModeMetadata {
  const isSandboxPersona = principal.sandboxPersona !== null;
  return Object.freeze({
    schema: 'sunrey.consumer.sandbox-mode.v1',
    mode: isSandboxPersona ? 'SANDBOX' : 'SIMULATION',
    environment: ENVIRONMENT,
    productionActive: false,
    liveMoneyEnabled: false,
    liveExchangeEnabled: false,
    sandboxDataIsNotReal: true,
    sandboxPersona: principal.sandboxPersona,
    label: isSandboxPersona ? SANDBOX_LABEL : null,
    frontendMathAuthoritative: false,
    transactionsAreSimulated: true,
  });
}
