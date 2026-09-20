#!/usr/bin/env node
/**
 * HELIOS Multi-Asset M05 — equity/index market data qualification harness.
 *
 * Proves provider-backed equity/index OHLCV ingestion, session status, market
 * state generation, and failure behavior without printing secret values.
 *
 * External qualification runs only when FINNHUB_API_KEY is configured and
 * HELIOS_M05_LIVE_QUALIFY=1 is set.
 */

import {
  HELIOS_MULTI_ASSET_M05_EQUITY_INDEX_DATA_QUALIFIED,
  runM05EquityIndexQualification,
} from '../packages/sunrey-exchange/src/capital-market/qualification.ts';
import { FINNHUB_CREDENTIAL_ENV_VAR } from '../packages/sunrey-exchange/src/capital-market/adapters/finnhub-adapter.ts';
import { qualificationNowUtc } from '../packages/sunrey-exchange/src/capital-market/service.ts';

const LIVE_FLAG = process.env.HELIOS_M05_LIVE_QUALIFY === '1';
const credentialConfigured = Boolean(process.env[FINNHUB_CREDENTIAL_ENV_VAR]?.trim());

async function main(): Promise<void> {
  const nowUtc = qualificationNowUtc();

  if (!credentialConfigured) {
    const result = await runM05EquityIndexQualification({ nowUtc, liveExternal: false });
    const report = {
      command: 'helios:m05:equity-index:qualify',
      marker: result.marker,
      credentialConfigured: false,
      credentialResolved: false,
      outcome: 'NOT_CONFIGURED',
      message: 'FINNHUB_API_KEY is not configured; adapter ready for external qualification',
      checks: result.checks,
      secretValuePresent: false,
    };
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  const result = await runM05EquityIndexQualification({
    nowUtc,
    liveExternal: LIVE_FLAG,
  });

  const report = {
    command: 'helios:m05:equity-index:qualify',
    marker: result.marker,
    qualified: result.qualified,
    credentialConfigured: result.credentialConfigured,
    credentialResolved: result.credentialResolved,
    liveExternal: LIVE_FLAG,
    blockers: result.blockers,
    checks: result.checks,
    secretValuePresent: false,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(result.marker === HELIOS_MULTI_ASSET_M05_EQUITY_INDEX_DATA_QUALIFIED ? 0 : credentialConfigured && !LIVE_FLAG ? 0 : 1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({ command: 'helios:m05:equity-index:qualify', error: message, secretValuePresent: false }, null, 2),
  );
  process.exit(1);
});
