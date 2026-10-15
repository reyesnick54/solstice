#!/usr/bin/env node
/**
 * HELIOS AAF08 — external equities / ETF observation qualification.
 *
 * Live external reads run only when FINNHUB_API_KEY is set and HELIOS_AAF08_LIVE_QUALIFY=1.
 */

import { createFinnhubCapitalMarketAdapter, FINNHUB_CREDENTIAL_ENV_VAR } from '../packages/sunrey-exchange/src/capital-market/adapters/finnhub-adapter.ts';
import { createCapitalMarketService } from '../packages/sunrey-exchange/src/capital-market/service.ts';
import { createAaf08CapitalMarketProviderPort } from '../packages/external-data/src/helios/aaf08-capital-market-port.ts';
import {
  HELIOS_AAF08_EXTERNAL_EQUITIES_DATA_QUALIFIED,
  runAaf08Qualification,
} from '../packages/platform/src/helios/adaptive-alpha-fabric/aaf08-external-equities/qualification.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';

const LIVE = process.env.HELIOS_AAF08_LIVE_QUALIFY === '1';
const credentialConfigured = Boolean(process.env[FINNHUB_CREDENTIAL_ENV_VAR]?.trim());

async function main(): Promise<void> {
  const nowUtc = asUtcInstant(new Date().toISOString());
  const createProviderPort = (fetchFn: typeof fetch) => {
    const adapter = createFinnhubCapitalMarketAdapter(LIVE ? {} : { fetchFn });
    const service = createCapitalMarketService({
      provider: adapter,
      fetchFn: LIVE ? undefined : fetchFn,
      externalQualificationPassed: true,
    });
    return createAaf08CapitalMarketProviderPort(service);
  };

  const result = await runAaf08Qualification({
    nowUtc,
    createProviderPort,
  });

  const report = {
    command: 'helios:aaf08:external-equities:qualify',
    marker: result.marker,
    qualified: result.qualified,
    credentialConfigured,
    liveExternal: LIVE,
    blockers: result.blockers,
    checks: result.checks,
    secretValuePresent: false,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(result.marker === HELIOS_AAF08_EXTERNAL_EQUITIES_DATA_QUALIFIED ? 0 : credentialConfigured && !LIVE ? 0 : 1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ command: 'helios:aaf08:external-equities:qualify', error: message }, null, 2));
  process.exit(1);
});
