/**
 * sunrey-ops provider runtime-test
 *
 * Reports whether the run used LOCAL_SIMULATION, SANDBOX, or
 * EXTERNAL_INTEGRATION_TEST. Secret values are never printed.
 */

import {
  assertNoSecretMaterial,
  reportedModeFor,
  resolveRuntimeMode,
} from './core.ts';
import {
  buildRuntimeReadinessReport,
  createProviderRuntime,
  day2ProviderOperations,
  exerciseExecutableAdapters,
  exerciseSupportingAdapters,
  exportRuntimeAudit,
  observabilityMetrics,
  runNegativeControls,
  runProviderIntegrationTests,
  sandboxHarnessUsesMocksWithoutCredentials,
} from './harness.ts';
import type { ProviderRuntimeMode, ReportedRuntimeMode } from './types.ts';

export type ProviderRuntimeCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

export function providerRuntimeUsage(): readonly string[] {
  return Object.freeze([
    'sunrey-ops provider runtime-test',
    'sunrey-ops provider runtime-readiness',
    'sunrey-ops provider runtime-matrix',
  ]);
}

function envSandboxPresent(): boolean {
  return Boolean(process.env.SUNREY_PROVIDER_SANDBOX) && process.env.SUNREY_PROVIDER_SANDBOX !== '0';
}

function requestedMode(): ProviderRuntimeMode | undefined {
  const raw = process.env.SUNREY_PROVIDER_RUNTIME_MODE;
  if (raw === 'SANDBOX' || raw === 'INTEGRATION_TEST' || raw === 'LOCAL_SIMULATION') {
    return raw;
  }
  if (raw === 'PRODUCTION_AUTHORIZED' || raw === 'PRODUCTION_CANDIDATE_DISABLED') {
    return raw;
  }
  return undefined;
}

export function runProviderRuntimeCommand(args: readonly string[]): ProviderRuntimeCliResult {
  const [action] = args;
  const sandboxCredentialPresent = envSandboxPresent();
  const modeRequest = requestedMode();
  const created = createProviderRuntime({
    ...(modeRequest === undefined ? {} : { requestedMode: modeRequest }),
    sandboxCredentialPresent,
  });
  if (!created.ok) {
    return { ok: false, command: `provider ${action ?? 'runtime-test'}`, payload: { error: created.error } };
  }
  const runtime = created.value;
  const nowUtc = '2026-08-18T00:00:00.000Z';
  const mode = resolveRuntimeMode({
    requested: runtime.mode,
    sandboxCredentialPresent,
    externalEvidencePresent: false,
    humanAuthorityPresent: false,
  });
  const reported: ReportedRuntimeMode = mode.ok
    ? reportedModeFor(mode.value, sandboxCredentialPresent)
    : runtime.reportedMode;
  if (action === 'runtime-readiness') {
    const report = buildRuntimeReadinessReport(runtime, nowUtc);
    assertNoSecretMaterial(report);
    return { ok: true, command: 'provider runtime-readiness', payload: report };
  }
  if (action === 'runtime-matrix') {
    const tests = runProviderIntegrationTests(runtime);
    assertNoSecretMaterial(tests);
    return {
      ok: true,
      command: 'provider runtime-matrix',
      payload: {
        reportedMode: reported,
        tests,
        legallyApproved: false,
      },
    };
  }
  if (action !== 'runtime-test' && action !== undefined && action !== '') {
    return {
      ok: false,
      command: `provider ${action}`,
      payload: { error: 'unknown provider runtime command', usage: providerRuntimeUsage() },
    };
  }
  const tests = runProviderIntegrationTests(runtime);
  const negatives = runNegativeControls(runtime);
  const adapters = exerciseExecutableAdapters(runtime);
  const supporting = exerciseSupportingAdapters(runtime);
  const day2 = day2ProviderOperations(nowUtc);
  const audit = exportRuntimeAudit(nowUtc);
  const payload = {
    reportedMode: reported,
    modeUsed: reported,
    LOCAL_SIMULATION: reported === 'LOCAL_SIMULATION',
    SANDBOX: reported === 'SANDBOX',
    EXTERNAL_INTEGRATION_TEST: reported === 'EXTERNAL_INTEGRATION_TEST',
    usedLocalMocks: sandboxHarnessUsesMocksWithoutCredentials(runtime),
    testsPassed: tests.every((row) => row.passed),
    domains: tests.map((row) => row.domain),
    negatives,
    adapters,
    supporting,
    day2: {
      renewalState: day2.renewal.state,
      outageIncident: day2.outageIncident.incidentId,
      evidenceExpirationReflected: day2.evidenceExpirationReflected,
    },
    auditKind: audit.kind,
    metrics: observabilityMetrics(runtime),
    engineeringEvidenceOnly: true,
    legallyApproved: false,
    secretValuePresent: false,
  };
  assertNoSecretMaterial(payload);
  return { ok: tests.every((row) => row.passed) && negatives.secretValueExcluded, command: 'provider runtime-test', payload };
}
