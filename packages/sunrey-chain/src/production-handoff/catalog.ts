/**
 * Authoritative operational inventory, responsibility matrix, access
 * inventory, SLO policy, and capability catalog.
 */

import { SLO_LABEL } from '../ops/types.ts';
import { handoffHash, assertNoSecrets } from './hash.ts';
import {
  CAPABILITY_STATES,
  ECONOMIC_INTEGRITY_SLIS,
  HUMAN_ACCOUNTABILITY_ROLES,
  INVENTORY_SYSTEM_KINDS,
  OPERATIONAL_ROLES,
  PRODUCTION_HANDOFF_SCHEMA_VERSION,
  PRODUCTION_SLO_DOMAINS,
  PUBLIC_TICKER_POLICY,
  SLO_CONTRACT_LABEL,
  type AccessGrant,
  type CapabilityInventoryRow,
  type EconomicIntegrityDefinition,
  type InventoryComponent,
  type OperationalRole,
  type ProductionAccessInventory,
  type ProductionCapabilityState,
  type ProductionResponsibilityMatrix,
  type ProductionSLOPolicy,
  type ProductionSloDefinition,
  type ProductionSystemInventory,
  type PublicSurfaceDescriptor,
  type ResponsibilityRow,
  type EconomicMonitor,
} from './types.ts';

const OWNER_BY_KIND: Readonly<Record<(typeof INVENTORY_SYSTEM_KINDS)[number], OperationalRole>> = {
  VALIDATOR: 'VALIDATOR_OPERATIONS',
  SENTRY: 'VALIDATOR_OPERATIONS',
  SIGNER: 'VALIDATOR_OPERATIONS',
  RPC: 'INFRASTRUCTURE',
  EXPLORER: 'INFRASTRUCTURE',
  DATABASE: 'DATABASE',
  STORAGE: 'INFRASTRUCTURE',
  BACKUP: 'INFRASTRUCTURE',
  ORACLE_COLLECTOR: 'ORACLE',
  EXCHANGE: 'EXCHANGE',
  CUSTODY: 'CUSTODY',
  MONITORING: 'INCIDENT_COMMAND',
  RELEASE_SERVICE: 'RELEASE_AUTHORITY',
  INTEROP: 'PROTOCOL_AUTHORITY',
  PROVIDER_DEPENDENCY: 'COMPLIANCE_OPERATIONS',
};

const CANONICAL_AUTHORITY: Readonly<Record<OperationalRole, string>> = {
  PROTOCOL_AUTHORITY: 'Chunk 40 protocol governance / Chunk 79 governance-ops',
  SECURITY_AUTHORITY: 'Chunk 79 SECURITY_AUTHORITY / Chunk 83 audit',
  VALIDATOR_OPERATIONS: 'Chunk 54 validator operations',
  INFRASTRUCTURE: 'Chunk 66 production infrastructure',
  DATABASE: 'Chunk 67 production storage / Chunk 55 DR',
  RELEASE_AUTHORITY: 'Chunk 59/84 ReleaseAuthority',
  TREASURY: 'Chunk 77 protocol treasury (cannot mint)',
  ORACLE: 'Chunk 68 production oracles',
  EXCHANGE: 'packages/sunrey-exchange',
  CUSTODY: 'packages/custody',
  COMPLIANCE_OPERATIONS: 'packages/kernel compliance',
  INCIDENT_COMMAND: 'Chunk 54/55 incident procedures + Chunk 90 command',
  OPERATIONS_AUTHORITY: 'Chunk 79 OPERATIONS_AUTHORITY',
  OBSERVER: 'read-only',
  AI_ANALYST: 'assist only; never accountability',
};

export function createSystemInventory(): ProductionSystemInventory {
  const components: InventoryComponent[] = INVENTORY_SYSTEM_KINDS.map((kind) =>
    Object.freeze({
      componentId: `inv_${kind.toLowerCase()}`,
      kind,
      role: kind,
      ownerRole: OWNER_BY_KIND[kind],
      environmentClass: 'REHEARSAL',
      providerDependency: kind === 'PROVIDER_DEPENDENCY' ? 'chunk-82-matrix' : null,
      notes: 'Authoritative operational slot. Not a live production host.',
    }),
  );
  const inventory: ProductionSystemInventory = {
    schemaVersion: PRODUCTION_HANDOFF_SCHEMA_VERSION,
    inventoryId: 'prod_inv_rehearsal_1',
    components: Object.freeze(components),
    secretsPresent: false,
    hash: '',
  };
  const hashed = Object.freeze({ ...inventory, hash: handoffHash({ ...inventory, hash: '' }) });
  assertNoSecrets(hashed);
  return hashed;
}

