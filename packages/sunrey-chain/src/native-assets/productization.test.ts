import assert from 'node:assert/strict';
import { test } from 'node:test';

import { developmentSunReyAuthority } from '../economics/issuance.ts';
import { emptyBook } from '../economics/supply.ts';
import { TICKER_STATUS_NOT_ASSIGNED } from '../economics/types.ts';
import {
  AGENT_NATIVE_ECONOMY_PERMISSIONS,
  ProtocolNativeSupplyAuthority,
  UNRESOLVED_MAINNET_ECONOMICS,
  agentCannotMint,
  authorizeAgentNativeEconomyAction,
  authorizedBurn,
  canonicalNativeAsset,
  createIssuanceProposal,
  economicPolicyDocument,
  enforceSupplyInvariants,
  evaluateGenesisAllocation,
  evaluateHumanGovernanceGate,
  evaluateOracleSafety,
  exchangeCannotChangeSupply,
  frontendCannotChangeSupply,
  lovableNativeEconomyContract,
  mainnetEconomicsMissing,
  nativeAssetAuthorityBoundary,
  nativeAssetRegistry,
  publicSupplyApi,
  publicTickerRemainsUnassigned,
  refuseForbiddenMutator,
  refuseUnrestrictedMint,
  runIsolatedEconomicSimulation,
  runMoonReyIssuancePipeline,
  runSunReyIssuancePipeline,
  separateValuationFromMarketPrice,
  simulationCannotAuthorizeProduction,
  supplyAuthorityBoundary,
} from './index.ts';

test('canonical registry productizes both native assets without inventing a ticker', () => {
  const assets = nativeAssetRegistry();
  assert.equal(assets.length, 2);
  assert.equal(assets[0]?.assetId, 'SUNREY_COIN');
  assert.equal(assets[1]?.assetId, 'MOONREY_COIN');
  for (const asset of assets) {
    assert.equal(asset.ticker, TICKER_STATUS_NOT_ASSIGNED);
    assert.equal(asset.decimals, 6);
    assert.equal(asset.evmToken, false);
    assert.equal(asset.erc20, false);
    assert.ok(asset.genesisPolicyReference.length > 0);
    assert.ok(asset.issuancePolicyReference.length > 0);
    assert.ok(asset.burnPolicyReference.length > 0);
    assert.ok(asset.governanceReference.length > 0);
  }
  assert.equal(canonicalNativeAsset('SUNREY_COIN', 'PRODUCTION_CANDIDATE').status, 'MAINNET_BLOCKED');
  assert.equal(publicTickerRemainsUnassigned(), true);
});

test('supply authority is singular and rejects Exchange, Agent, and frontend mutators', () => {
  const boundary = supplyAuthorityBoundary();
  assert.equal(boundary.canonicalOwner, 'packages/sunrey-chain/src/economics/supply.ts');
  assert.equal(boundary.applicationSupplyImported, false);
  assert.equal(refuseForbiddenMutator('EXCHANGE_DATABASE'), 'UNAUTHORIZED_ACTOR');
  assert.equal(refuseForbiddenMutator('AGENT'), 'UNAUTHORIZED_ACTOR');
  assert.equal(refuseForbiddenMutator('FRONTEND'), 'UNAUTHORIZED_ACTOR');
  assert.equal(refuseForbiddenMutator('ORACLE'), 'UNAUTHORIZED_ACTOR');
  assert.equal(refuseForbiddenMutator('OPERATIONAL_DATABASE'), 'UNAUTHORIZED_ACTOR');
  assert.equal(refuseForbiddenMutator('PROTOCOL'), null);
  assert.equal(exchangeCannotChangeSupply('EXCHANGE_DATABASE'), true);
  assert.equal(frontendCannotChangeSupply('FRONTEND'), true);
  assert.equal(agentCannotMint('AGENT'), true);
});

test('authorized issuance updates supply and unauthorized actors cannot mint', () => {
  const authority = new ProtocolNativeSupplyAuthority();
  const ok = runSunReyIssuancePipeline(authority, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct_human',
    quantity: 100n,
    replayIdentifier: 'sunrey-ok',
    contributionVerified: true,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.book.issuedPostGenesis, 100n);
    assert.equal(ok.book.circulating, 100n);
    assert.equal(enforceSupplyInvariants([ok.book]).ok, true);
  }
  const exchange = runSunReyIssuancePipeline(authority, {
    actor: 'EXCHANGE_DATABASE',
    network: 'DEVELOPMENT',
    recipient: 'acct_x',
    quantity: 1n,
    replayIdentifier: 'sunrey-ex',
    contributionVerified: true,
  });
  assert.equal(exchange.ok, false);
  const agent = runSunReyIssuancePipeline(authority, {
    actor: 'AGENT',
    network: 'DEVELOPMENT',
    recipient: 'acct_a',
    quantity: 1n,
    replayIdentifier: 'sunrey-ag',
    contributionVerified: true,
  });
  assert.equal(agent.ok, false);
  const frontend = runSunReyIssuancePipeline(authority, {
    actor: 'FRONTEND',
    network: 'DEVELOPMENT',
    recipient: 'acct_f',
    quantity: 1n,
    replayIdentifier: 'sunrey-fe',
    contributionVerified: true,
  });
  assert.equal(frontend.ok, false);
});

