/**
 * Wave 8 — sandbox feature gates.
 *
 * Sandbox may exercise simulation flows. Production mainnet, live regulated
 * custody, real securities execution, real banking movement, and unapproved
 * token issuance remain blocked.
 */

import {
  ENVIRONMENT,
  LIVE_CONNECTIVITY_ENABLED,
  LIVE_CUSTODY_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_PAYMENTS_ENABLED,
} from '../../../../packages/config/src/flags.ts';
import { moonreyIssuanceActivated } from '../../../../packages/sunrey-chain/src/protocol/assets.ts';
import type { SandboxFeatureGate, SandboxFeatureGateReport } from './types.ts';

function gate(
  gateId: string,
  label: string,
  enabled: boolean,
  detail: string,
  blockedInProduction = true,
): SandboxFeatureGate {
  return Object.freeze({
    gateId,
    label,
    enabled,
    sandboxOnly: true,
    blockedInProduction,
    detail,
  });
}

export function evaluateSandboxFeatureGates(nowUtc: string): SandboxFeatureGateReport {
  if (ENVIRONMENT !== 'simulation') {
    throw new Error('ENVIRONMENT must remain simulation');
  }
  const simulationOnly = ENVIRONMENT === 'simulation';
  const gates = Object.freeze([
    gate(
      'sunrey_issuance_simulation',
      'SunRey issuance simulation',
      simulationOnly && !moonreyIssuanceActivated(),
      'Rehearsal issuance only; Chunk 71 remains sole mint authority',
    ),
    gate(
      'moonrey_issuance_simulation',
      'MoonRey issuance simulation',
      simulationOnly && !moonreyIssuanceActivated(),
      'Proposal pipeline only; production MoonRey issuance inactive',
    ),
    gate('exchange_sandbox', 'Exchange sandbox', simulationOnly, 'Simulated matching and settlement only'),
    gate('agent_proposals', 'Agent proposals', simulationOnly, 'ProposalGate only; no Execution Authority'),
    gate('wallet_transfer_simulation', 'Wallet transfer simulation', simulationOnly, 'In-simulation custody only'),
    gate('economic_claims_simulation', 'Economic claims simulation', simulationOnly, 'Claims and proofs without production issuance'),
    gate('production_mainnet', 'Production mainnet', false, 'Mainnet activation blocked', true),
    gate('live_regulated_custody', 'Live regulated custody', LIVE_CUSTODY_ENABLED === true, 'LIVE_CUSTODY_ENABLED remains false', true),
    gate('live_banking_movement', 'Real banking movement', LIVE_PAYMENTS_ENABLED === true, 'LIVE_PAYMENTS_ENABLED remains false', true),
    gate('live_securities_execution', 'Real securities execution', LIVE_EXCHANGE_ENABLED === true, 'LIVE_EXCHANGE_ENABLED remains false', true),
    gate('live_provider_connectivity', 'Live provider connectivity', LIVE_CONNECTIVITY_ENABLED === true, 'LIVE_CONNECTIVITY_ENABLED remains false', true),
    gate('live_connectivity', 'Live connectivity', LIVE_CONNECTIVITY_ENABLED === true, 'LIVE_CONNECTIVITY_ENABLED remains false', true),
    gate(
      'unapproved_token_issuance',
      'Unapproved token issuance',
      false,
      'No issuance without governed production authorization',
      true,
    ),
  ]);
  return Object.freeze({
    schema: 'sunrey.ops.feature-gates.v1',
    environment: 'simulation',
    productionActive: false,
    mainnetEnabled: false,
    liveProviders: false,
    gates,
    observedAt: nowUtc,
  } as SandboxFeatureGateReport & { readonly observedAt: string });
}
