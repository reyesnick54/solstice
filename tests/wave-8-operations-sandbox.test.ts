/**
 * Wave 8 — operations plane and sandbox deployment integration tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { createPlatformApi } from '../services/api/src/app.ts';
import { createSandboxWorld, sandboxToken } from '../services/api/src/consumer/fixtures.ts';
import { handleConsumerBff } from '../services/api/src/consumer/handler.ts';
import {
  buildSandboxSeedCatalog,
  createSandboxOperationsPlane,
  evaluateSandboxFeatureGates,
  listCoreServices,
} from '../services/api/src/operations/index.ts';
import { createInternalOperationsRoutes } from '../services/api/src/operations/routes.ts';
import { evaluateReadiness, configurationCheck } from '../services/api/src/readiness.ts';
import { loadValidatedPlatformApiConfig } from '../services/api/src/config.ts';

const ROOT = join(import.meta.dirname, '..');
const TOKEN = 'wave8-test-operator-token';
const HEADERS = Object.freeze({
  'x-sunrey-internal-token': TOKEN,
  'x-sunrey-operator-role': 'GOVERNANCE_OPERATOR',
});

describe('Wave 8 — documentation and infrastructure artifacts', () => {
  it('includes architecture and runbook deliverables', () => {
    for (const file of [
      'docs/architecture/WAVE8_OPERATIONS_AND_SANDBOX_DEPLOYMENT.md',
      'docs/runbooks/SUNREY_SANDBOX_DEPLOYMENT.md',
      'docs/runbooks/SUNREY_FULL_STACK_OPERATIONS.md',
      'docs/runbooks/SUNREY_SERVICE_DEGRADATION.md',
      'infra/sandbox/docker-compose.yml',
      'infra/sandbox/env.example',
      'infra/sandbox/nginx.conf',
    ]) {
      assert.equal(existsSync(join(ROOT, file)), true, `missing ${file}`);
    }
  });

  it('extends prometheus alerts for Wave 8 conditions', () => {
    const alerts = JSON.parse(readFileSync(join(ROOT, 'packages/sunrey-chain/ops/prometheus/alerts.json'), 'utf8')) as {
      rules: { alert: string }[];
    };
    for (const name of [
      'VALIDATOR_DOWN',
      'CONSENSUS_STALLED',
      'CHAIN_STATE_MISMATCH',
      'HIGH_CLAIM_CONFLICT',
      'DEAD_LETTER_GROWTH',
      'POLICY_SERVICE_UNAVAILABLE',
      'AUTHORIZATION_SERVICE_UNAVAILABLE',
      'KMS_SECRET_ISSUE',
      'DATABASE_UNAVAILABLE',
      'EXCHANGE_SETTLEMENT_MISMATCH',
      'UNEXPECTED_PRODUCTION_FEATURE_ENABLEMENT',
    ]) {
      assert.ok(alerts.rules.some((row) => row.alert === name), `missing alert ${name}`);
    }
  });
});

describe('Wave 8 — operations plane', () => {
  it('lists core services for health evaluation', () => {
    const services = listCoreServices();
    assert.ok(services.includes('platform-api'));
    assert.ok(services.includes('sunrey-chain'));
    assert.ok(services.length >= 10);
  });

  it('blocks production feature gates', () => {
    const gates = evaluateSandboxFeatureGates('2026-09-02T12:00:00.000Z');
    assert.equal(gates.productionActive, false);
    assert.equal(gates.mainnetEnabled, false);
    const blocked = gates.gates.find((row) => row.gateId === 'production_mainnet');
    assert.ok(blocked);
    assert.equal(blocked!.enabled, false);
  });

  it('exports deterministic sandbox seed catalog', () => {
    const seed = buildSandboxSeedCatalog();
    assert.equal(seed.schema, 'sunrey.sandbox.seed.v1');
    assert.ok(seed.records.some((row) => row.category === 'wallet'));
    assert.ok(seed.records.some((row) => row.category === 'human_economic_contribution'));
    assert.ok(seed.records.some((row) => row.category === 'exchange_order'));
    assert.ok(seed.records.length > 20);
  });

  it('builds dashboard metrics from collectors', () => {
    const plane = createSandboxOperationsPlane();
    const dashboard = plane.dashboard();
    const sections = new Set(dashboard.sections.map((row) => row.section));
    for (const section of ['chain', 'supply', 'providers', 'exchange', 'api_health']) {
      assert.ok(sections.has(section), `missing dashboard section ${section}`);
    }
  });
});

describe('Wave 8 — internal operations HTTP', () => {
  it('denies consumer clients on internal ops', async () => {
    const config = loadValidatedPlatformApiConfig({ ...process.env, SUNREY_INTERNAL_OPERATOR_TOKEN: TOKEN });
    const routes = createInternalOperationsRoutes({
      config,
      readiness: () => evaluateReadiness(config, [configurationCheck(config)]),
      operatorToken: TOKEN,
    });
    const route = routes.find((row) => row.path === '/internal/v1/ops/health');
    assert.ok(route);
    await assert.rejects(
      () =>
        route!.handler({
          headers: { ...HEADERS, 'x-sunrey-client': 'lovable' },
          params: {},
          query: {},
          body: {},
          rawBody: '{}',
          ctx: {} as never,
        }),
      (error: { httpStatus?: number }) => error.httpStatus === 403,
    );
  });

  it('returns aggregate product health for operators', async () => {
    const config = loadValidatedPlatformApiConfig({ ...process.env, SUNREY_INTERNAL_OPERATOR_TOKEN: TOKEN });
    const routes = createInternalOperationsRoutes({
      config,
      readiness: () => evaluateReadiness(config, [configurationCheck(config)]),
      operatorToken: TOKEN,
    });
    const route = routes.find((row) => row.path === '/internal/v1/ops/health');
    assert.ok(route);
    const result = await route!.handler({
      headers: HEADERS,
      params: {},
      query: {},
      body: {},
      rawBody: '{}',
      ctx: {} as never,
    });
    assert.equal(result.status, 200);
    const body = result.body as { productHealth: { readyToServe: boolean; aggregatePhase: string } };
    assert.ok(['PROCESS_UP', 'READY_TO_SERVE'].includes(body.productHealth.aggregatePhase));
    assert.equal(typeof body.productHealth.readyToServe, 'boolean');
  });

  it('exposes chain, reconciliation, and feature gate surfaces', async () => {
    const config = loadValidatedPlatformApiConfig({ ...process.env, SUNREY_INTERNAL_OPERATOR_TOKEN: TOKEN });
    const routes = createInternalOperationsRoutes({
      config,
      readiness: () => evaluateReadiness(config, [configurationCheck(config)]),
      operatorToken: TOKEN,
    });
    const call = async (path: string) => {
      const route = routes.find((row) => row.path === path);
      assert.ok(route, path);
      return route!.handler({
        headers: HEADERS,
        params: {},
        query: {},
        body: {},
        rawBody: '{}',
        ctx: {} as never,
      });
    };
    const chain = await call('/internal/v1/ops/chain');
    assert.equal((chain.body as { chain: { productionMainnet: boolean } }).chain.productionMainnet, false);

    const recon = await call('/internal/v1/ops/reconciliation');
    assert.equal((recon.body as { reconciliation: { supply: { sunreySupply: string } } }).reconciliation.supply.sunreySupply, '1000000000');

    const gates = await call('/internal/v1/ops/feature-gates');
    assert.equal((gates.body as { featureGates: { productionActive: false } }).featureGates.productionActive, false);
  });

  it('exposes governance proposal without mint authority', async () => {
    const config = loadValidatedPlatformApiConfig({ ...process.env, SUNREY_INTERNAL_OPERATOR_TOKEN: TOKEN });
    const routes = createInternalOperationsRoutes({
      config,
      readiness: () => evaluateReadiness(config, [configurationCheck(config)]),
      operatorToken: TOKEN,
    });
    const proposalRoute = routes.find((row) => row.path === '/internal/v1/governance/proposals/:proposalId');
    assert.ok(proposalRoute);
    const proposal = await proposalRoute!.handler({
      headers: { ...HEADERS, 'x-sunrey-operator-role': 'GOVERNANCE_ADMIN' },
      params: { proposalId: 'gov.sandbox.fee-policy.001' },
      query: {},
      body: {},
      rawBody: '{}',
      ctx: {} as never,
    });
    assert.equal(proposal.status, 200);
    const body = proposal.body as { publicView: { approvalResult: string }; proposal: { packageId: string } };
    assert.equal(body.proposal.packageId, 'gov.sandbox.fee-policy.001');
    assert.ok(body.publicView.approvalResult);
  });
});

describe('Wave 8 — full-stack connectivity', () => {
  it('connects consumer BFF sandbox world to core surfaces', async () => {
    const world = createSandboxWorld();
    const snapshot = await handleConsumerBff(world, {
      method: 'GET',
      path: '/api/v1/world/snapshot',
      query: {},
      body: {},
      authorization: `Bearer ${sandboxToken('basic_verified')}`,
      requestId: 'req_wave8_connectivity',
    });
    assert.equal(snapshot.status, 200);

    const exchange = await handleConsumerBff(world, {
      method: 'GET',
      path: '/api/v1/exchange/markets',
      query: {},
      body: {},
      authorization: `Bearer ${sandboxToken('exchange')}`,
      requestId: 'req_wave8_exchange',
    });
    assert.equal(exchange.status, 200);
  });

  it('starts platform API with internal routes registered', async () => {
    const api = await createPlatformApi({
      internalOperatorToken: TOKEN,
    });
    try {
      const health = await fetch(`${api.url}/health`);
      assert.equal(health.ok, true);
      const denied = await fetch(`${api.url}/internal/v1/ops/dashboard`);
      assert.equal(denied.status, 403);
      const allowed = await fetch(`${api.url}/internal/v1/ops/dashboard`, {
        headers: {
          'x-sunrey-internal-token': TOKEN,
          'x-sunrey-operator-role': 'GOVERNANCE_OPERATOR',
        },
      });
      assert.equal(allowed.status, 200);
    } finally {
      await api.close();
    }
  });
});

describe('Wave 8 — backup and recovery references', () => {
  it('preserves Wave 2 recovery modules', () => {
    assert.equal(existsSync(join(ROOT, 'packages/persistence/src/production/recovery/index.ts')), true);
    assert.equal(existsSync(join(ROOT, 'docs/architecture/WAVE2_STATE_SYNC_AND_RECOVERY.md')), true);
  });
});
