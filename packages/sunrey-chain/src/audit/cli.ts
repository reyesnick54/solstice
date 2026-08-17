/**
 * sunrey-audit — independent security-review bundle tooling.
 *
 * Commands: generate, verify, reproduce, readiness, scope, quickstart.
 * Local/test signing only. Does not claim an external audit occurred.
 */

import { join } from 'node:path';

import { generateAuditBundle, verifyAuditBundle } from './bundle.ts';
import { buildReadinessReport } from './readiness.ts';
import { QUICKSTART_STEPS, reproduceCritical } from './reproduce.ts';
import { emitAuditScopeYaml, requiredReviewDomains, scopeIsComplete } from './scope.ts';

export type AuditCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

export function runSunreyAudit(root: string, argv: readonly string[]): AuditCliResult {
  const [command = 'help', arg] = argv;
  if (command === 'generate') {
    const generated = generateAuditBundle(root, { sourceCommit: process.env.GITHUB_SHA ?? 'local' });
    return {
      ok: generated.secretFindings.length === 0,
      command,
      payload: {
        outDir: generated.outDir,
        bundleId: generated.manifest.bundle_id,
        claims_external_audit_completed: false,
      },
    };
  }
  if (command === 'verify') {
    const target = arg && arg.length > 0 ? (arg.startsWith('/') ? arg : join(root, arg)) : join(root, 'dist', 'sunrey-audit');
    const result = verifyAuditBundle(target);
    return { ok: result.ok, command, payload: result };
  }
  if (command === 'reproduce') {
    const full = argv.includes('--full');
    const result = reproduceCritical(root, { full });
    return { ok: result.ok, command, payload: result };
  }
  if (command === 'readiness') {
    const report = buildReadinessReport();
    return { ok: report.category !== 'MISSING_REVIEW_ARTIFACT', command, payload: report };
  }
  if (command === 'scope') {
    return {
      ok: scopeIsComplete(),
      command,
      payload: { domains: requiredReviewDomains(), yaml: emitAuditScopeYaml() },
    };
  }
  if (command === 'quickstart') {
    return {
      ok: true,
      command,
      payload: {
        steps: QUICKSTART_STEPS,
        commands: [
          'npm run sunrey-audit -- generate',
          'npm run sunrey-audit -- verify dist/sunrey-audit',
          'npm run sunrey-audit -- reproduce',
          'npm run test:fuzz-smoke',
          'npm run sunrey-range -- campaign --smoke',
          'SUNREY_FIXTURE_ENV=local npm run sunrey-testnet -- bootstrap',
          'npm run sunrey-explorer -- verify',
          'npm run sunrey-release -- verify',
        ],
      },
    };
  }
  return {
    ok: command === 'help',
    command: command === 'help' ? 'help' : command,
    payload: {
      usage: 'sunrey-audit <generate|verify|reproduce|readiness|scope|quickstart> [bundle]',
      claims_external_audit_completed: false,
    },
  };
}

const invoked = process.argv[1] ?? '';
if (invoked.endsWith('audit/cli.ts') || invoked.endsWith('sunrey-audit.mjs')) {
  const result = runSunreyAudit(process.cwd(), process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.ok ? 0 : 1);
}
