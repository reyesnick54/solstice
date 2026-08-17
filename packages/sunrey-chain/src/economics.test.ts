import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { auditSupply, showPolicy, verifyPolicy } from './economics/auditor.ts';
import { runEconomicsCommand } from './economics/cli.ts';
import { nativeAssetConstitution, requireKnownAsset } from './economics/constitution.ts';
import {
  canonicalizeCategory,
  rejectHiddenOrMismatchedGenesis,
  verifyGenesisAllocationManifest,
  zeroProductionGenesisManifest,
} from './economics/genesis.ts';
import { rejectAiActivation } from './economics/governance.ts';
import {
  authorizeIssuance,
  developmentMoonReyAuthority,
  developmentSunReyAuthority,
  evidenceHash,
  privacySafeHumanEvidence,
  rejectFactOnlyMint,
  rejectOracleOnlyMint,
  rejectPdvAutomaticMint,
  rejectUnrestrictedMint,
} from './economics/issuance.ts';
import { burn, lock, reserveFee, transfer } from './economics/operations.ts';
import { monetaryReadinessSummary } from './economics/readiness.ts';
import { rehearseMonetaryConstitution } from './economics/rehearsal.ts';
import { MonetaryPolicySimulator, requiredScenarios } from './economics/simulator.ts';
import { emptyBook, expectedTotal, observedTotal, supplyReconciles } from './economics/supply.ts';
import { PRODUCTION_PARAMETER_UNCONFIGURED, TICKER_STATUS_NOT_ASSIGNED } from './economics/types.ts';
import { emptyAllocationManifest } from './mainnet/allocation.ts';
import type { GenesisAssetAllocationManifest } from './mainnet/types.ts';

