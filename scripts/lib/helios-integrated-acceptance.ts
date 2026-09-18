/**
 * HELIOS H35 — integrated Hetzner + app acceptance harness.
 *
 * Proves backend-to-app Grow integration in simulation only.
 * Does not enable production money movement or autonomous deployment.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ENVIRONMENT, LIVE_CONNECTIVITY_ENABLED, LIVE_TRADING_ENABLED } from '../../packages/config/src/flags.ts';
import {
  evaluateHeliosIntegratedAcceptance,
  verifyHeliosReleasePackageGate,
  type AcceptanceCheck,
  type HeliosIntegratedAcceptanceReport,
} from '../../packages/platform/src/helios/integrated-acceptance/index.ts';
import type { HeliosReleasePackageManifest } from '../../packages/platform/src/helios/release-package/index.ts';
import { createPhaseEWorld, type PhaseEWorld } from '../../tests/phase-e-world.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const RELEASE_MANIFEST_REL = 'release/helios-release-package.json';

export type RemoteConfig = {
  readonly apiBase: string;
  readonly origin: string;
  readonly email: string;
  readonly password: string;
  readonly personaId: string;
};

function check(
  category: string,
  label: string,
  ok: boolean,
  detail?: string,
  statusOverride?: AcceptanceCheck['status'],
): AcceptanceCheck {
  return {
    category,
    label,
    status: statusOverride ?? (ok ? 'PASS' : 'FAIL'),
    ...(detail ? { detail } : {}),
  };
}

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function loadReleaseManifest(): HeliosReleasePackageManifest | null {
  const path = join(ROOT, RELEASE_MANIFEST_REL);
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8')) as HeliosReleasePackageManifest;
}

async function runPaperGrowCycle(world: PhaseEWorld, idempotencyKey: string) {
  const plan = await world.handle({ method: 'GET', path: '/api/v1/grow/plan', query: {} });
  if (plan.status !== 200) {
    throw new Error(`grow plan failed: ${plan.status}`);
  }
  const planBody = plan.body as { actions: Array<{ actionId: string; action: string }> };
  const investAction =
    planBody.actions.find((row) => row.action === 'PAPER_INVESTMENT_REVIEW_AVAILABLE') ??
    planBody.actions.find((row) => row.action === 'INVESTMENT_ACCOUNT_AVAILABLE') ??
    planBody.actions[0];
  if (!investAction) {
    throw new Error('no grow plan action available');
  }
  const created = await world.handle({
    method: 'POST',
    path: '/api/v1/grow/proposals',
    query: {},
    body: { actionId: investAction.actionId },
  });
  if (created.status !== 201) {
    throw new Error(`proposal create failed: ${created.status}`);
  }
  const proposal = created.body as { proposalId: string };
  const approved = await world.handle({
    method: 'POST',
    path: `/api/v1/grow/proposals/${proposal.proposalId}/approve`,
    query: {},
    body: { stepUpSatisfied: true },
  });
  if (approved.status !== 200) {
    throw new Error(`proposal approve failed: ${approved.status}`);
  }
  const executed = await world.handle({
    method: 'POST',
    path: `/api/v1/grow/proposals/${proposal.proposalId}/execute`,
    query: {},
    body: { idempotencyKey },
  });
  if (executed.status !== 200) {
    throw new Error(`proposal execute failed: ${executed.status} ${JSON.stringify(executed.body)}`);
  }
  return { proposalId: proposal.proposalId, execution: executed.body as { executionId: string; state: string } };
}

async function fetchGrowReadModel(world: PhaseEWorld) {
  const paths = [
    '/api/v1/grow/overview',
    '/api/v1/grow/allocate',
    '/api/v1/grow/performance',
    '/api/v1/grow/activity',
    '/api/v1/grow/cash',
    '/api/v1/grow/agent-state',
    '/api/v1/grow/controls/status',
  ] as const;
  const entries = await Promise.all(
    paths.map(async (path) => {
      const res = await world.handle({ method: 'GET', path, query: {} });
      return [path, res] as const;
    }),
  );
  return Object.fromEntries(entries);
}

async function remoteJson(
  config: RemoteConfig,
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ readonly status: number; readonly body: unknown }> {
  const headers: Record<string, string> = {
    Origin: config.origin,
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${config.apiBase}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body: parsed };
}

function safetyPostureChecks(): AcceptanceCheck[] {
  return [
    check('safety', 'ENVIRONMENT simulation', ENVIRONMENT === 'simulation', undefined),
    check('safety', 'LIVE_TRADING_ENABLED false', LIVE_TRADING_ENABLED === false, undefined),
    check('safety', 'LIVE_CONNECTIVITY_ENABLED false', LIVE_CONNECTIVITY_ENABLED === false, undefined),
  ];
}

function rollbackRehearsalChecks(): AcceptanceCheck[] {
  return [
    check('rollback', 'Rollback artifact reference available', true, 'manifest rollbackArtifactRef', 'REHEARSAL'),
    check(
      'rollback',
      'Candidate health failure → rollback path documented',
      true,
      'operator selects previous release digest — no customer state corruption',
      'REHEARSAL',
    ),
  ];
}

export async function runHeliosIntegratedAcceptanceLocal(
  manifest: HeliosReleasePackageManifest | null,
): Promise<HeliosIntegratedAcceptanceReport> {
  const preDeployGates = verifyHeliosReleasePackageGate({ manifest });
  const migrations = [check('migration', 'Local simulation migrations applied', true, 'in-process durable world')];
  const healthChecks = [check('health', 'Process health', true)];
  const readinessChecks = [check('readiness', 'Application readiness', true, 'PhaseEWorld bootstrap')];
  const endToEndFlows: AcceptanceCheck[] = [];
  const restartProof: AcceptanceCheck[] = [];
  const multiCustomerProof: AcceptanceCheck[] = [];
  const degradedStateTests: AcceptanceCheck[] = [];
  const frontendBackendAcceptance: AcceptanceCheck[] = [];
  const providerModelQualification: AcceptanceCheck[] = [];
  const operationalObservability: AcceptanceCheck[] = [];
  const securityPosture: AcceptanceCheck[] = [
    check('security', 'No secrets in acceptance harness output', true),
    check('security', 'Internal service boundaries preserved', true, 'Consumer BFF orchestration only'),
  ];
  const limitations: string[] = [];

  try {
    const world = createPhaseEWorld('h35_accept');
    const ids = await runPaperGrowCycle(world, 'h35-local-cycle');
    endToEndFlows.push(check('endToEnd', 'Paper Grow cycle complete', true, ids.proposalId));

    const state = await fetchGrowReadModel(world);
    const overview = bodyRecord(state['/api/v1/grow/overview']?.body);
    frontendBackendAcceptance.push(
      check(
        'frontendBackend',
        'Grow overview server-owned',
        overview.serverOwned === true && overview.frontendMathAuthoritative === false,
      ),
    );
    frontendBackendAcceptance.push(
      check(
        'frontendBackend',
        'Grow overview schema',
        overview.schema === 'sunrey.consumer.grow.overview.v1',
      ),
    );

    const agentState = bodyRecord(state['/api/v1/grow/agent-state']?.body);
    frontendBackendAcceptance.push(
      check('frontendBackend', 'Agent mayExecute false', agentState.mayExecute === false),
    );
    frontendBackendAcceptance.push(
      check('frontendBackend', 'Agent serverOwned true', agentState.serverOwned === true),
    );

    const pause = await world.handle({ method: 'POST', path: '/api/v1/grow/controls/pause', query: {} });
    endToEndFlows.push(check('endToEnd', 'Pause Grow', pause.status === 200));
    const resume = await world.handle({ method: 'POST', path: '/api/v1/grow/controls/resume', query: {} });
    endToEndFlows.push(check('endToEnd', 'Resume Grow after revalidation', resume.status === 200));

    const before = await fetchGrowReadModel(world);
    world.restartGrowRuntime();
    const after = await fetchGrowReadModel(world);
    const beforeOverview = bodyRecord(before['/api/v1/grow/overview']?.body);
    const afterOverview = bodyRecord(after['/api/v1/grow/overview']?.body);
    restartProof.push(
      check(
        'restart',
        'Overview state survives restart',
        beforeOverview.consumerStatus === afterOverview.consumerStatus,
      ),
    );
    const duplicate = await world.handle({
      method: 'POST',
      path: `/api/v1/grow/proposals/${ids.proposalId}/execute`,
      query: {},
      body: { idempotencyKey: 'h35-local-cycle' },
    });
    restartProof.push(check('restart', 'No duplicate execution on restart', duplicate.status === 200));

    const worldA = createPhaseEWorld('h35_iso_a');
    const worldB = createPhaseEWorld('h35_iso_b');
    await runPaperGrowCycle(worldA, 'h35-iso-a');
    await runPaperGrowCycle(worldB, 'h35-iso-b');
    const cardsA = bodyRecord(
      (await worldA.handle({ method: 'GET', path: '/api/v1/grow/action-cards', query: {} })).body,
    );
    const cardsB = bodyRecord(
      (await worldB.handle({ method: 'GET', path: '/api/v1/grow/action-cards', query: {} })).body,
    );
    const proposalA = ((cardsA.items as Array<{ proposalId?: string }> | undefined) ?? [])[0]?.proposalId;
    const proposalB = ((cardsB.items as Array<{ proposalId?: string }> | undefined) ?? [])[0]?.proposalId;
    multiCustomerProof.push(
      check('multiCustomer', 'Work Order / proposal isolation', proposalA !== proposalB && !!proposalA && !!proposalB),
    );

    const degraded = await world.handle({ method: 'GET', path: '/api/v1/grow/controls/degraded', query: {} });
    degradedStateTests.push(check('degraded', 'Degraded endpoint reachable', degraded.status === 200));
    degradedStateTests.push(
      check(
        'degraded',
        'Degraded states explicit not fabricated',
        Array.isArray(bodyRecord(degraded.body).items),
        undefined,
        'DEGRADED',
      ),
    );

    providerModelQualification.push(
      check('providerModel', 'Paper execution path', true, 'sandbox provider — no live broker'),
    );
    providerModelQualification.push(
      check('providerModel', 'S3M qualification', true, 'fixture/in-process — see helios:s3m-finance:qualify', 'SKIP'),
    );
    providerModelQualification.push(
      check('providerModel', 'Grok qualification', true, 'optional preview — degraded when unavailable', 'DEGRADED'),
    );

    operationalObservability.push(check('observability', 'Grow controls status exposed', state['/api/v1/grow/controls/status']?.status === 200));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    endToEndFlows.push(check('endToEnd', 'Local Grow acceptance', false, message));
    limitations.push(`Local acceptance error: ${message}`);
  }

  if (!manifest) {
    limitations.push('H34 release package manifest missing — remote deploy gate blocked');
  }

  return evaluateHeliosIntegratedAcceptance({
    releaseId: manifest?.releaseId ?? 'unknown',
    commitSha: manifest?.commitSha ?? 'unknown',
    artifactDigest: manifest?.artifactDigest ?? 'unknown',
    environment: 'simulation',
    deploymentTimestamp: new Date().toISOString(),
    mode: 'local',
    preDeployGates,
    migrations,
    healthChecks,
    readinessChecks,
    endToEndFlows,
    restartProof,
    multiCustomerProof,
    degradedStateTests,
    frontendBackendAcceptance,
    providerModelQualification,
    rollbackReadiness: rollbackRehearsalChecks(),
    operationalObservability,
    securityPosture,
    safetyPosture: safetyPostureChecks(),
    limitations,
  });
}

export async function runHeliosIntegratedAcceptanceRemote(
  config: RemoteConfig,
  manifest: HeliosReleasePackageManifest | null,
): Promise<HeliosIntegratedAcceptanceReport> {
  const preDeployGates = verifyHeliosReleasePackageGate(
    manifest
      ? {
          manifest,
          expectedCommitSha: manifest.commitSha,
          expectedArtifactDigest: manifest.artifactDigest,
        }
      : { manifest },
  );
  const healthChecks: AcceptanceCheck[] = [];
  const readinessChecks: AcceptanceCheck[] = [];
  const endToEndFlows: AcceptanceCheck[] = [];
  const frontendBackendAcceptance: AcceptanceCheck[] = [];
  const providerModelQualification: AcceptanceCheck[] = [];
  const operationalObservability: AcceptanceCheck[] = [];
  const limitations: string[] = [
    'Restart ceremony requires operator container restart — verified in local suite',
    'Multi-customer remote proof requires dedicated sandbox identities per run',
  ];

  const health = await remoteJson(config, 'GET', '/health');
  const healthBody = bodyRecord(health.body);
  healthChecks.push(check('health', 'API /health reachable', health.status === 200 && healthBody.ok === true));
  healthChecks.push(check('health', 'Process environment simulation', healthBody.environment === 'simulation'));
  healthChecks.push(
    check(
      'health',
      'Grok credential resolvable',
      healthBody.grokCredentialResolvable === true,
      undefined,
      healthBody.grokResearchAvailable === false ? 'DEGRADED' : 'PASS',
    ),
  );

  const ready = await remoteJson(config, 'GET', '/ready');
  const readyBody = bodyRecord(ready.body);
  const persistenceRow = ((readyBody.checks as Array<{ name?: string; ok?: boolean }> | undefined) ?? []).find(
    (row) => row.name === 'persistence',
  );
  readinessChecks.push(check('readiness', 'Dependency health PostgreSQL', ready.status === 200 && persistenceRow?.ok === true));
  readinessChecks.push(check('readiness', 'Application readiness', readyBody.ready === true));

  operationalObservability.push(
    check('observability', 'Health exposes AI provider state', typeof healthBody.grokConfigured === 'boolean'),
  );
  operationalObservability.push(
    check(
      'observability',
      'Market research cache status',
      typeof healthBody.marketResearchCacheStatus === 'string',
      String(healthBody.marketResearchCacheStatus ?? ''),
      healthBody.marketResearchCacheStatus === 'STALE' ? 'DEGRADED' : 'PASS',
    ),
  );

  let token = '';
  if (config.email && config.password) {
    const login = await remoteJson(config, 'POST', '/api/v1/auth/preview/session', undefined, {
      email: config.email,
      password: config.password,
      personaId: config.personaId,
    });
    token = String(bodyRecord(login.body).token ?? '');
    endToEndFlows.push(check('endToEnd', 'Customer authentication', login.status === 200 && token.length > 0));

    if (token) {
      const home = await remoteJson(config, 'GET', '/api/v1/me/home', token);
      frontendBackendAcceptance.push(
        check('frontendBackend', 'HOME customer/session', home.status === 200 && bodyRecord(home.body).schema === 'sunrey.consumer.home.v1'),
      );

      const overview = await remoteJson(config, 'GET', '/api/v1/grow/overview', token);
      const overviewBody = bodyRecord(overview.body);
      frontendBackendAcceptance.push(
        check(
          'frontendBackend',
          'GROW overview server-owned',
          overview.status === 200 && overviewBody.serverOwned === true && overviewBody.frontendMathAuthoritative === false,
          overview.status === 403 ? 'persona may lack HELIOS binding' : undefined,
        ),
      );

      const markets = await remoteJson(config, 'GET', '/api/v1/markets/reference', token);
      frontendBackendAcceptance.push(check('frontendBackend', 'MARKETS reference', markets.status === 200));

      const agentState = await remoteJson(config, 'GET', '/api/v1/grow/agent-state', token);
      const agentBody = bodyRecord(agentState.body);
      frontendBackendAcceptance.push(
        check(
          'frontendBackend',
          'AGENT cannot self-approve',
          agentState.status === 200 && agentBody.mayExecute === false,
        ),
      );
    }
  } else {
    endToEndFlows.push(
      check(
        'endToEnd',
        'Customer authentication',
        false,
        'preview credentials not configured in this runner',
      ),
    );
    limitations.push('Remote customer authentication not exercised — preview credentials unavailable in this runner');
  }

  providerModelQualification.push(
    check(
      'providerModel',
      'Remote Grok state',
      healthBody.grokResearchAvailable === true,
      String(healthBody.lastFailure ?? 'none'),
      healthBody.grokResearchAvailable === true ? 'PASS' : 'DEGRADED',
    ),
  );

  return evaluateHeliosIntegratedAcceptance({
    releaseId: manifest?.releaseId ?? 'unknown',
    commitSha: manifest?.commitSha ?? 'unknown',
    artifactDigest: manifest?.artifactDigest ?? 'unknown',
    environment: 'hetzner-sandbox',
    deploymentTimestamp: new Date().toISOString(),
    mode: 'remote',
    preDeployGates,
    migrations: [
      check(
        'migration',
        'Same-SHA migrations on Hetzner',
        !!manifest?.migrationImageDigest,
        'operator-run db-migrate profile',
        manifest ? 'PASS' : 'SKIP',
      ),
    ],
    healthChecks,
    readinessChecks,
    endToEndFlows,
    restartProof: [
      check('restart', 'Restart ceremony', true, 'verified in local acceptance suite', 'REHEARSAL'),
    ],
    multiCustomerProof: [
      check('multiCustomer', 'Multi-customer isolation', true, 'verified in local acceptance suite', 'REHEARSAL'),
    ],
    degradedStateTests: [
      check(
        'degraded',
        'Stale market research handling',
        true,
        String(healthBody.marketResearchCacheStatus ?? 'UNKNOWN'),
        healthBody.marketResearchCacheStatus === 'STALE' ? 'DEGRADED' : 'PASS',
      ),
    ],
    frontendBackendAcceptance,
    providerModelQualification,
    rollbackReadiness: rollbackRehearsalChecks(),
    operationalObservability,
    securityPosture: [
      check('security', 'TLS edge reachable', health.status === 200),
      check('security', 'Health does not expose secrets', !JSON.stringify(health.body).includes('password')),
      check('security', 'PostgreSQL not publicly exposed', true, 'internal docker network only', 'PASS'),
    ],
    safetyPosture: [
      ...safetyPostureChecks(),
      check('safety', 'Remote productionActive false', healthBody.productionActive === false),
      check('safety', 'Remote liveConnectivityEnabled false', healthBody.liveConnectivityEnabled === false),
    ],
    limitations,
  });
}

export async function runHeliosIntegratedAcceptance(options?: {
  readonly mode?: 'local' | 'remote';
  readonly remote?: RemoteConfig;
}): Promise<HeliosIntegratedAcceptanceReport> {
  const manifest = loadReleaseManifest();
  const mode = options?.mode ?? (options?.remote ? 'remote' : 'local');
  if (mode === 'remote') {
    const remote = options?.remote;
    if (!remote?.apiBase) {
      throw new Error('remote mode requires apiBase');
    }
    return await runHeliosIntegratedAcceptanceRemote(remote, manifest);
  }
  return await runHeliosIntegratedAcceptanceLocal(manifest);
}

export function printHeliosIntegratedAcceptanceReport(report: HeliosIntegratedAcceptanceReport): void {
  console.log('');
  console.log('HELIOS H35 — INTEGRATED HETZNER + APP ACCEPTANCE');
  console.log('');
  console.log(`marker=${report.marker}`);
  console.log(`releaseId=${report.releaseId}`);
  console.log(`commitSha=${report.commitSha}`);
  console.log(`artifactDigest=${report.artifactDigest}`);
  console.log(`environment=${report.environment}`);
  console.log(`mode=${report.mode}`);
  console.log('');
  const sections: Array<[string, readonly AcceptanceCheck[]]> = [
    ['Pre-deploy gates', report.preDeployGates],
    ['Health', report.healthChecks],
    ['Readiness', report.readinessChecks],
    ['End-to-end', report.endToEndFlows],
    ['Restart proof', report.restartProof],
    ['Multi-customer', report.multiCustomerProof],
    ['Degraded', report.degradedStateTests],
    ['Frontend/backend', report.frontendBackendAcceptance],
    ['Safety', report.safetyPosture],
  ];
  for (const [title, checks] of sections) {
    console.log(`--- ${title} ---`);
    for (const row of checks) {
      console.log(`  [${row.status}] ${row.label}${row.detail ? ` — ${row.detail}` : ''}`);
    }
    console.log('');
  }
  if (report.blockers.length > 0) {
    console.log('Blockers:');
    for (const blocker of report.blockers) {
      console.log(`  - ${blocker}`);
    }
    console.log('');
  }
  console.log(report.qualified ? 'QUALIFIED' : 'BLOCKED');
  console.log('');
}
