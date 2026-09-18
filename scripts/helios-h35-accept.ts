#!/usr/bin/env node
/**
 * HELIOS H35 — integrated Hetzner + app acceptance CLI.
 */

import {
  printHeliosIntegratedAcceptanceReport,
  runHeliosIntegratedAcceptance,
} from './lib/helios-integrated-acceptance.ts';
import { writeHeliosIntegratedAcceptanceReport } from '../performance/helios/lib/acceptance-report.ts';

function parseArgs(argv: string[]) {
  const remote = argv.includes('--remote');
  const apiBase =
    process.env.SUNREY_VERIFY_API_BASE ??
    process.env.SUNREY_HELIOS_API_BASE ??
    'https://api.sunrey.xyz';
  const origin =
    process.env.SUNREY_VERIFY_APP_ORIGIN ??
    process.env.SUNREY_HELIOS_APP_ORIGIN ??
    'https://app.sunrey.xyz';
  const email =
    process.env.SUNREY_VERIFY_PREVIEW_EMAIL ?? process.env.SUNREY_PREVIEW_AUTH_EMAIL ?? '';
  const password =
    process.env.SUNREY_VERIFY_PREVIEW_PASSWORD ?? process.env.SUNREY_PREVIEW_AUTH_PASSWORD ?? '';
  const personaId =
    process.env.SUNREY_VERIFY_PERSONA_ID ??
    process.env.SUNREY_HELIOS_PERSONA_ID ??
    'investment';
  const writeReport = !argv.includes('--no-write');
  return { remote, apiBase, origin, email, password, personaId, writeReport };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await runHeliosIntegratedAcceptance(
    args.remote
      ? {
          mode: 'remote',
          remote: {
            apiBase: args.apiBase,
            origin: args.origin,
            email: args.email,
            password: args.password,
            personaId: args.personaId,
          },
        }
      : { mode: 'local' },
  );

  printHeliosIntegratedAcceptanceReport(report);
  if (args.writeReport) {
    const path = writeHeliosIntegratedAcceptanceReport(report);
    console.log(`[H35] wrote ${path}`);
  }

  if (!report.qualified) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[H35] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
