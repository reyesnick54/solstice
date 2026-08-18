/**
 * Local/rehearsal provisioning harness.
 *
 * Exercises the same plan graph with fake providers, test credentials,
 * and rehearsal network IDs. Does not mutate real infrastructure.
 */

import { assertNoPrivateKeyMaterial } from '../../../../security/src/crypto-leakage.ts';
import { unwrapSecurity } from '../../../../security/src/errors.ts';
import { createLocalHarness } from '../harness.ts';
import { ObjectStorageAdapter } from '../services.ts';
import { evaluateNetworkPath } from '../network.ts';
import { createProductionEnvironmentPlan, verifyProductionEnvironmentPlan } from './plan.ts';
import { compareDeploymentDrift, descriptorFromPlan } from './drift.ts';
import { rejectExpiredProviderEvidence, rejectMissingSignerReference, rejectUnacceptedHsm } from './providers.ts';
import type { ProductionEnvironmentClass, ProductionEnvironmentPlan, ProvisioningResult } from './types.ts';

export type ProvisioningHarness = {
  readonly environmentClass: ProductionEnvironmentClass;
  readonly plan: ProductionEnvironmentPlan;
  readonly results: readonly ProvisioningResult[];
  readonly productionAuthorized: false;
  readonly mainnetEnabled: false;
  readonly mutated: false;
};

export function runLocalProvisioningHarness(
  environmentClass: ProductionEnvironmentClass = 'LOCAL',
  root = process.cwd(),
): ProvisioningHarness {
  if (environmentClass === 'PRODUCTION') {
    throw new TypeError('automated CI uses non-production environment classes');
  }
  const infra = createLocalHarness(environmentClass === 'TESTNET' ? 'TESTNET' : environmentClass === 'MAINNET_REHEARSAL' ? 'MAINNET_REHEARSAL' : 'LOCAL');
  const plan = createProductionEnvironmentPlan({ root, environmentClass });
  const verified = verifyProductionEnvironmentPlan(plan, root);
  if (!verified.ok) {
    throw new TypeError(`provisioning plan verification failed: ${verified.checks.filter((row) => !row.ok).map((row) => row.id).join(',')}`);
  }
  const storage = new ObjectStorageAdapter();
  storage.put({
    objectId: 'rehearsal-plan',
    objectClass: 'RELEASE_BUNDLE',
    environment: 'LOCAL',
    payload: Buffer.from(plan.planHash),
    encryptionPolicy: 'PROVIDER_MANAGED',
    retentionUntilUtc: null,
  });
  evaluateNetworkPath('SENTRY', 'VALIDATOR_PRIVATE');
  const results = plan.operations.map((row) =>
    Object.freeze({
      operationId: row.operationId,
      ok: true,
      code: 'REHEARSED',
      detail: `fake-provider ${infra.provider.providerId} executed ${row.kind} without mutation`,
      mutated: false as const,
    }),
  );
  const drift = compareDeploymentDrift(plan, descriptorFromPlan(plan));
  if (drift.classification !== 'MATCH') {
    throw new TypeError('rehearsal descriptor must match the approved plan');
  }
  unwrapSecurity(assertNoPrivateKeyMaterial({ plan, results }, 'production-provisioning-harness'));
  return Object.freeze({
    environmentClass,
    plan,
    results: Object.freeze(results),
    productionAuthorized: false,
    mainnetEnabled: false,
    mutated: false,
  });
}

export function simulateProvisioningFailure(
  kind:
    | 'provider-unavailable'
    | 'object-storage-unavailable'
    | 'database-unavailable'
    | 'wrong-artifact'
    | 'wrong-network'
    | 'wrong-chain'
    | 'wrong-zone'
    | 'missing-signer'
    | 'unaccepted-hsm'
    | 'expired-evidence'
    | 'network-policy',
): ProvisioningResult {
  if (kind === 'missing-signer') {
    try {
      rejectMissingSignerReference(null);
    } catch (error) {
      return Object.freeze({ operationId: kind, ok: false, code: 'MISSING_SIGNER', detail: error instanceof Error ? error.message : kind, mutated: false });
    }
  }
  if (kind === 'unaccepted-hsm') {
    try {
      rejectUnacceptedHsm('CONFIGURED_UNVERIFIED', true);
    } catch (error) {
      return Object.freeze({ operationId: kind, ok: false, code: 'UNACCEPTED_HSM', detail: error instanceof Error ? error.message : kind, mutated: false });
    }
  }
  if (kind === 'expired-evidence') {
    try {
      rejectExpiredProviderEvidence('2020-01-01T00:00:00.000Z', '2026-08-18T00:00:00.000Z');
    } catch (error) {
      return Object.freeze({ operationId: kind, ok: false, code: 'EXPIRED_EVIDENCE', detail: error instanceof Error ? error.message : kind, mutated: false });
    }
  }
  if (kind === 'network-policy') {
    const decision = evaluateNetworkPath('PUBLIC_EDGE', 'SIGNER_PRIVATE');
    return Object.freeze({
      operationId: kind,
      ok: false,
      code: 'NETWORK_POLICY',
      detail: decision.reason,
      mutated: false,
    });
  }
  return Object.freeze({
    operationId: kind,
    ok: false,
    code: kind.toUpperCase().replaceAll('-', '_'),
    detail: `${kind} is a rehearsed failure. No infrastructure was mutated.`,
    mutated: false,
  });
}
