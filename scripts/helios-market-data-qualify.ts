#!/usr/bin/env node
/**
 * HELIOS H07 capital market provider qualification harness.
 *
 * Proves credential resolution, provider reachability, parsing, instrument mapping,
 * timestamp handling, entitlement capture, normalized observation emission, and
 * failure/degraded behavior without printing secret values.
 *
 * External qualification runs only when FINNHUB_API_KEY is configured and
 * HELIOS_MARKET_DATA_LIVE_QUALIFY=1 is set.
 */

import { createCapitalMarketService, defaultQualificationInstrumentId, qualificationNowUtc } from '../packages/sunrey-exchange/src/capital-market/service.ts';
import { FINNHUB_CREDENTIAL_ENV_VAR } from '../packages/sunrey-exchange/src/capital-market/adapters/finnhub-adapter.ts';

const LIVE_FLAG = process.env.HELIOS_MARKET_DATA_LIVE_QUALIFY === '1';
const credentialConfigured = Boolean(process.env[FINNHUB_CREDENTIAL_ENV_VAR]?.trim());

async function main(): Promise<void> {
  const nowUtc = qualificationNowUtc();
  const service = createCapitalMarketService({
    externalQualificationPassed: false,
  });
  const diagnostics = service.diagnostics(nowUtc);

  if (!credentialConfigured) {
    const pending = await service.qualifyExternal(nowUtc, defaultQualificationInstrumentId());
    const report = {
      command: 'helios:market-data:qualify',
      providerId: pending.providerId,
      credentialConfigured: pending.credentialConfigured,
      credentialResolved: pending.credentialResolved,
      routeStatus: diagnostics.routeStatus,
      outcome: pending.outcome,
      message: pending.message,
      checks: pending,
      secretValuePresent: false,
    };
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  if (!LIVE_FLAG) {
    const report = {
      command: 'helios:market-data:qualify',
      providerId: diagnostics.providerId,
      credentialConfigured: true,
      credentialResolved: true,
      routeStatus: 'NOT_QUALIFIED',
      outcome: 'ADAPTER_READY_EXTERNAL_QUALIFICATION_PENDING',
      message: 'credential present; set HELIOS_MARKET_DATA_LIVE_QUALIFY=1 to run bounded external qualification',
      secretValuePresent: false,
    };
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  const result = await service.qualifyExternal(nowUtc, defaultQualificationInstrumentId());
  const qualifiedService = createCapitalMarketService({
    externalQualificationPassed: result.outcome === 'QUALIFIED',
  });
  const qualifiedDiagnostics = qualifiedService.diagnostics(nowUtc);
  const report = {
    command: 'helios:market-data:qualify',
    providerId: result.providerId,
    credentialConfigured: result.credentialConfigured,
    credentialResolved: result.credentialResolved,
    routeStatus: qualifiedDiagnostics.routeStatus,
    outcome: result.outcome,
    message: result.message,
    checks: result,
    secretValuePresent: false,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(result.outcome === 'QUALIFIED' ? 0 : 1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ command: 'helios:market-data:qualify', error: message, secretValuePresent: false }, null, 2));
  process.exit(1);
});
