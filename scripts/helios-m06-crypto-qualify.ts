#!/usr/bin/env node
/**
 * HELIOS Multi-Asset M06 — BTC/ETH crypto spot market data qualification harness.
 *
 * Proves provider-backed crypto OHLCV ingestion, 24/7 venue semantics, market
 * state generation, and failure behavior without printing secret values.
 *
 * External qualification runs only when HELIOS_M06_LIVE_QUALIFY=1 is set.
 * Optional COINGECKO_API_KEY improves rate limits on live runs.
 */

import {
  COINGECKO_CREDENTIAL_ENV_VAR,
  HELIOS_MULTI_ASSET_M06_CRYPTO_MARKET_DATA_QUALIFIED,
  runM06CryptoMarketQualification,
} from '../packages/sunrey-exchange/src/crypto-market/spot/qualification.ts';
import { qualificationNowUtc } from '../packages/sunrey-exchange/src/capital-market/service.ts';

const LIVE_FLAG = process.env.HELIOS_M06_LIVE_QUALIFY === '1';
const credentialConfigured = Boolean(process.env[COINGECKO_CREDENTIAL_ENV_VAR]?.trim());

async function main(): Promise<void> {
  const nowUtc = qualificationNowUtc();

  const result = await runM06CryptoMarketQualification({ nowUtc });

  const report = {
    command: 'helios:m06:crypto:qualify',
    marker: result.marker,
    qualified: result.qualified,
    credentialConfigured,
    credentialResolved: result.credentialResolved,
    liveExternal: LIVE_FLAG,
    blockers: result.blockers,
    checks: result.checks,
    secretValuePresent: false,
    message: LIVE_FLAG
      ? 'live external qualification requested; harness checks executed (CoinGecko public tier available without key)'
      : credentialConfigured
        ? 'COINGECKO_API_KEY configured; harness qualification executed'
        : 'CoinGecko public demo tier; optional COINGECKO_API_KEY improves rate limits',
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(result.marker === HELIOS_MULTI_ASSET_M06_CRYPTO_MARKET_DATA_QUALIFIED ? 0 : 1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({ command: 'helios:m06:crypto:qualify', error: message, secretValuePresent: false }, null, 2),
  );
  process.exit(1);
});
