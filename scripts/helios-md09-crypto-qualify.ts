#!/usr/bin/env node
/**
 * HELIOS MD09 — multi-venue crypto market data qualification harness (fixture research plane).
 */

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_MD09_CRYPTO_MARKET_DATA_QUALIFIED,
  runMd09CryptoMarketQualification,
} from '../packages/platform/src/helios/market-data/md09/qualification.ts';

async function main(): Promise<void> {
  const nowUtc = asUtcInstant(new Date().toISOString());
  const result = runMd09CryptoMarketQualification({ nowUtc });
  const report = {
    command: 'helios:md09:crypto:qualify',
    marker: result.marker,
    qualified: result.qualified,
    blockers: result.blockers,
    checks: result.checks,
    secretValuePresent: false,
    liveExecutionEnabled: false,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(result.marker === HELIOS_MD09_CRYPTO_MARKET_DATA_QUALIFIED ? 0 : 1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({ command: 'helios:md09:crypto:qualify', error: message, secretValuePresent: false }, null, 2),
  );
  process.exit(1);
});
