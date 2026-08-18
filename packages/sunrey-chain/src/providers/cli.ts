/**
 * sunrey-ops provider commands.
 */

import { assertNoSecretInEvidenceReport } from './evidence.ts';
import { createProviderAcceptanceFixture, missingEvidenceFor } from './fixture.ts';
import { evaluateEligibility, type AcceptanceInputs } from './evaluation.ts';
import { profileFor } from './profiles.ts';
import { buildAcceptanceReport, buildProductionProviderMatrix, separateReadinessLanes } from './report.ts';
import { buildProviderAcceptanceReadinessFeed } from './readiness.ts';
import { DOMAIN_PROFILES } from './profiles.ts';
import type { ProviderDomain } from './types.ts';
import { isProviderDomain } from './types.ts';
import { providerRuntimeUsage, runProviderRuntimeCommand } from '../provider-runtime/cli.ts';

export type ProviderCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

export function providerUsage(): readonly string[] {
  return Object.freeze([
    'sunrey-ops provider list',
    'sunrey-ops provider profile <domain>',
    'sunrey-ops provider test [domain]',
    'sunrey-ops provider evidence <providerId>',
    'sunrey-ops provider verify <providerId>',
    'sunrey-ops provider readiness',
    'sunrey-ops provider matrix',
    ...providerRuntimeUsage(),
  ]);
}

function fixtureInputs(): readonly AcceptanceInputs[] {
  const fixture = createProviderAcceptanceFixture();
  return fixture.suites.map((suite) =>
    Object.freeze({
      providerId: suite.providerId,
      domain: suite.domain,
      configured: true,
      suite,
      evidence: missingEvidenceFor(suite.providerId, suite.domain),
      humanAccepted: false,
      humanReviewerKind: null,
      nowUtc: fixture.nowUtc,
    }),
  );
}

export function runProviderOpsCommand(args: readonly string[]): ProviderCliResult {
  const [action, extra] = args;
  if (action === 'runtime-test' || action === 'runtime-readiness' || action === 'runtime-matrix') {
    return runProviderRuntimeCommand(args);
  }
  const inputs = fixtureInputs();
  const report = buildAcceptanceReport(inputs, inputs[0]?.nowUtc ?? '2026-08-18T00:00:00.000Z');
  const matrix = buildProductionProviderMatrix(report.results);
  const secretCheck = assertNoSecretInEvidenceReport({ report, matrix });
  if (!secretCheck.ok) {
    return { ok: false, command: `provider ${action ?? ''}`, payload: { error: secretCheck.error } };
  }
  if (action === 'list') {
    return {
      ok: true,
      command: 'provider list',
      payload: {
        domains: DOMAIN_PROFILES.map((row) => row.domain),
        providers: inputs.map((row) => ({ providerId: row.providerId, domain: row.domain, configured: row.configured })),
      },
    };
  }
  if (action === 'profile') {
    if (!extra || !isProviderDomain(extra)) {
      return { ok: false, command: 'provider profile', payload: { error: 'domain required', usage: providerUsage() } };
    }
    return { ok: true, command: 'provider profile', payload: profileFor(extra as ProviderDomain) };
  }
  if (action === 'test') {
    const suites = extra
      ? inputs.filter((row) => row.domain === extra).map((row) => row.suite)
      : inputs.map((row) => row.suite);
    return { ok: suites.every((row) => row?.passed), command: 'provider test', payload: suites };
  }
  if (action === 'evidence') {
    const found = inputs.find((row) => row.providerId === extra) ?? inputs[0];
    if (!found) {
      return { ok: false, command: 'provider evidence', payload: { error: 'no provider fixture' } };
    }
    return {
      ok: true,
      command: 'provider evidence',
      payload: {
        providerId: found.providerId,
        evidence: found.evidence,
        missingContract: found.evidence.some((row) => row.evidenceClass === 'SERVICE_CONTRACT' && row.verificationState === 'MISSING'),
        missingLicense: found.evidence.some((row) => row.evidenceClass === 'LICENSE_REGISTRATION' && row.verificationState === 'MISSING'),
      },
    };
  }
  if (action === 'verify') {
    const found = inputs.find((row) => row.providerId === extra) ?? inputs[0];
    if (!found) {
      return { ok: false, command: 'provider verify', payload: { error: 'no provider fixture' } };
    }
    return { ok: true, command: 'provider verify', payload: evaluateEligibility(found) };
  }
  if (action === 'readiness') {
    return {
      ok: true,
      command: 'provider readiness',
      payload: {
        lanes: separateReadinessLanes(report),
        feed: buildProviderAcceptanceReadinessFeed(report, matrix),
      },
    };
  }
  if (action === 'matrix') {
    return { ok: true, command: 'provider matrix', payload: matrix };
  }
  return { ok: false, command: `provider ${action ?? ''}`, payload: { error: 'unknown provider command', usage: providerUsage() } };
}