describe('Chunk 71 monetary constitution', () => {
  it('encodes distinct SunRey and MoonRey roles without tickers or production quantities', () => {
    const constitution = nativeAssetConstitution('PRODUCTION_CANDIDATE');
    const sunrey = constitution.assets[0]!;
    const moonrey = constitution.assets[1]!;
    assert.equal(sunrey.assetId, 'SUNREY_COIN');
    assert.equal(moonrey.assetId, 'MOONREY_COIN');
    assert.equal(sunrey.assetPurpose, 'HUMAN_ECONOMIC_LAYER');
    assert.equal(moonrey.assetPurpose, 'AUTONOMOUS_PRODUCTIVE_ECONOMY');
    assert.equal(sunrey.tickerStatus, TICKER_STATUS_NOT_ASSIGNED);
    assert.equal(sunrey.supplyConstraints.maximumSupply, PRODUCTION_PARAMETER_UNCONFIGURED);
    assert.equal(moonrey.supplyConstraints.maximumSupply, PRODUCTION_PARAMETER_UNCONFIGURED);
    assert.equal(sunrey.supplyConstraints.productionIssuanceActivated, false);
    assert.equal(constitution.productionMainnetUnavailable, true);
    assert.throws(() => requireKnownAsset('SUNREY'));
    assert.throws(() => requireKnownAsset('FAKE_COIN'));
  });

  it('keeps production genesis at zero and rejects hidden or mismatched allocations', () => {
    const zero = zeroProductionGenesisManifest();
    const report = verifyGenesisAllocationManifest(zero);
    assert.equal(report.ok, true);
    const hidden: GenesisAssetAllocationManifest = {
      ...emptyAllocationManifest(),
      hiddenPremint: false,
      lines: [
        {
          asset: 'SUNREY_COIN',
          recipientAccount: 'hidden',
          quantityMinorUnits: 1n,
          purposeCategory: 'EXPLICITLY_AUTHORIZED',
          authorizationEvidence: null,
        },
      ],
      totalByAsset: { SUNREY_COIN: 0n, MOONREY_COIN: 0n },
    };
    assert.equal(verifyGenesisAllocationManifest(hidden).ok, false);
    assert.throws(() => rejectHiddenOrMismatchedGenesis(hidden));
    assert.equal(verifyGenesisAllocationManifest(zero, { testnetMigration: true }).ok, false);
    assert.equal(verifyGenesisAllocationManifest(zero, { ledgerMigration: true }).ok, false);
    assert.equal(canonicalizeCategory('VALIDATOR_OPERATIONS'), 'NETWORK_SECURITY');
    assert.throws(() => canonicalizeCategory('INVENTED_CATEGORY'));
    const mismatch: GenesisAssetAllocationManifest = {
      ...emptyAllocationManifest(),
      lines: [
        {
          asset: 'SUNREY_COIN',
          recipientAccount: 'treasury',
          quantityMinorUnits: 10n,
          purposeCategory: 'PROTOCOL_RESERVE',
          authorizationEvidence: 'auth',
        },
      ],
      totalByAsset: { SUNREY_COIN: 9n, MOONREY_COIN: 0n },
    };
    assert.equal(verifyGenesisAllocationManifest(mismatch).ok, false);
    assert.equal(
      verifyGenesisAllocationManifest(mismatch).checks.some((row) => row.id === 'sunrey-total' && !row.ok),
      true,
    );
  });

  it('rejects unrestricted mint, AI authorization, raw personal data, and MoonRey without productive auth', () => {
    const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
    const book = emptyBook('SUNREY_COIN', constitution.assets[0]!.policyVersion.versionId);
    assert.equal(rejectUnrestrictedMint(), 'UNRESTRICTED_MINT_UNAVAILABLE');
    assert.equal(rejectPdvAutomaticMint(), 'PDV_CONSENT_CLEAN_ROOM_CANNOT_MINT');
    assert.equal(rejectOracleOnlyMint(), 'ORACLE_OBSERVATION_CANNOT_MINT');
    assert.equal(rejectFactOnlyMint(), 'VERIFIED_FACT_ALONE_CANNOT_MINT');
    const ai = authorizeIssuance(
      constitution,
      book,
      developmentSunReyAuthority({
        recipient: 'alice',
        quantity: 10n,
        replayIdentifier: 'ai-1',
        actorKind: 'AI',
      }),
    );
    assert.equal(ai.ok, false);
    if (!ai.ok) {
      assert.equal(ai.code, 'AI_MONETARY_AUTHORIZATION_REJECTED');
    }
    assert.throws(() =>
      privacySafeHumanEvidence({
        evidenceId: 'ev.bad',
        policyVersion: 'sunrey.monetary.constitution.v1',
        authorizationId: 'auth.bad',
        contentHash: evidenceHash('x'),
        quantityBasis: 1n,
        purposeClass: 'VERIFIED_HUMAN_ECONOMIC_CONTRIBUTION',
        extra: { name: 'Ada Lovelace' },
      }),
    );
    const moonBook = emptyBook('MOONREY_COIN', constitution.assets[1]!.policyVersion.versionId);
    const wrongAsset = authorizeIssuance(
      constitution,
      moonBook,
      developmentSunReyAuthority({ recipient: 'alice', quantity: 5n, replayIdentifier: 'wrong-asset' }),
    );
    assert.equal(wrongAsset.ok, false);
    if (!wrongAsset.ok) {
      assert.equal(wrongAsset.code, 'WRONG_ASSET_ISSUANCE');
    }
    const noProductive = authorizeIssuance(constitution, moonBook, {
      ...developmentMoonReyAuthority({
        recipient: 'producer',
        quantity: 5n,
        replayIdentifier: 'no-prod',
        contributionId: '',
        fingerprint: '',
        authorizationId: '',
      }),
      authorizationSource: 'DEVELOPMENT_GOVERNED_SIMULATION',
    });
    assert.equal(noProductive.ok, false);
    if (!noProductive.ok) {
      assert.equal(noProductive.code, 'MOONREY_WITHOUT_PRODUCTIVE_AUTHORIZATION');
    }
    assert.throws(() => rejectAiActivation('AI'));
    const invented = authorizeIssuance(constitution, book, {
      ...developmentSunReyAuthority({ recipient: 'alice', quantity: 1n, replayIdentifier: 'invented' }),
      assetId: 'FAKE_COIN' as 'SUNREY_COIN',
    });
    assert.equal(invented.ok, false);
    if (!invented.ok) {
      assert.equal(invented.code, 'INVENTED_ASSET');
    }
    const unauthorized = authorizeIssuance(
      constitution,
      book,
      developmentSunReyAuthority({
        recipient: 'alice',
        quantity: 1n,
        replayIdentifier: 'unauth',
        authorized: false,
      }),
    );
    assert.equal(unauthorized.ok, false);
    if (!unauthorized.ok) {
      assert.equal(unauthorized.code, 'UNRESTRICTED_MINT_UNAVAILABLE');
    }
  });

  it('rejects duplicate issuance and conserves supply across lock, fee, burn, and transfer', () => {
    const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
    let book = emptyBook('SUNREY_COIN', constitution.assets[0]!.policyVersion.versionId);
    const first = authorizeIssuance(
      constitution,
      book,
      developmentSunReyAuthority({ recipient: 'alice', quantity: 100n, replayIdentifier: 'dup-1' }),
    );
    if (!first.ok) {
      throw new Error(first.code);
    }
    book = first.book;
    const replay = authorizeIssuance(
      constitution,
      book,
      developmentSunReyAuthority({ recipient: 'alice', quantity: 100n, replayIdentifier: 'dup-1' }),
    );
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.equal(replay.code, 'DUPLICATE_ISSUANCE');
    }
    book = transfer(book, 'alice', 'bob', 40n);
    book = lock(book, 'bob', 'ord-1', 10n, 'ORDER_RESERVATION');
    book = lock(book, 'alice', 'esc-1', 5n, 'INTEROP_ESCROW');
    book = reserveFee(book, 'alice', 3n);
    const burned = burn(book, 'alice', 7n, 'VOLUNTARY_USER_BURN');
    if (!burned.ok) {
      throw new Error(burned.code);
    }
    book = burned.book;
    assert.equal(supplyReconciles(book), true);
    assert.equal(expectedTotal(book), observedTotal(book));
    const misconduct = burn(book, 'alice', 1n, 'PROTOCOL_ECONOMIC_PENALTY', {
      validatorMisconduct: true,
      unrelatedCustomer: true,
    });
    assert.equal(misconduct.ok, false);
    const report = auditSupply([book]);
    assert.equal(report.ok, true);
    assert.equal(report.assets[0]?.reconciliation, 'EXACT');
  });

  it('runs required engineering simulations and CLI auditors', () => {
    const scenarios = requiredScenarios();
    for (const [name, result] of Object.entries(scenarios)) {
      assert.equal(result.classification, 'ENGINEERING_SIMULATION', name);
      assert.equal(result.ok, true, name);
      assert.equal(result.concentration.legalOrPoliticalConclusion, null);
    }
    assert.equal(scenarios.zeroProductionGenesis?.final.SUNREY_COIN.genesisAllocated, 0n);
    assert.equal(new MonetaryPolicySimulator().classification, 'ENGINEERING_SIMULATION');
    assert.equal(runEconomicsCommand(['policy', 'verify']).ok, true);
    assert.equal(runEconomicsCommand(['supply', 'verify']).ok, true);
    assert.equal(verifyPolicy({ assetId: 'SUNREY_COIN' }).ok, true);
    assert.equal(showPolicy('MOONREY_COIN').assets[0]?.assetId, 'MOONREY_COIN');
    const rehearsal = rehearseMonetaryConstitution();
    assert.equal(rehearsal.units, 'REHEARSAL_ONLY');
    assert.equal(rehearsal.productionAllocation, false);
    assert.equal(rehearsal.supplyReconciled, true);
    const readiness = monetaryReadinessSummary();
    assert.equal(readiness.humanProductionApproval, 'INCOMPLETE');
    assert.equal(readiness.productionQuantities, PRODUCTION_PARAMETER_UNCONFIGURED);
  });
});
