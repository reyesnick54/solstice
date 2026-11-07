import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  createAlternativeDataRightsRegistry,
  createProviderRegistry,
  evaluateAlternativeDataGate,
  evaluateAlternativeDataFeatureGate,
  listAlternativeDataProviderBindings,
  validateAlternativeDataRightsManifest,
} from '../packages/provider-sdk/src/index.ts';
import {
  ARBEITNOW_ALT02_MANIFEST,
  ARBEITNOW_ALT02_REVOCATION_ACTIVE,
  ARBEITNOW_ALT02_REVOCATION_EXPIRED,
  createDefaultAlternativeDataIngestGuard,
  UNKNOWN_LICENSE_ALT02_MANIFEST,
} from '../packages/external-data/src/alternative-data-rights/index.ts';
import {
  HELIOS_ALT02_DATA_RIGHTS_FIREWALL_QUALIFIED,
  createAlt02FirewallService,
  evaluateAlt02DataRightsFirewallQualification,
} from '../packages/platform/src/helios/adaptive-alpha-fabric/alt02/index.ts';
import { applyAlt02FeatureEntitlementGate } from '../packages/platform/src/helios/feature-fabric/alt02-entitlement-gate.ts';

const NOW = asUtcInstant('2026-09-16T12:00:00.000Z');
const AFTER_EXPIRY = asUtcInstant('2027-07-15T00:00:00.000Z');