export function createResponsibilityMatrix(): ProductionResponsibilityMatrix {
  const rows: ResponsibilityRow[] = OPERATIONAL_ROLES.map((role) => {
    const humanRequired = (HUMAN_ACCOUNTABILITY_ROLES as readonly string[]).includes(role);
    return Object.freeze({
      role,
      humanRequired,
      aiMayAssist: true,
      aiSatisfiesAccountability: false,
      systems: Object.freeze(
        INVENTORY_SYSTEM_KINDS.filter((kind) => OWNER_BY_KIND[kind] === role),
      ),
      canonicalAuthority: CANONICAL_AUTHORITY[role],
    });
  });
  const matrix = {
    schemaVersion: PRODUCTION_HANDOFF_SCHEMA_VERSION,
    rows: Object.freeze(rows),
    hash: '',
  };
  return Object.freeze({ ...matrix, hash: handoffHash({ ...matrix, hash: '' }) });
}

export function createAccessInventory(): ProductionAccessInventory {
  const grants: AccessGrant[] = HUMAN_ACCOUNTABILITY_ROLES.map((role) =>
    Object.freeze({
      principalId: `human_${role.toLowerCase()}`,
      principalKind: 'HUMAN' as const,
      role,
      systems: Object.freeze([role]),
      keyPurpose: role === 'VALIDATOR_OPERATIONS' ? 'VALIDATOR_KEY' : role === 'RELEASE_AUTHORITY' ? 'RELEASE_KEY' : null,
      providerPermissions: Object.freeze(role === 'COMPLIANCE_OPERATIONS' ? ['review'] : []),
      universalAuthority: false,
      leastPrivilege: true,
    }),
  );
  grants.push(
    Object.freeze({
      principalId: 'svc_rpc_read',
      principalKind: 'SERVICE',
      role: 'INFRASTRUCTURE',
      systems: Object.freeze(['RPC']),
      keyPurpose: 'TLS',
      providerPermissions: Object.freeze(['read-health']),
      universalAuthority: false,
      leastPrivilege: true,
    }),
  );
  const inventory = {
    schemaVersion: PRODUCTION_HANDOFF_SCHEMA_VERSION,
    grants: Object.freeze(grants),
    secretsPresent: false,
    hash: '',
  };
  const hashed = Object.freeze({ ...inventory, hash: handoffHash({ ...inventory, hash: '' }) });
  assertNoSecrets(hashed);
  return hashed;
}

export function rejectUniversalAuthority(explicitlyApproved = false): void {
  if (!explicitlyApproved) {
    throw new TypeError('no operator receives universal authority unless explicitly designed and approved');
  }
}

export function createSloPolicy(): ProductionSLOPolicy {
  const operational: ProductionSloDefinition[] = PRODUCTION_SLO_DOMAINS.map((domain) =>
    Object.freeze({
      domain,
      sli: `${domain.toLowerCase()}_sli`,
      target: domain.includes('LATENCY') || domain.includes('LAG') ? 'engineering window' : '99.0 percent over a drill window',
      label: SLO_CONTRACT_LABEL,
      contractual: false,
    }),
  );
  const economicIntegrity: EconomicIntegrityDefinition[] = ECONOMIC_INTEGRITY_SLIS.map((sli) =>
    Object.freeze({
      sli,
      description: `${sli} is an integrity indicator, not a latency SLO`,
      integrityFailureIsNotLatency: true,
      label: SLO_CONTRACT_LABEL,
    }),
  );
  if (SLO_CONTRACT_LABEL !== SLO_LABEL) {
    throw new TypeError('production SLO label must remain ENGINEERING_TEST_TARGETS');
  }
  const policy = {
    schemaVersion: PRODUCTION_HANDOFF_SCHEMA_VERSION,
    label: SLO_CONTRACT_LABEL,
    contractualPromises: false,
    operational: Object.freeze(operational),
    economicIntegrity: Object.freeze(economicIntegrity),
    hash: '',
  };
  return Object.freeze({ ...policy, hash: handoffHash({ ...policy, hash: '' }) });
}

