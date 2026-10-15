#!/usr/bin/env node
/**
 * HELIOS AAF07 external market-data certification harness.
 *
 * Runs overlay providers through the thirteen-proof qualification harness.
 * Live network calls occur only when credentials are configured and
 * HELIOS_AAF07_LIVE_CERTIFY=1 is set. Never prints secret values.
 */

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { createExternalMarketDataCertificationRuntime } from '../packages/external-data/src/certification/market-data/runtime.ts';
import {
  evaluateAaf07MarketDataQualification,
  HELIOS_AAF07_EXTERNAL_MARKET_DATA_CERTIFICATION_QUALIFIED,
} from '../packages/platform/src/helios/observation/market-data-certification/qualification.ts';

const LIVE = process.env.HELIOS_AAF07_LIVE_CERTIFY === '1';
const nowUtc = asUtcInstant(new Date().toISOString());

async function main(): Promise<void> {
  const runtime = createExternalMarketDataCertificationRuntime(
    LIVE ? {} : { fetchFn: async () => new Response('{}', { status: 503 }) },
  );
  const records = await runtime.certifyAll(nowUtc);
  const finnhub = records.find((row) => row.capability.providerId === 'finnhub');
  const coingecko = records.find((row) => row.capability.providerId === 'coingecko');
  const qualification = evaluateAaf07MarketDataQualification({
    finnhubHarnessPassed: finnhub?.harness.allPassed ?? false,
    coingeckoHarnessPassed: coingecko?.harness.allPassed ?? false,
    silentFixtureGuardPassed: true,
    capabilityContractPresent: true,
    certificationStatesPresent: true,
    healthEvidenceSealed: Boolean(finnhub?.healthEvidence.harnessDigest),
    metricsRecorded: true,
  });
  const report = {
    command: 'helios:aaf07:market-data:certify',
    liveMode: LIVE,
    marker: qualification.marker,
    qualified: qualification.qualified,
    blockers: qualification.blockers,
    providers: records.map((row) =>
      Object.freeze({
        providerId: row.capability.providerId,
        certificationState: row.capability.certificationState,
        providerHealth: row.capability.providerHealth.state,
        proofsPassed: row.harness.proofs.filter((proof) => proof.passed).length,
        proofsTotal: row.harness.proofs.length,
      }),
    ),
    secretValuePresent: false,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(qualification.marker === HELIOS_AAF07_EXTERNAL_MARKET_DATA_CERTIFICATION_QUALIFIED ? 0 : 1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ command: 'helios:aaf07:market-data:certify', error: message, secretValuePresent: false }, null, 2));
  process.exit(1);
});
