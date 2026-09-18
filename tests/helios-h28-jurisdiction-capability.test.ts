import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import {
  canPerform,
  createJurisdictionCapabilityFramework,
  createJurisdictionCapabilityRegistry,
  createKernelHeliosCapabilityPort,
  HELIOS_JURISDICTION_IDS,
  JURISDICTION_CAPABILITY_PACKS,
  JURISDICTION_CAPABILITY_POLICY_VERSION,
  packForJurisdiction,
  resolveHeliosJurisdiction,
} from '../packages/kernel/src/policy/jurisdiction-capability/index.ts';
import { evaluateComplianceJurisdiction } from '../packages/platform/src/helios/decision-validity/validators.ts';
import type { EnvelopeEvaluationContext } from '../packages/platform/src/helios/decision-validity/types.ts';
import {
  HeliosJurisdictionCapabilityService,
  jurisdictionEnabledFromCapabilityResult,
} from '../packages/platform/src/helios/jurisdiction-capability/index.ts';

const NOW = asUtcInstant('2026-09-18T12:00:00.000Z');

function baseQuery(overrides: Partial<Parameters<typeof canPerform>[1]> = {}) {
  return Object.freeze({
    legalEntityId: 'le_solstice_uk_ltd',
    customerId: 'cust_test',
    customerClass: 'RETAIL',
    jurisdiction: 'GB',
    productId: 'prod_demand_gbp_gb',
    action: 'HELIOS_PROPOSAL' as const,
    accountId: 'acct_1',
    accountClass: 'DEMAND_DEPOSIT',
    environment: 'simulation' as const,
    at: NOW,
    ...overrides,
  });
}