test('duplicate issuance and replay cannot mint twice', () => {
  const authority = new ProtocolNativeSupplyAuthority();
  const first = runSunReyIssuancePipeline(authority, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct_human',
    quantity: 50n,
    replayIdentifier: 'dup-1',
    contributionVerified: true,
  });
  assert.equal(first.ok, true);
  const second = runSunReyIssuancePipeline(authority, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct_human',
    quantity: 50n,
    replayIdentifier: 'dup-1',
    contributionVerified: true,
  });
  assert.equal(second.ok, false);
  if (!second.ok) {
    assert.equal(second.code, 'DUPLICATE_ISSUANCE');
  }
});

test('raw user data, unverified contributions, and AI valuation cannot mint SunRey', () => {
  const authority = new ProtocolNativeSupplyAuthority();
  assert.equal(
    runSunReyIssuancePipeline(authority, {
      actor: 'PROTOCOL',
      network: 'DEVELOPMENT',
      recipient: 'acct',
      quantity: 1n,
      replayIdentifier: 'raw',
      contributionVerified: true,
      rawUserData: true,
    }).ok,
    false,
  );
  assert.equal(
    runSunReyIssuancePipeline(authority, {
      actor: 'PROTOCOL',
      network: 'DEVELOPMENT',
      recipient: 'acct',
      quantity: 1n,
      replayIdentifier: 'unv',
      contributionVerified: false,
    }).ok,
    false,
  );
  assert.equal(
    runSunReyIssuancePipeline(authority, {
      actor: 'PROTOCOL',
      network: 'DEVELOPMENT',
      recipient: 'acct',
      quantity: 1n,
      replayIdentifier: 'ai',
      contributionVerified: true,
      aiValuation: true,
    }).ok,
    false,
  );
  assert.equal(refuseUnrestrictedMint(), 'UNRESTRICTED_MINT_UNAVAILABLE');
});

test('MoonRey issuance requires productive authorization and fails closed on stale or invalid oracles', () => {
  const authority = new ProtocolNativeSupplyAuthority();
  const ok = runMoonReyIssuancePipeline(authority, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct_prod',
    quantity: 25n,
    replayIdentifier: 'moon-ok',
    contributionId: 'pc_1',
    fingerprint: 'fp_1',
    authorizationId: 'auth_1',
    category: 'ENERGY',
    sourceConnected: true,
  });
  assert.equal(ok.ok, true);
  const stale = runMoonReyIssuancePipeline(authority, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct_prod',
    quantity: 1n,
    replayIdentifier: 'moon-stale',
    contributionId: 'pc_2',
    fingerprint: 'fp_2',
    authorizationId: 'auth_2',
    category: 'COMPUTE',
    observations: [
      {
        observationId: 'obs_1',
        quality: 'STALE',
        confidenceBps: 10,
        provenance: 'fixture',
        freshnessUtc: '2020-01-01T00:00:00.000Z',
        stale: true,
        disputed: false,
      },
    ],
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) {
    assert.equal(stale.code, 'ORACLE_STALE');
  }
  const invalid = evaluateOracleSafety({
    observations: [
      {
        observationId: 'obs_bad',
        quality: 'INVALID',
        confidenceBps: 0,
        provenance: 'none',
        freshnessUtc: '2026-01-01T00:00:00.000Z',
        stale: false,
        disputed: false,
      },
    ],
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.code, 'ORACLE_INVALID');
  }
  const single = evaluateOracleSafety({
    observations: [
      {
        observationId: 'obs_one',
        quality: 'VALID',
        confidenceBps: 9_000,
        provenance: 'one',
        freshnessUtc: '2026-08-23T00:00:00.000Z',
        stale: false,
        disputed: false,
      },
    ],
  });
  assert.equal(single.ok, false);
  const oracleOnly = runMoonReyIssuancePipeline(authority, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct_prod',
    quantity: 1n,
    replayIdentifier: 'moon-oracle',
    contributionId: 'pc_3',
    fingerprint: 'fp_3',
    authorizationId: 'auth_3',
    category: 'LOGISTICS',
    oracleOnly: true,
  });
  assert.equal(oracleOnly.ok, false);
});

