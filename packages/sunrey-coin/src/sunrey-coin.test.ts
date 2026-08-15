import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId, type Customer } from '../../domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ComplianceKernel } from '../../kernel/src/kernel.ts';
import { Ledger } from '../../ledger/src/journal.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { ConsentService } from '../../consent/src/service.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { computeRewardAmount } from './formula.ts';
import { SUNREY_COIN_ASSET_ID } from './ids.ts';
import { SunReyCoinService } from './service.ts';
import { SIMULATION_DIGITAL_CUSTODY_GB, SIMULATION_SOLSTICE_UK } from './simulation-catalog.ts';
import { GROWTH_CLASSIFICATION, PROTECTED_TRAITS } from './taxonomy.ts';
import type { ContributionFactors } from './types.ts';

const NOW = asUtcInstant('2026-08-15T16:00:00.000Z');
const GB = asJurisdiction('GB');

function customer(id: string): Customer {
  return Object.freeze({
    id: asCustomerId(id),
    legalEntityId: SIMULATION_SOLSTICE_UK.id,
    jurisdiction: GB,
    residency: asResidency('GB'),
    status: 'ACTIVE',
    verification: {
      kycState: 'VERIFIED',
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-15T16:00:00.000Z'),
    },
    createdAt: NOW,
    version: 1,
  });
}

function factors(overrides: Partial<ContributionFactors> = {}): ContributionFactors {
  return {
    provenance: 100n,
    verification: 100n,
    freshness: 100n,
    completeness: 100n,
    authorizedScope: 100n,
    uniqueness: 100n,
    computationParticipation: 100n,
    researchComputeUtility: 100n,
    ...overrides,
  };
}

describe('SunRey Coin', () => {
  it('computes a deterministic FLOOR reward and ignores protected-trait names', () => {
    const left = computeRewardAmount(factors());
    const right = computeRewardAmount(factors());
    assert.equal(left.equals(right), true);
    assert.equal(left.assetId, SUNREY_COIN_ASSET_ID);
    const reduced = computeRewardAmount(factors({ uniqueness: 50n }));
    assert.equal(reduced.scaledUnits < left.scaledUnits, true);
    for (const trait of PROTECTED_TRAITS) {
      assert.equal(Object.hasOwn(factors(), trait), false);
    }
  });

  it('rejects floating-point construction', () => {
    assert.throws(() => AssetQuantity.fromScaledUnits(1 as unknown as bigint, SUNREY_COIN_ASSET_ID), /bigint/);
  });

  it('exposes unavailable market price and no guaranteed return', () => {
    assert.equal(GROWTH_CLASSIFICATION.marketPrice, 'UNAVAILABLE');
    assert.equal(GROWTH_CLASSIFICATION.returnGuarantee, 'NO_GUARANTEED_RETURN');
  });

  it('wires a kernel-gated service without inventing a ticker', () => {
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const events = new DomainEventLog();
    const evidence = new EvidenceVault(clock);
    const issuer = new AuthorityIssuer('sunrey-coin-test');
    const kernel = new ComplianceKernel(issuer, evidence, clock);
    const identity = new SimulatedIdentityAdapter({ clock, keys, events });
    const consent = new ConsentService({ clock, keys, evidence, events });
    const ledger = new Ledger(issuer, clock);
    const cust = customer('cust_coin_test');
    const service = new SunReyCoinService({
      kernel,
      issuer,
      evidence,
      events,
      clock,
      identity: identity.service,
      ledger,
      consent,
      catalog: {
        customers: { get: (id) => (id === cust.id ? cust : undefined) },
        products: {
          get: (id) => (id === SIMULATION_DIGITAL_CUSTODY_GB.id ? SIMULATION_DIGITAL_CUSTODY_GB : undefined),
        },
        legalEntities: { get: (id) => (id === SIMULATION_SOLSTICE_UK.id ? SIMULATION_SOLSTICE_UK : undefined) },
      },
    });
    assert.equal(service.asset.tickerStatus, 'NOT_ASSIGNED');
    assert.equal(service.asset.liveEnabled, false);
    assert.equal(service.chainAdapter.implemented, false);
    assert.equal(service.reconcile().outcome, 'MATCHED');
  });
});