export function defaultCapabilityInventory(): readonly CapabilityInventoryRow[] {
  return Object.freeze([
    row('SUNREY_CHAIN', 'INACTIVE', false, false, 'Software exists; not runtime-enabled'),
    row('SUNREY_COIN_NATIVE_ASSET', 'INACTIVE', false, false, 'Ticker NOT_ASSIGNED'),
    row('MOONREY_COIN_NATIVE_ASSET', 'INACTIVE', false, false, 'Productive issuance provenance preserved; inactive'),
    row('SUNREY_EXCHANGE', 'INACTIVE', true, false, 'Regulated; license evidence absent'),
    row('INSTITUTIONAL_CUSTODY', 'INACTIVE', true, false, 'Regulated; provider evidence absent'),
    row('FIAT_BANKING', 'INACTIVE', true, false, 'Regulated; remains unavailable'),
    row('RPC_PUBLIC', 'INACTIVE', false, false, 'Public surface unpublished until capability active'),
    row('EXPLORER_PUBLIC', 'INACTIVE', false, false, 'Public surface unpublished until capability active'),
    row('SDK_METADATA', 'INACTIVE', false, false, 'Public metadata unpublished until capability active'),
  ]);
}

function row(
  capability: string,
  state: ProductionCapabilityState,
  regulated: boolean,
  eligibilityEvidenceCurrent: boolean,
  notes: string,
): CapabilityInventoryRow {
  if (!(CAPABILITY_STATES as readonly string[]).includes(state)) {
    throw new TypeError(`unknown capability state ${state}`);
  }
  return Object.freeze({ capability, state, regulated, eligibilityEvidenceCurrent, notes });
}

export function suspendRegulatedCapabilityAfterEvidenceExpiry(
  rows: readonly CapabilityInventoryRow[],
  capability: string,
  evidenceCurrent: boolean,
): readonly CapabilityInventoryRow[] {
  return Object.freeze(
    rows.map((item) => {
      if (item.capability !== capability) {
        return item;
      }
      if (item.regulated && !evidenceCurrent && (item.state === 'ELIGIBLE' || item.state === 'ACTIVE')) {
        return Object.freeze({
          ...item,
          state: 'SUSPENDED_BY_POLICY' as const,
          eligibilityEvidenceCurrent: false,
          notes: 'regulated capability lost eligibility because required evidence expired',
        });
      }
      return Object.freeze({ ...item, eligibilityEvidenceCurrent: evidenceCurrent });
    }),
  );
}

export function publicSurfaceDescriptors(capabilityActive: boolean): readonly PublicSurfaceDescriptor[] {
  const surfaces = ['RPC', 'EXPLORER', 'SDK_METADATA'] as const;
  return Object.freeze(
    surfaces.map((surface) =>
      Object.freeze({
        surface,
        capabilityActive,
        published: capabilityActive,
        networkId: capabilityActive ? 'configured' : null,
        chainId: capabilityActive ? 'configured' : null,
        protocolVersion: capabilityActive ? '1' : null,
        activeRelease: capabilityActive ? 'configured' : null,
        assetIds: capabilityActive ? Object.freeze(['SUNREY_COIN', 'MOONREY_COIN']) : Object.freeze([]),
        publicTicker: PUBLIC_TICKER_POLICY,
      }),
    ),
  );
}

export function economicMonitors(): readonly EconomicMonitor[] {
  return Object.freeze([
    { name: 'sunrey_supply', value: 'reconcile', investmentPrediction: false },
    { name: 'moonrey_supply', value: 'reconcile', investmentPrediction: false },
    { name: 'issuance_concentration', value: 'observe', investmentPrediction: false },
    { name: 'productive_concentration', value: 'observe', investmentPrediction: false },
    { name: 'validator_concentration', value: 'observe', investmentPrediction: false },
    { name: 'oracle_concentration', value: 'observe', investmentPrediction: false },
    { name: 'fee_behavior', value: 'observe', investmentPrediction: false },
    { name: 'exchange_liquidity', value: 'observe_when_active', investmentPrediction: false },
  ]);
}

export function assertPublicTickerGoverned(ticker: string, governed: boolean): void {
  if (ticker !== PUBLIC_TICKER_POLICY && !governed) {
    throw new TypeError('public tickers only if they have actually been governed/assigned');
  }
}
