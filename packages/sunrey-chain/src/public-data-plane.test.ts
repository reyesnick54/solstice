import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../config/src/flags.ts';
import { authorizeNetworkPath } from './infra/network.ts';
import {
  ArchiveQueryService,
  ExplorerIndexerFleet,
  ExplorerQueryApi,
  PublicRpcGateway,
  RpcAbuseProtection,
  RpcRateLimitPolicyEngine,
  RpcRequestPolicyEngine,
  apiKeyCannotAuthorizeFinancialAction,
  containsForbiddenPublicField,
  createPublicDataPlaneReport,
  developerApiKey,
  exerciseFailureScenarios,
  fixtureEndpoint,
  humanInformationPublicProjection,
  localDevnetGatewayMode,
  publicRpcCannotReach,
  recordLoadBenchmark,
  runPublicDataPlaneCommand,
  stripPrivatePublicSurface,
  testnetGatewayLabel,
  RpcEndpointPool,
} from './public-data-plane/index.ts';
import type { RpcClientIdentity, RpcRequest } from './public-data-plane/types.ts';

const anon: RpcClientIdentity = {
  kind: 'ANONYMOUS',
  networkIdentity: '198.51.100.10',
  apiKeyId: null,
  grantsFinancialAuthority: false,
};

function request(partial: Partial<RpcRequest> & Pick<RpcRequest, 'method' | 'requestClass'>): RpcRequest {
  return {
    requestId: 'req_1',
    path: '/v1/chain/status',
    identity: anon,
    payloadBytes: 32,
    costUnits: 1,
    requiresArchive: false,
    mutationEligibility: false,
    nowUtc: '2026-08-18T00:00:00.000Z',
    ...partial,
  };
}