test('burn reduces balance and supply, is replay protected, and stays unresolved on mainnet', () => {
  const authority = new ProtocolNativeSupplyAuthority();
  const issued = runSunReyIssuancePipeline(authority, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct_burn',
    quantity: 40n,
    replayIdentifier: 'pre-burn',
    contributionVerified: true,
  });
  assert.equal(issued.ok, true);
  const burned = authority.applyBurn({
    assetId: 'SUNREY_COIN',
    account: 'acct_burn',
    quantity: 10n,
    burnClass: 'VOLUNTARY_USER_BURN',
    authorizedSource: 'VOLUNTARY_USER',
    replayIdentifier: 'burn-1',
    network: 'DEVELOPMENT',
    actor: 'PROTOCOL',
  });
  assert.equal(burned.ok, true);
  if (burned.ok) {
    assert.equal(burned.supplyAfter, 30n);
    assert.equal(burned.book.burned, 10n);
    assert.equal(burned.book.circulating, 30n);
  }
  const replay = authority.applyBurn({
    assetId: 'SUNREY_COIN',
    account: 'acct_burn',
    quantity: 1n,
    burnClass: 'VOLUNTARY_USER_BURN',
    authorizedSource: 'VOLUNTARY_USER',
    replayIdentifier: 'burn-1',
    network: 'DEVELOPMENT',
    actor: 'PROTOCOL',
  });
  assert.equal(replay.ok, false);
  const mainnet = authorizedBurn(authority.book('SUNREY_COIN'), {
    assetId: 'SUNREY_COIN',
    account: 'acct_burn',
    quantity: 1n,
    burnClass: 'VOLUNTARY_USER_BURN',
    authorizedSource: 'VOLUNTARY_USER',
    replayIdentifier: 'burn-main',
    network: 'MAINNET',
    actor: 'PROTOCOL',
  });
  assert.equal(mainnet.ok, false);
});

test('missing governance and unresolved mainnet economics fail closed', () => {
  const document = economicPolicyDocument({ network: 'MAINNET' });
  assert.equal(document.mainnetEconomics, 'NOT_AUTHORIZED');
  assert.equal(mainnetEconomicsMissing(document), true);
  assert.ok(UNRESOLVED_MAINNET_ECONOMICS.some((row) => row.id === 'maxSupply'));
  assert.ok(UNRESOLVED_MAINNET_ECONOMICS.every((row) => row.humanDecision && !row.aiMayApprove));
  const missing = evaluateHumanGovernanceGate({ network: 'MAINNET', actor: 'PROTOCOL' });
  assert.equal(missing.ok, false);
  const ai = evaluateHumanGovernanceGate({ network: 'DEVELOPMENT', actor: 'AI' });
  assert.equal(ai.ok, false);
  const authority = new ProtocolNativeSupplyAuthority({ network: 'MAINNET', policyState: 'PRODUCTION_CANDIDATE' });
  const blocked = runSunReyIssuancePipeline(authority, {
    actor: 'PROTOCOL',
    network: 'MAINNET',
    recipient: 'acct',
    quantity: 1n,
    replayIdentifier: 'mainnet',
    contributionVerified: true,
  });
  assert.equal(blocked.ok, false);
});

test('testnet economics stay labeled and cannot become mainnet values', () => {
  const testnet = economicPolicyDocument({ network: 'TESTNET' });
  assert.equal(testnet.policyState, 'TESTNET_ACTIVE');
  const genesis = evaluateGenesisAllocation({ network: 'MAINNET' });
  assert.equal(genesis.ok, true);
  if (genesis.ok) {
    assert.equal(genesis.classification, 'ZERO_MAINNET');
  }
  const promotion = evaluateGenesisAllocation({ network: 'TESTNET', promoteTestnetToMainnet: true });
  assert.equal(promotion.ok, false);
  const labeled = evaluateGenesisAllocation({ network: 'TESTNET', testnetQuantity: 1_000_000_000_000n });
  assert.equal(labeled.ok, true);
  if (labeled.ok) {
    assert.equal(labeled.classification, 'LABELED_TESTNET_DEVELOPMENT');
  }
});