describe('HELIOS ALT02 alternative-data rights firewall', () => {
  it('blocks UNKNOWN license class', () => {
    const validation = validateAlternativeDataRightsManifest(UNKNOWN_LICENSE_ALT02_MANIFEST);
    assert.equal(validation.valid, false);
    assert.equal(validation.codes.includes('LICENSE_UNKNOWN'), true);

    const decision = evaluateAlternativeDataGate({
      manifest: UNKNOWN_LICENSE_ALT02_MANIFEST,
      revocation: ARBEITNOW_ALT02_REVOCATION_ACTIVE,
      requestedPurpose: 'RESEARCH',
      accessMode: 'new_ingestion',
      atUtc: NOW,
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.outcome, 'LICENSE_UNKNOWN');
  });

  it('requires explicit permitted purposes on manifest', () => {
    const emptyPurposes = Object.freeze({
      ...ARBEITNOW_ALT02_MANIFEST,
      entitlementPolicy: Object.freeze({
        ...ARBEITNOW_ALT02_MANIFEST.entitlementPolicy,
        permittedPurposes: Object.freeze([]),
      }),
    });
    const validation = validateAlternativeDataRightsManifest(emptyPurposes);
    assert.equal(validation.valid, false);
    assert.equal(validation.codes.includes('PERMITTED_PURPOSES_EMPTY'), true);
  });

  it('stops new ingestion when entitlement expires', () => {
    const guard = createDefaultAlternativeDataIngestGuard();
    const active = guard.guardNewIngestion({
      providerId: 'arbeitnow',
      sourceId: 'arbeitnow:public-jobs',
      purpose: 'RESEARCH',
      atUtc: NOW,
    });
    assert.equal(active.allowed, true);
    assert.equal(active.outcome, 'ENTITLEMENT_ACTIVE');

    guard.registry.register({
      manifest: ARBEITNOW_ALT02_MANIFEST,
      revocation: ARBEITNOW_ALT02_REVOCATION_EXPIRED,
      grantsExecutionAuthority: false,
    });

    const blocked = guard.guardNewIngestion({
      providerId: 'arbeitnow',
      sourceId: 'arbeitnow:public-jobs',
      purpose: 'RESEARCH',
      atUtc: AFTER_EXPIRY,
    });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.outcome, 'ENTITLEMENT_EXPIRED');
  });

  it('allows historical read within retention after expiry', () => {
    const decision = evaluateAlternativeDataGate({
      manifest: ARBEITNOW_ALT02_MANIFEST,
      revocation: ARBEITNOW_ALT02_REVOCATION_EXPIRED,
      requestedPurpose: 'BACKTEST',
      accessMode: 'historical_read',
      atUtc: AFTER_EXPIRY,
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.outcome, 'ENTITLEMENT_EXPIRED');
  });

  it('blocks non-permitted purpose and derived feature storage', () => {
    const notPermitted = evaluateAlternativeDataGate({
      manifest: ARBEITNOW_ALT02_MANIFEST,
      revocation: ARBEITNOW_ALT02_REVOCATION_ACTIVE,
      requestedPurpose: 'MODEL_TRAINING',
      accessMode: 'new_ingestion',
      atUtc: NOW,
    });
    assert.equal(notPermitted.allowed, false);
    assert.equal(notPermitted.outcome, 'PURPOSE_NOT_PERMITTED');

    const derivedBlocked = evaluateAlternativeDataFeatureGate({
      manifest: ARBEITNOW_ALT02_MANIFEST,
      revocation: ARBEITNOW_ALT02_REVOCATION_ACTIVE,
      requestedPurpose: 'PAPER',
      atUtc: NOW,
    });
    assert.equal(derivedBlocked.allowed, false);
    assert.equal(derivedBlocked.outcome, 'PURPOSE_NOT_PERMITTED');
  });

  it('AAF feature gate blocks non-permitted alt-data features', () => {
    const registry = createAlternativeDataRightsRegistry();
    registry.register({
      manifest: ARBEITNOW_ALT02_MANIFEST,
      revocation: ARBEITNOW_ALT02_REVOCATION_ACTIVE,
      grantsExecutionAuthority: false,
    });
    const gate = applyAlt02FeatureEntitlementGate({
      registry,
      providerId: 'arbeitnow',
      sourceId: 'arbeitnow:public-jobs',
      purpose: 'MODEL_TRAINING',
      atUtc: NOW,
    });
    assert.equal(gate.blocked, true);
    assert.equal(gate.outcome, 'PURPOSE_NOT_PERMITTED');
  });

  it('seals Evidence Vault record on deny', () => {
    const vault = new EvidenceVault(new FrozenClock(NOW));
    const registry = createAlternativeDataRightsRegistry();
    registry.register({
      manifest: ARBEITNOW_ALT02_MANIFEST,
      revocation: ARBEITNOW_ALT02_REVOCATION_ACTIVE,
      grantsExecutionAuthority: false,
    });
    const service = createAlt02FirewallService({ registry, evidenceVault: vault });
    service.guardFeature({
      providerId: 'arbeitnow',
      sourceId: 'arbeitnow:public-jobs',
      purpose: 'MODEL_TRAINING',
      atUtc: NOW,
    });
    assert.equal(vault.list().length, 1);
    assert.equal(vault.list()[0]!.kind, 'helios.alt02.data_rights_gate');
  });

  it('composes provider registry with rights registry', () => {
    const providerRegistry = createProviderRegistry();
    const rightsRegistry = createAlternativeDataRightsRegistry();
    rightsRegistry.register({
      manifest: ARBEITNOW_ALT02_MANIFEST,
      revocation: ARBEITNOW_ALT02_REVOCATION_ACTIVE,
      grantsExecutionAuthority: false,
    });
    const bindings = listAlternativeDataProviderBindings({ providerRegistry, rightsRegistry });
    assert.equal(bindings.some((row) => row.providerId === 'arbeitnow' && row.hasRightsManifest), true);
  });

  it('emits HELIOS_ALT02_DATA_RIGHTS_FIREWALL_QUALIFIED when checks pass', () => {
    const qualification = evaluateAlt02DataRightsFirewallQualification({
      unknownLicenseBlocked: true,
      missingManifestBlocked: true,
      purposeMustBeExplicit: true,
      expiredStopsNewIngestion: true,
      historicalFollowsRetention: true,
      derivedFeatureGateBlocksNonPermitted: true,
      prohibitedAcquisitionAttestationRequired: true,
      aggregateScopeRequired: true,
      evidenceSealedOnDeny: true,
      providerRegistryBridgePresent: true,
    });
    assert.equal(qualification.marker, HELIOS_ALT02_DATA_RIGHTS_FIREWALL_QUALIFIED);
    assert.equal(qualification.qualified, true);
  });
});