describe('HELIOS H28 — eleven-jurisdiction capability framework', () => {
  const framework = createJurisdictionCapabilityFramework();
  const registry = framework.registry;

  it('1. each of 11 jurisdiction IDs exists', () => {
    assert.equal(HELIOS_JURISDICTION_IDS.length, 11);
    for (const id of HELIOS_JURISDICTION_IDS) {
      const pack = packForJurisdiction(id);
      assert.equal(pack.packId, id);
      assert.ok(pack.capabilities.length > 0);
    }
    assert.equal(JURISDICTION_CAPABILITY_PACKS.length, 11);
  });

  it('2. unknown capability fails closed', () => {
    const result = canPerform(registry, baseQuery({ action: 'HELIOS_PROPOSAL', jurisdiction: 'ZZ' }));
    assert.equal(result.outcome, 'UNKNOWN');
    assert.notEqual(result.outcome, 'ALLOWED');
    assert.ok(result.reasonCodes.includes('JURISDICTION_UNMAPPED'));
  });

  it('3. disabled capability denied', () => {
    const result = canPerform(
      registry,
      baseQuery({
        jurisdiction: 'SA',
        legalEntityId: 'le_solstice_sa_entity',
        action: 'CASH_ACCOUNT',
        environment: 'simulation',
      }),
    );
    assert.equal(result.outcome, 'DENIED');
    assert.equal(result.capabilityStatus, 'DISABLED');
  });

  it('4. restricted capability returns restriction', () => {
    const result = canPerform(
      registry,
      baseQuery({
        jurisdiction: 'CN',
        legalEntityId: 'le_solstice_research_placeholder',
        action: 'INVESTING',
        environment: 'simulation',
      }),
    );
    assert.equal(result.outcome, 'RESTRICTED');
  });

  it('5. sandbox-only does not become production', () => {
    const sim = canPerform(registry, baseQuery({ action: 'CASH_ACCOUNT', environment: 'simulation' }));
    const live = canPerform(registry, baseQuery({ action: 'CASH_ACCOUNT', environment: 'live' }));
    assert.equal(sim.outcome, 'RESTRICTED');
    assert.equal(sim.capabilityStatus, 'SANDBOX_ONLY');
    assert.equal(live.outcome, 'DENIED');
    assert.ok(live.reasonCodes.includes('SANDBOX_ONLY_NOT_PRODUCTION'));
  });

  it('6. legal entity required', () => {
    const result = canPerform(registry, baseQuery({ legalEntityId: '' }));
    assert.equal(result.outcome, 'UNKNOWN');
    assert.ok(result.reasonCodes.includes('LEGAL_ENTITY_REQUIRED'));
  });

  it('7. provider dependency represented', () => {
    const result = canPerform(
      registry,
      baseQuery({
        jurisdiction: 'SA',
        legalEntityId: 'le_solstice_sa_entity',
        action: 'TRANSFERS_PAYMENTS',
        environment: 'simulation',
      }),
    );
    assert.equal(result.capabilityStatus, 'PARTNER_DEPENDENT');
    assert.equal(result.providerDependency, 'PARTNER_DEPENDENT');
    assert.equal(result.outcome, 'REVIEW_REQUIRED');
  });

  it('8. EU overlay resolution', () => {
    const resolved = resolveHeliosJurisdiction({ jurisdiction: 'DE' });
    assert.equal(resolved.frameworkJurisdictionId, 'EU');
    assert.equal(resolved.overlayId, 'eu-ms-de');
    const result = canPerform(
      registry,
      baseQuery({
        jurisdiction: 'DE',
        legalEntityId: 'le_solstice_eu_entity',
        action: 'CASH_ACCOUNT',
        memberState: 'DE',
        environment: 'simulation',
      }),
    );
    assert.equal(result.jurisdictionId, 'EU');
    assert.equal(result.resolvedOverlayId, 'eu-ms-de');
  });

  it('9. US overlay resolution', () => {
    const resolved = resolveHeliosJurisdiction({ jurisdiction: 'US', stateOverlay: 'CA' });
    assert.equal(resolved.frameworkJurisdictionId, 'US');
    assert.equal(resolved.overlayId, 'us-state-ca');
    const result = canPerform(
      registry,
      baseQuery({
        jurisdiction: 'US',
        legalEntityId: 'le_solstice_us_inc',
        action: 'INVESTING',
        stateOverlay: 'CA',
        environment: 'simulation',
      }),
    );
    assert.equal(result.resolvedOverlayId, 'us-state-ca');
  });

  it('10. mainland China explicit restricted/unknown behavior', () => {
    const digital = canPerform(
      registry,
      baseQuery({
        jurisdiction: 'CN',
        legalEntityId: 'le_solstice_research_placeholder',
        action: 'DIGITAL_ASSETS',
        environment: 'simulation',
      }),
    );
    assert.equal(digital.outcome, 'DENIED');
    assert.equal(digital.capabilityStatus, 'DISABLED');
    const unmapped = canPerform(
      registry,
      baseQuery({
        jurisdiction: 'CN',
        legalEntityId: 'le_solstice_research_placeholder',
        action: 'HELIOS_RESEARCH',
        customerClass: 'UNKNOWN_CLASS',
        environment: 'simulation',
      }),
    );
    assert.notEqual(unmapped.outcome, 'ALLOWED');
  });

  it('11. jurisdiction A state cannot authorize jurisdiction B', () => {
    const gb = canPerform(registry, baseQuery({ jurisdiction: 'GB', action: 'CASH_ACCOUNT' }));
    const jp = canPerform(
      registry,
      baseQuery({
        jurisdiction: 'JP',
        legalEntityId: 'le_solstice_research_placeholder',
        action: 'CASH_ACCOUNT',
      }),
    );
    assert.notEqual(gb.jurisdictionId, jp.jurisdictionId);
    assert.notEqual(jp.outcome, 'ALLOWED');
  });

  it('12. policy-version change', () => {
    const historyBefore = registry.versionHistoryFor('GB');
    assert.ok(historyBefore.includes(JURISDICTION_CAPABILITY_POLICY_VERSION));
    const newVersion = 'h28-v2';
    const pack = packForJurisdiction('GB');
    const nextPack = Object.freeze({
      ...pack,
      packVersion: newVersion,
      capabilities: Object.freeze(
        pack.capabilities.map((row) =>
          row.action === 'HELIOS_PROPOSAL' && row.customerClass === 'RETAIL' && row.environment === 'simulation'
            ? Object.freeze({ ...row, status: 'APPROVED_FOR_TEST' as const, policyVersion: newVersion })
            : row,
        ),
      ),
    });
    registry.putPack(nextPack);
    registry.activatePackVersion('GB', newVersion);
    const result = canPerform(registry, baseQuery({ action: 'HELIOS_PROPOSAL' }));
    assert.equal(result.policyVersion, newVersion);
    assert.equal(result.outcome, 'ALLOWED');
  });

  it('13. revoked policy', () => {
    const pack = packForJurisdiction('AU');
    const revoked = Object.freeze({
      ...pack,
      capabilities: Object.freeze(
        pack.capabilities.map((row) =>
          row.action === 'WITHDRAWAL' && row.customerClass === 'RETAIL' && row.environment === 'simulation'
            ? Object.freeze({ ...row, status: 'REVOKED' as const })
            : row,
        ),
      ),
    });
    const reg = createJurisdictionCapabilityRegistry([revoked]);
    const result = canPerform(
      reg,
      baseQuery({
        jurisdiction: 'AU',
        legalEntityId: 'le_solstice_research_placeholder',
        action: 'WITHDRAWAL',
      }),
    );
    assert.equal(result.outcome, 'DENIED');
    assert.equal(result.capabilityStatus, 'REVOKED');
  });

  it('14. customer-class differentiation', () => {
    const retail = canPerform(registry, baseQuery({ customerClass: 'RETAIL', jurisdiction: 'IN', legalEntityId: 'le_solstice_research_placeholder', action: 'CASH_ACCOUNT' }));
    const institutional = canPerform(registry, baseQuery({ customerClass: 'INSTITUTIONAL', jurisdiction: 'IN', legalEntityId: 'le_solstice_research_placeholder', action: 'CASH_ACCOUNT' }));
    assert.notEqual(retail.capabilityId, institutional.capabilityId);
    assert.equal(retail.outcome, 'REVIEW_REQUIRED');
    assert.equal(institutional.outcome, 'REVIEW_REQUIRED');
  });

  it('15. restart persistence', () => {
    const local = createJurisdictionCapabilityFramework();
    const query = baseQuery({ customerId: 'cust_restart' });
    const result = canPerform(local.registry, query);
    local.store.recordDecision(query, result, NOW);
    const snapshot = local.store.snapshot(local.registry);
    const restored = createJurisdictionCapabilityFramework();
    restored.store.restore(snapshot, restored.registry);
    const after = canPerform(restored.registry, query);
    assert.equal(after.outcome, result.outcome);
    assert.equal(restored.store.listDecisions().length, 1);

    const auPack = packForJurisdiction('AU');
    const revokedPack = Object.freeze({
      ...auPack,
      capabilities: Object.freeze(
        auPack.capabilities.map((row) =>
          row.action === 'WITHDRAWAL' && row.customerClass === 'RETAIL' && row.environment === 'simulation'
            ? Object.freeze({ ...row, status: 'REVOKED' as const })
            : row,
        ),
      ),
    });
    const revokedFramework = createJurisdictionCapabilityFramework({
      registry: createJurisdictionCapabilityRegistry([revokedPack]),
    });
    const preRevoke = canPerform(
      revokedFramework.registry,
      baseQuery({ jurisdiction: 'AU', legalEntityId: 'le_solstice_research_placeholder', action: 'WITHDRAWAL' }),
    );
    assert.equal(preRevoke.outcome, 'DENIED');
    const revokedSnapshot = revokedFramework.store.snapshot(revokedFramework.registry);
    const restart = createJurisdictionCapabilityFramework();
    restart.store.restore(revokedSnapshot, restart.registry);
    const postRevoke = canPerform(
      restart.registry,
      baseQuery({ jurisdiction: 'AU', legalEntityId: 'le_solstice_research_placeholder', action: 'WITHDRAWAL' }),
    );
    assert.equal(postRevoke.outcome, 'DENIED');
    assert.equal(postRevoke.capabilityStatus, 'REVOKED');
  });

  it('16. HELIOS proposal path consumes capability result', () => {
    const clock = new FrozenClock(NOW);
    const vault = new EvidenceVault(clock);
    const port = createKernelHeliosCapabilityPort({ vault });
    const service = new HeliosJurisdictionCapabilityService(port);
    const capabilityResult = service.gateHeliosAction({
      legalEntityId: 'le_solstice_uk_ltd',
      customerId: 'cust_h28',
      customerClass: 'RETAIL',
      jurisdiction: 'GB',
      productId: 'prod_demand_gbp_gb',
      action: 'HELIOS_PROPOSAL',
      accountId: 'acct_1',
      accountClass: 'DEMAND_DEPOSIT',
      environment: 'simulation',
      at: NOW,
    });
    assert.notEqual(capabilityResult.outcome, 'ALLOWED');
    const ctx = {
      jurisdictionCapabilityEnabled: false,
      jurisdictionCapabilityResult: capabilityResult,
      jurisdiction: 'GB',
      now: NOW,
    } as EnvelopeEvaluationContext;
    const check = evaluateComplianceJurisdiction(ctx);
    assert.equal(check.status, 'INVALID');
    assert.ok(check.reasonCodes.includes('JURISDICTION_CAPABILITY_DISABLED'));
    assert.equal(jurisdictionEnabledFromCapabilityResult(capabilityResult), false);
  });

  it('17. no AI policy activation', () => {
    const cap = registry.findCapability({
      jurisdictionId: 'GB',
      legalEntityId: 'le_solstice_uk_ltd',
      action: 'HELIOS_PROPOSAL',
      customerClass: 'RETAIL',
      environment: 'simulation',
      overlayId: null,
      at: NOW,
    });
    assert.throws(
      () =>
        registry.updateCapabilityStatus({
          capabilityId: cap!.capabilityId,
          status: 'APPROVED_FOR_PRODUCTION',
          actorKind: 'AI',
          at: NOW,
          policyVersion: JURISDICTION_CAPABILITY_POLICY_VERSION,
        }),
      /AI cannot set APPROVED_FOR_PRODUCTION/,
    );
  });

  it('18. no fabricated licensing state', () => {
    for (const pack of JURISDICTION_CAPABILITY_PACKS) {
      assert.notEqual(pack.legalReviewStatus, 'CONFIRMED_BY_COUNSEL');
      for (const cap of pack.capabilities) {
        assert.notEqual(cap.counselReviewState, 'CONFIRMED_BY_COUNSEL');
        if (cap.status === 'APPROVED_FOR_PRODUCTION') {
          assert.fail(`unexpected APPROVED_FOR_PRODUCTION in seed for ${cap.capabilityId}`);
        }
        assert.ok(cap.sourceReference.length > 0);
        assert.ok(cap.evidenceRefs.length > 0);
      }
    }
  });
});