test('valuation is separate from Exchange market price', () => {
  const split = separateValuationFromMarketPrice({
    valuation: {
      methodologyId: 'human-contribution-bridge',
      methodologyVersion: 'v2',
      referenceValue: '100',
      denomination: 'REF',
      isExchangeMarketPrice: false,
    },
    exchangePrice: { lastTradeMinorUnits: '250', quoteAsset: 'USD' },
  });
  assert.equal(split.hardCodedFromValuation, false);
  assert.equal(split.protocolValuation.isExchangeMarketPrice, false);
  assert.equal(split.marketPrice.lastTradeMinorUnits, '250');
  assert.notEqual(split.protocolValuation.referenceValue, split.marketPrice.lastTradeMinorUnits);
});

test('issuance proposal cannot be AI self-approved', () => {
  const book = emptyBook('SUNREY_COIN', 'sunrey.monetary.constitution.v1');
  const proposal = createIssuanceProposal({
    proposalId: 'p1',
    asset: 'SUNREY_COIN',
    amount: 10n,
    basis: 'TEST',
    inputReferences: ['ref'],
    valuationMethodology: 'none',
    policyVersion: 'sunrey.monetary.constitution.v1',
    book,
    network: 'DEVELOPMENT',
  });
  assert.equal(proposal.aiSelfApproved, false);
  assert.ok(proposal.requiredApprovals.includes('HUMAN_GOVERNANCE'));
  assert.throws(() =>
    createIssuanceProposal({
      proposalId: 'p2',
      asset: 'SUNREY_COIN',
      amount: 1n,
      basis: 'TEST',
      inputReferences: [],
      valuationMethodology: 'none',
      policyVersion: 'v1',
      book,
      network: 'DEVELOPMENT',
      aiAttemptedApproval: true,
    }),
  );
});

test('simulation output cannot become production configuration', () => {
  const output = runIsolatedEconomicSimulation({
    events: [{ kind: 'ISSUE_SUNREY', account: 'sim', quantity: 5n, replay: 'sim-1' }],
  });
  assert.equal(output.classification, 'ENGINEERING_SIMULATION');
  assert.equal(output.becomesProductionConfiguration, false);
  assert.equal(simulationCannotAuthorizeProduction(output, 'MAINNET'), true);
});

test('read-only supply API and Lovable contract do not fabricate metrics or expose mint', () => {
  const authority = new ProtocolNativeSupplyAuthority();
  runSunReyIssuancePipeline(authority, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct',
    quantity: 7n,
    replayIdentifier: 'api',
    contributionVerified: true,
  });
  const api = publicSupplyApi(authority);
  assert.equal(api.privilegedIssuanceEndpoints.length, 0);
  assert.equal(api.assets[0]?.supply.circulatingSupply, '7');
  assert.equal(api.assets[0]?.privilegedIssuanceExposed, false);
  const lovable = lovableNativeEconomyContract({
    authority,
    sunreyMarketPrice: { lastTradeMinorUnits: '100', quoteAsset: 'USD' },
  });
  assert.equal(lovable.sunrey.protocolNative, true);
  assert.equal(lovable.moonrey.protocolNative, true);
  assert.equal(lovable.sunrey.hinMetrics.available, false);
  assert.equal(lovable.moonrey.approvedUnderlyingMetrics.length, 0);
  assert.ok(lovable.moonrey.productiveCategories.every((row) => row.connected === false));
  assert.equal(lovable.valuationIsNotMarketPrice, true);
  assert.equal(lovable.sunrey.marketPrice.available, true);
  assert.equal(lovable.moonrey.marketPrice.available, false);
});

test('Agent contract allows reads and forbids mint, burn, policy, and future price', () => {
  assert.equal(AGENT_NATIVE_ECONOMY_PERMISSIONS.mayMint, false);
  assert.equal(authorizeAgentNativeEconomyAction('READ_SUPPLY').ok, true);
  assert.equal(authorizeAgentNativeEconomyAction('MINT').ok, false);
  assert.equal(authorizeAgentNativeEconomyAction('BURN').ok, false);
  assert.equal(authorizeAgentNativeEconomyAction('MODIFY_POLICY').ok, false);
  assert.equal(authorizeAgentNativeEconomyAction('CHANGE_SUPPLY').ok, false);
  assert.equal(authorizeAgentNativeEconomyAction('DECLARE_FUTURE_PRICE').ok, false);
});

test('application and native supplies stay unbridged', () => {
  const boundary = nativeAssetAuthorityBoundary();
  assert.equal(boundary.applicationSupplyImported, false);
  assert.equal(boundary.productionMigrationPerformed, false);
  const draft = developmentSunReyAuthority({
    recipient: 'acct',
    quantity: 1n,
    replayIdentifier: 'boundary',
  });
  assert.equal(draft.assetId, 'SUNREY_COIN');
});
