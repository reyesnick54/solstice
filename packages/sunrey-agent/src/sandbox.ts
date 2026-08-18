import { createHash } from 'node:crypto';

/**
 * Chunk 94 sandbox integration. Synthetic agent trading/payment
 * scenarios stay non-production. This does not import the SDK so the
 * SDK can depend on this package without a cycle.
 */
function deterministicId(prefix: string, seed: string): string {
  return `${prefix}_${createHash('sha256').update(seed).digest('hex').slice(0, 16)}`;
}

export function createAgentSandboxScenario(seed: string): {
  readonly sandboxId: string;
  readonly walletAccountId: string;
  readonly sunreyAsset: 'SUNREY_COIN';
  readonly moonreyAsset: 'MOONREY_COIN';
  readonly marketId: string;
  readonly destinationId: string;
  readonly productionEligible: false;
} {
  const sandboxId = deterministicId('sbx', `agent:${seed}`);
  return Object.freeze({
    sandboxId,
    walletAccountId: deterministicId('sbx.wallet', `agent:${seed}`),
    sunreyAsset: 'SUNREY_COIN',
    moonreyAsset: 'MOONREY_COIN',
    marketId: deterministicId('sbx.ex', `agent:${seed}`),
    destinationId: `dest_${sandboxId}`,
    productionEligible: false,
  });
}
