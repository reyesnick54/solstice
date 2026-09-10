#!/usr/bin/env node
/**
 * SunRey Internal Alpha Exchange smoke / acceptance command.
 *
 * Local (default):
 *   npm run smoke:exchange-alpha
 *
 * Remote (deployed Hetzner Alpha):
 *   SUNREY_VERIFY_API_BASE=https://api.sunrey.xyz \
 *   SUNREY_VERIFY_PREVIEW_EMAIL=... \
 *   SUNREY_VERIFY_PREVIEW_PASSWORD=... \
 *   npm run smoke:exchange-alpha -- --remote
 */
import {
  printExchangeAlphaReport,
  runExchangeAlphaAcceptance,
} from './lib/exchange-alpha-acceptance.ts';

function parseArgs(argv) {
  const remote = argv.includes('--remote');
  const apiBase =
    process.env.SUNREY_VERIFY_API_BASE ??
    process.env.SUNREY_ALPHA_API_BASE ??
    'https://api.sunrey.xyz';
  const origin =
    process.env.SUNREY_VERIFY_APP_ORIGIN ??
    process.env.SUNREY_ALPHA_APP_ORIGIN ??
    'https://app.sunrey.xyz';
  const email =
    process.env.SUNREY_VERIFY_PREVIEW_EMAIL ??
    process.env.SUNREY_PREVIEW_AUTH_EMAIL ??
    '';
  const password =
    process.env.SUNREY_VERIFY_PREVIEW_PASSWORD ??
    process.env.SUNREY_PREVIEW_AUTH_PASSWORD ??
    '';
  const personaId =
    process.env.SUNREY_VERIFY_PERSONA_ID ??
    process.env.SUNREY_ALPHA_PERSONA_ID ??
    'exchange';
  return { remote, apiBase, origin, email, password, personaId };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await runExchangeAlphaAcceptance(
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
  printExchangeAlphaReport(report);
  if (!report.ready) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[smoke:exchange-alpha] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
