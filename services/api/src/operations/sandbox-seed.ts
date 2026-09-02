/**
 * Wave 8 — deterministic sandbox seed catalog.
 *
 * Safe simulation fixtures only. No real sensitive user data.
 */

import { SANDBOX_PERSONA_IDS } from '../consumer/sandbox-personas.ts';

export type SandboxSeedRecord = {
  readonly category: string;
  readonly id: string;
  readonly label: string;
  readonly deterministic: true;
};

export type SandboxSeedCatalog = {
  readonly schema: 'sunrey.sandbox.seed.v1';
  readonly environment: 'simulation';
  readonly productionActive: false;
  readonly records: readonly SandboxSeedRecord[];
};

const HUMAN_CONTRIBUTIONS: readonly SandboxSeedRecord[] = Object.freeze([
  { category: 'human_economic_contribution', id: 'hec.sandbox.research.001', label: 'Research contribution fixture', deterministic: true },
  { category: 'human_economic_contribution', id: 'hec.sandbox.creative.002', label: 'Creative work fixture', deterministic: true },
  { category: 'human_economic_contribution', id: 'hec.sandbox.care.003', label: 'Care economy fixture', deterministic: true },
]);

const PRODUCTIVE_EVENTS: readonly SandboxSeedRecord[] = Object.freeze([
  { category: 'productive_economy_event', id: 'pev.sandbox.energy.001', label: 'Energy facility hour observation', deterministic: true },
  { category: 'productive_economy_event', id: 'pev.sandbox.compute.002', label: 'GPU hour productive event', deterministic: true },
  { category: 'productive_economy_event', id: 'pev.sandbox.logistics.003', label: 'Logistics capacity event', deterministic: true },
]);

const WALLETS: readonly SandboxSeedRecord[] = Object.freeze([
  { category: 'wallet', id: 'wal_sandbox_basic_sunrey', label: 'Basic verified SunRey wallet', deterministic: true },
  { category: 'wallet', id: 'wal_sandbox_basic_moonrey', label: 'Basic verified MoonRey wallet', deterministic: true },
  { category: 'wallet', id: 'wal_sandbox_exchange_sunrey', label: 'Exchange persona SunRey wallet', deterministic: true },
  { category: 'wallet', id: 'wal_sandbox_agent_sunrey', label: 'Agent-enabled SunRey wallet', deterministic: true },
]);

const CLAIMS: readonly SandboxSeedRecord[] = Object.freeze([
  { category: 'human_claim', id: 'claim.sandbox.hin.001', label: 'HIN contribution claim', deterministic: true },
  { category: 'productive_claim', id: 'claim.sandbox.productive.001', label: 'Productive economy claim', deterministic: true },
  { category: 'productive_challenge', id: 'challenge.sandbox.productive.001', label: 'Open productive claim challenge', deterministic: true },
]);

const EXCHANGE_ORDERS: readonly SandboxSeedRecord[] = Object.freeze([
  { category: 'exchange_order', id: 'ord.sandbox.buy.sunrey.001', label: 'Simulated SunRey buy order', deterministic: true },
  { category: 'exchange_order', id: 'ord.sandbox.sell.moonrey.001', label: 'Simulated MoonRey sell order', deterministic: true },
]);

const VAULT_PERMISSIONS: readonly SandboxSeedRecord[] = Object.freeze([
  { category: 'vault_permission', id: 'vault.sandbox.travel.itinerary', label: 'Travel itinerary read permission', deterministic: true },
  { category: 'vault_permission', id: 'vault.sandbox.health.summary', label: 'Health summary aggregate permission', deterministic: true },
  { category: 'vault_permission', id: 'vault.sandbox.finance.statement', label: 'Finance statement scoped permission', deterministic: true },
]);

const PERSONAS: readonly SandboxSeedRecord[] = Object.freeze(
  SANDBOX_PERSONA_IDS.map((persona) =>
    Object.freeze({
      category: 'sandbox_persona',
      id: persona,
      label: `Sandbox persona ${persona}`,
      deterministic: true as const,
    }),
  ),
);

export function buildSandboxSeedCatalog(): SandboxSeedCatalog {
  return Object.freeze({
    schema: 'sunrey.sandbox.seed.v1',
    environment: 'simulation',
    productionActive: false,
    records: Object.freeze([
      ...PERSONAS,
      ...HUMAN_CONTRIBUTIONS,
      ...PRODUCTIVE_EVENTS,
      ...WALLETS,
      ...CLAIMS,
      ...EXCHANGE_ORDERS,
      ...VAULT_PERMISSIONS,
    ]),
  });
}
