import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  ENVIRONMENT,
  LIVE_CRYPTO_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
} from '../../config/src/flags.ts';
import {
  CANONICAL_AUTHORITY_GRAPH,
  DUAL_ECONOMY_ASSERTIONS,
  FORBIDDEN_SUPER_PACKAGES,
  MOONREY_COIN_DECISION,
  PRODUCTION_ACTIVE,
  authorityDuplicates,
  buildProtectedOwnerAudit,
  currentExternalProductionInputRegister,
  currentHumanDecisionRegister,
  formatEngineeringClosureReport,
  liveFlagsDisabled,
  proveNativeAssetPaths,
  qualifyEngineeringClosure,
} from './production-handoff/engineering-closure/index.ts';
import { runFullPlatformBurnIn } from './production-handoff/full-platform-candidate/burn-in.ts';
import { runProductionSafetySmokeCampaign } from './production-handoff/full-platform-candidate/campaign.ts';

const require = createRequire(import.meta.url);
const { checkMergeIntegrity } = require('../../../scripts/check-merge-integrity.mjs') as {
  checkMergeIntegrity: (root?: string) => { readonly findings: readonly string[] };
};

let cached: ReturnType<typeof qualifyEngineeringClosure> | undefined;
function closure() {
  cached ??= qualifyEngineeringClosure(process.cwd(), { burnInProfile: 'STANDARD' });
  return cached;
}