describe('Chunk 93 public data plane', () => {
  it('keeps simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
  });

  it('classifies request classes and costs archive higher', () => {
    const policy = new RpcRequestPolicyEngine();
    assert.equal(policy.classify('chain.status', '/v1/chain/status'), 'PUBLIC_READ');
    assert.equal(policy.classify('tx.submit', '/v1/transactions'), 'TRANSACTION_SUBMISSION');
    assert.equal(policy.classify('subscribe', '/v1/events'), 'SUBSCRIPTION');
    assert.equal(policy.classify('archive.scan', '/v1/archive/scan'), 'ARCHIVE_QUERY');
    assert.equal(policy.classify('operator.produceBlock', '/operator/v1/produce-block'), 'OPERATOR_AUTHENTICATED');
    assert.ok(policy.costUnits('archive.scan') > policy.costUnits('chain.status'));
    assert.equal(policy.allowsOperatorMethodOnPublicGateway('operator.produceBlock'), false);
  });

  it('rate limits by identity, class, method, and cost units', () => {
    const limiter = new RpcRateLimitPolicyEngine();
    const req = request({ method: 'chain.status', requestClass: 'PUBLIC_READ' });
    let last = limiter.consume({ request: req, limit: 2, nowMs: 1 });
    last = limiter.consume({ request: req, limit: 2, nowMs: 1 });
    last = limiter.consume({ request: req, limit: 2, nowMs: 1 });
    assert.equal(last.allowed, false);
    limiter.mergeRemote(last.identity, 9, 9, 60_001);
    assert.equal(limiter.policy.distributedSafe, true);
  });

  it('rejects oversized payloads, invalid tx floods, and operator methods', () => {
    const abuse = new RpcAbuseProtection({ maxPayloadBytes: 64, maxInvalidTxPerMinute: 2 });
    const oversized = abuse.inspect({
      request: request({ method: 'chain.status', requestClass: 'PUBLIC_READ', payloadBytes: 128 }),
      containsPrivateKey: false,
      invalidTransaction: false,
      nowMs: 1,
      quota: { anonymousRequestsPerMinute: 30, apiKeyRequestsPerMinute: 300, maxCostUnitsPerMinute: 100, maxSubscriptionsPerIdentity: 8, maxConnectionsPerIdentity: 16 },
    });
    assert.equal(oversized.reason, 'OVERSIZED_PAYLOAD');
    const operator = abuse.inspect({
      request: request({ method: 'operator.produceBlock', requestClass: 'OPERATOR_AUTHENTICATED' }),
      containsPrivateKey: false,
      invalidTransaction: false,
      nowMs: 1,
      quota: { anonymousRequestsPerMinute: 30, apiKeyRequestsPerMinute: 300, maxCostUnitsPerMinute: 100, maxSubscriptionsPerIdentity: 8, maxConnectionsPerIdentity: 16 },
    });
    assert.equal(operator.reason, 'OPERATOR_METHOD_FORBIDDEN');
    const quota = { anonymousRequestsPerMinute: 30, apiKeyRequestsPerMinute: 300, maxCostUnitsPerMinute: 100, maxSubscriptionsPerIdentity: 8, maxConnectionsPerIdentity: 16 };
    assert.equal(abuse.inspect({ request: request({ method: 'tx.submit', requestClass: 'TRANSACTION_SUBMISSION' }), containsPrivateKey: false, invalidTransaction: true, nowMs: 1, quota }).allowed, true);
    assert.equal(abuse.inspect({ request: request({ method: 'tx.submit', requestClass: 'TRANSACTION_SUBMISSION' }), containsPrivateKey: false, invalidTransaction: true, nowMs: 1, quota }).allowed, true);
    assert.equal(abuse.inspect({ request: request({ method: 'tx.submit', requestClass: 'TRANSACTION_SUBMISSION' }), containsPrivateKey: false, invalidTransaction: true, nowMs: 1, quota }).reason, 'INVALID_TX_FLOOD');
  });

  it('excludes stale nodes from mutation-eligibility and submission', () => {
    const gateway = new PublicRpcGateway({
      pool: new RpcEndpointPool([fixtureEndpoint('stale', 'STALE', 8, 40, 1, false)]),
    });
    const result = gateway.handle({
      requestId: 'stale_tx',
      method: 'tx.submit',
      path: '/v1/transactions',
      identity: anon,
      payload: { signedBytes: 'aa', transactionId: 'tx_stale_1' },
      mutationEligibility: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'STALE_NODE_EXCLUDED');
  });

  it('submits signed bytes without treating mempool acceptance as finality', () => {
    const gateway = new PublicRpcGateway();
    const first = gateway.submit({ signedBytes: 'deadbeef', transactionId: 'tx_dup' });
    const second = gateway.submit({ signedBytes: 'deadbeef', transactionId: 'tx_dup' });
    assert.equal(first.state, 'ACCEPTED_FOR_MEMPOOL');
    assert.equal(first.finalized, false);
    assert.equal(first.mempoolAcceptanceIsFinality, false);
    assert.equal(second.state, 'ACCEPTED_FOR_MEMPOOL');
    const status = gateway.finality('tx_dup');
    assert.equal(status.finalized, false);
    assert.equal(status.state, 'IN_MEMPOOL');
    const finalized = gateway.finalize('tx_dup', 'block_1', 12);
    assert.equal(finalized.finalized, true);
    assert.equal(finalized.state, 'FINALIZED');
  });

  it('cannot reach signer or validator admin from PUBLIC_RPC', () => {
    const gateway = new PublicRpcGateway();
    assert.deepEqual(gateway.assertNoSignerAccess(), { ok: false, code: 'PUBLIC_RPC_CANNOT_REACH_SIGNER' });
    assert.equal(authorizeNetworkPath('PUBLIC_RPC', 'SIGNER_PRIVATE').ok, false);
    assert.equal(authorizeNetworkPath('PUBLIC_RPC', 'VALIDATOR_PRIVATE').ok, false);
    assert.equal(publicRpcCannotReach('SIGNER_PRIVATE'), true);
    assert.equal(publicRpcCannotReach('VALIDATOR_PRIVATE'), true);
  });

  it('bounds subscriptions and keeps archive off the validator path', () => {
    const gateway = new PublicRpcGateway();
    for (let index = 0; index < 8; index += 1) {
      const opened = gateway.subscriptions.open({ identity: 'user-a', topic: 'NEW_FINALIZED_BLOCK' });
      assert.ok(!('error' in opened));
    }
    const overflow = gateway.subscriptions.open({ identity: 'user-a', topic: 'GOVERNANCE_EVENT' });
    assert.deepEqual(overflow, { ok: false, error: 'SUBSCRIPTION_EXHAUSTED' });
    const delivered = gateway.subscriptions.publish('NEW_FINALIZED_BLOCK', { height: 1 });
    assert.ok(delivered.length > 0);
    const archive = new ArchiveQueryService();
    const result = archive.query({ fromHeight: 0, toHeight: 3, scan: true });
    assert.equal(result.ok, true);
    assert.equal(result.signingAuthority, false);
    assert.equal(result.onValidatorCriticalPath, false);
    archive.setAvailable(false);
    assert.equal(archive.query({ fromHeight: 0, toHeight: 1, scan: false }).error, 'ARCHIVE_UNAVAILABLE');
  });

  it('rebuilds a corrupt Explorer from canonical chain and fails over', () => {
    const fleet = new ExplorerIndexerFleet();
    fleet.add('idx-a', 'rpc-a');
    fleet.add('idx-b', 'rpc-b');
    assert.equal(fleet.compare().diverged, false);
    fleet.markCorrupt('idx-a');
    assert.equal(fleet.verify('idx-a').ok, false);
    const rebuilt = fleet.rebuild('idx-a');
    assert.equal(rebuilt.health, 'HEALTHY');
    assert.equal(fleet.verify('idx-a').ok, true);
    fleet.markLag('idx-a', 6);
    const api = new ExplorerQueryApi(fleet);
    const ha = api.haState();
    assert.equal(ha.canonicalChainIsSourceOfTruth, true);
    assert.equal(ha.failoverAvailable, true);
    assert.equal(ha.activeIndexerId, 'idx-b');
    assert.ok(Array.isArray(api.query('blocks')));
  });

  it('strips private fields and keeps API keys from granting financial authority', () => {
    const leaked = {
      height: 4,
      kycRecord: { name: 'hidden' },
      pdvRaw: 'secret',
      privateCase: { id: 'case' },
      providerCredential: 'token',
      custodyPrivateMetadata: {},
      restrictedSecurityEvidence: {},
    };
    const publicView = stripPrivatePublicSurface(leaked);
    assert.equal(publicView.height, 4);
    assert.equal('kycRecord' in publicView, false);
    assert.equal(containsForbiddenPublicField(leaked), true);
    const human = humanInformationPublicProjection({
      rightId: 'right_1',
      attestationHash: 'att_1',
      kycRecord: 'no',
    });
    assert.deepEqual(human, { rightId: 'right_1', attestationHash: 'att_1' });
    const key = developerApiKey('dev_1', 4);
    assert.equal(apiKeyCannotAuthorizeFinancialAction(key), true);
    const gateway = new PublicRpcGateway();
    gateway.registerApiKey({ ...key, canAuthorizeCustody: true } as unknown as typeof key);
    const denied = gateway.handle({
      requestId: 'key_1',
      method: 'chain.status',
      path: '/v1/chain/status',
      identity: { kind: 'API_KEY', networkIdentity: '203.0.113.2', apiKeyId: 'dev_1', grantsFinancialAuthority: false },
    });
    assert.equal(denied.error, 'API_KEY_NO_FINANCIAL_AUTHORITY');
  });

  it('records load, failure scenarios, and labeled environments', () => {
    const load = recordLoadBenchmark('SIMULATION');
    assert.ok(load.rpcReadsPerSecond > 0);
    assert.ok(load.explorerQueriesPerSecond > 0);
    const failures = exerciseFailureScenarios();
    assert.equal(failures.multipleRpcDown, true);
    assert.equal(failures.staleExcluded, true);
    assert.equal(failures.subscriptionSurgeBounded, true);
    assert.equal(failures.archiveUnavailable, true);
    assert.equal(localDevnetGatewayMode().environmentLabel, 'LOCAL_DEVNET');
    assert.equal(testnetGatewayLabel().environmentLabel, 'SUNREY_TESTNET');
    assert.equal(testnetGatewayLabel().sameApiShape, true);
    const report = createPublicDataPlaneReport();
    assert.equal(report.secondConsensus, false);
    assert.equal(report.secondLedger, false);
    assert.equal(report.explorerAuthoritative, false);
    assert.equal(report.publicValidatorAdminExposed, false);
    assert.equal(report.network.privateOperationalDetails, false);
    assert.equal(report.environment, 'simulation');
  });

  it('exposes sunrey-ops rpc and explorer commands', () => {
    for (const command of [
      ['rpc', 'status'],
      ['rpc', 'endpoints'],
      ['rpc', 'limits'],
      ['rpc', 'health'],
      ['explorer', 'status'],
      ['explorer', 'lag'],
      ['explorer', 'rebuild'],
      ['explorer', 'verify'],
    ] as const) {
      const viaModule = runPublicDataPlaneCommand(command);
      assert.equal(viaModule.ok, true, viaModule.command);
    }
    const health = runPublicDataPlaneCommand(['rpc', 'health']);
    assert.deepEqual((health.payload as { signer: { code: string } }).signer.code, 'PUBLIC_RPC_CANNOT_REACH_SIGNER');
  });
});