describe('Chunk 168 SunRey engineering closure', () => {
  it('1. capability IDs unique', () => {
    const audit = buildProtectedOwnerAudit();
    assert.equal(audit.capabilityIdsUnique, true);
    assert.equal(new Set(audit.rows.map((row) => row.capabilityId)).size, audit.rows.length);
  });

  it('2. protected owners unique', () => {
    const audit = buildProtectedOwnerAudit();
    assert.equal(audit.protectedOwnersUnique, true);
    assert.equal(audit.duplicateOwnerCount, 0);
    assert.equal(authorityDuplicates(), 0);
  });

  it('3. no duplicate dependency-table rows', () => {
    const text = readFileSync(join(process.cwd(), 'docs/architecture/chunk-dependencies.md'), 'utf8');
    const ids = [...text.matchAll(/^\| ([a-z0-9-]+) \|/gm)].map((row) => row[1]);
    const current = ids.slice(0, buildProtectedOwnerAudit().rows.length);
    assert.equal(new Set(current).size, current.length);
  });

  it('4. MoonRey capability debt deliberately resolved/classified', () => {
    const moonrey = buildProtectedOwnerAudit().rows.find((row) => row.capabilityId === 'moonrey-coin');
    assert.ok(moonrey);
    assert.equal(moonrey.status, 'SUPERSEDED');
    assert.deepEqual(moonrey.supersededBy, ['sunrey-native-assets', 'moonrey-issuance-engine']);
    assert.equal(MOONREY_COIN_DECISION, 'A_SUPERSEDED_PLACEHOLDER');
    assert.equal(existsSync(join(process.cwd(), 'packages/moonrey-coin')), false);
  });

  it('5. SunRey native asset path complete', () => {
    assert.equal(proveNativeAssetPaths().sunrey, true);
    assert.equal(DUAL_ECONOMY_ASSERTIONS.SunReyPathComplete, true);
  });

  it('6. MoonRey native asset path complete', () => {
    assert.equal(proveNativeAssetPaths().moonrey, true);
    assert.equal(DUAL_ECONOMY_ASSERTIONS.MoonReyPathComplete, true);
  });

  it('7. no Ethereum dependency', () => {
    assert.equal(DUAL_ECONOMY_ASSERTIONS.ethereumBaseLayer, false);
    assert.equal(proveNativeAssetPaths().bothNative, true);
  });

  it('8. Chunk 71 sole monetary authority', () => {
    assert.equal(DUAL_ECONOMY_ASSERTIONS.chunk71MonetaryAuthority, true);
    const owners = CANONICAL_AUTHORITY_GRAPH.filter((row) => row.authority === 'Chunk 71 monetary issuance');
    assert.equal(owners.length, 1);
    assert.equal(owners[0]?.owner, 'packages/sunrey-chain');
  });

  it('9. AssetSupplyBook canonical', () => {
    assert.equal(DUAL_ECONOMY_ASSERTIONS.assetSupplyBookCanonical, true);
    const owners = CANONICAL_AUTHORITY_GRAPH.filter((row) => row.authority === 'AssetSupplyBook');
    assert.equal(owners.length, 1);
  });

  it('10. HIN rights owner unique', () => {
    const owners = CANONICAL_AUTHORITY_GRAPH.filter((row) => row.authority === 'HIN rights');
    assert.equal(owners.length, 1);
    assert.equal(owners[0]?.owner, 'packages/information-market');
  });

  it('11. human valuation owner unique', () => {
    const owners = CANONICAL_AUTHORITY_GRAPH.filter((row) => row.authority === 'Human Contribution Valuation');
    assert.equal(owners.length, 1);
    assert.equal(owners[0]?.owner, 'packages/human-economic-contribution');
  });

  it('12. Productive Value owner unique', () => {
    const owners = CANONICAL_AUTHORITY_GRAPH.filter((row) => row.authority === 'Productive Value / GPUV');
    assert.equal(owners.length, 1);
    assert.equal(owners[0]?.owner, 'packages/sunrey-chain');
  });

  it('13. oracle consensus owner unique', () => {
    const owners = CANONICAL_AUTHORITY_GRAPH.filter((row) => row.authority === 'Oracle consensus');
    assert.equal(owners.length, 1);
    assert.equal(owners[0]?.owner, 'packages/sunrey-chain');
  });

  it('14. Exchange owner unique', () => {
    const owners = CANONICAL_AUTHORITY_GRAPH.filter((row) => row.authority === 'Exchange');
    assert.equal(owners.length, 1);
    assert.equal(owners[0]?.owner, 'packages/sunrey-exchange');
  });

  it('15. custody owner unique', () => {
    const owners = CANONICAL_AUTHORITY_GRAPH.filter((row) => row.authority === 'Custody');
    assert.equal(owners.length, 1);
    assert.equal(owners[0]?.owner, 'packages/custody');
  });

  it('16. Kernel owner unique', () => {
    const owners = CANONICAL_AUTHORITY_GRAPH.filter((row) => row.authority === 'Kernel');
    assert.equal(owners.length, 1);
    assert.equal(owners[0]?.owner, 'packages/kernel');
  });

  it('17. ledger owner unique', () => {
    const owners = CANONICAL_AUTHORITY_GRAPH.filter((row) => row.authority === 'Ledger');
    assert.equal(owners.length, 1);
    assert.equal(owners[0]?.owner, 'packages/ledger');
  });

  it('18. AI cannot execute', () => {
    assert.equal(DUAL_ECONOMY_ASSERTIONS.aiCannotExecute, true);
  });

  it('19. PEVE not human worth', () => {
    assert.equal(DUAL_ECONOMY_ASSERTIONS.peveIsHumanWorth, false);
  });

  it('20. PEVE not token valuation', () => {
    assert.equal(DUAL_ECONOMY_ASSERTIONS.peveIsTokenValuation, false);
  });

  it('21. GPUV not MoonRey', () => {
    assert.equal(DUAL_ECONOMY_ASSERTIONS.gpuvEqualsMoonRey, false);
  });

  it('22. raw human data not on chain', () => {
    assert.equal(DUAL_ECONOMY_ASSERTIONS.rawHumanDataOnChain, false);
  });

  it('23. reference price cannot mint', () => {
    assert.equal(DUAL_ECONOMY_ASSERTIONS.referencePriceCannotMint, true);
  });

  it('24. production safety campaign passes', () => {
    const campaign = runProductionSafetySmokeCampaign(runFullPlatformBurnIn({ profile: 'SMOKE' }).runtime);
    assert.equal(campaign.invariantBreaches, 0);
  });

  it('25. full-platform burn-in passes', () => {
    assert.equal(closure().receipts.fullPlatformBurnInPassed, true);
    assert.equal(closure().receipts.economicStressPassed, true);
  });

  it('26. supply reconciles', () => {
    assert.equal(closure().receipts.supplyReconciled, true);
  });

  it('27. dual-asset custody isolated', () => {
    assert.equal(closure().receipts.dualAssetCustodyIsolated, true);
  });

  it('28. merge integrity passes', () => {
    assert.deepEqual(checkMergeIntegrity(process.cwd()).findings, []);
  });

  it('29. all LIVE flags false', () => {
    assert.equal(liveFlagsDisabled(), true);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(LIVE_CRYPTO_ENABLED, false);
  });

  it('30. production inactive', () => {
    const bundle = closure();
    assert.equal(PRODUCTION_ACTIVE, false);
    assert.equal(bundle.report.productionActive, false);
    assert.equal(bundle.report.productionReady, false);
    assert.equal(bundle.report.productionParametersConfigured, false);
    assert.equal(bundle.report.externalEvidenceComplete, false);
    assert.equal(bundle.report.humanAuthorizationComplete, false);
    assert.equal(bundle.report.liveConnectivityEnabled, false);
    assert.equal(bundle.report.coreCodeCompleteCandidate, true);
    assert.equal(bundle.report.duplicateProtectedAuthorities, 0);
    assert.deepEqual(bundle.report.actualEngineeringBlockers, []);
    assert.ok(currentExternalProductionInputRegister().every((row) => row.present === false));
    assert.ok(currentHumanDecisionRegister().every((row) => row.unresolved && row.aiMayDecide === false));
    const text = formatEngineeringClosureReport(bundle);
    assert.match(text, /CORE_CODE_COMPLETE_CANDIDATE=true/);
    assert.match(text, /PRODUCTION_READY=false/);
    for (const path of FORBIDDEN_SUPER_PACKAGES) {
      assert.equal(existsSync(join(process.cwd(), path)), false);
    }
  });
});
