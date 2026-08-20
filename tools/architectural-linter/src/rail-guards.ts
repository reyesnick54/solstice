import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { Finding } from './linter.ts';

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage']);
const COMPETING_RAIL_PATHS = [
  'packages/rails',
  'packages/bank-rails',
  'packages/swift',
  'packages/ach',
  'packages/banking-v2',
  'packages/baas',
  'packages/payment-provider',
  'packages/fx-v2',
  'packages/cross-border-core',
];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function finding(rule: string, file: string, line: number, message: string): Finding {
  return { rule, file, line, message };
}

function isRailAdapterFile(rel: string): boolean {
  return (
    rel.startsWith('packages/payments/src/rail-adapters') ||
    rel.startsWith('packages/payments/src/rail-network') ||
    rel.startsWith('packages/payments/src/rail-port') ||
    rel.startsWith('packages/payments/src/rail-auth') ||
    rel.startsWith('packages/payments/src/rail-webhook') ||
    rel.startsWith('packages/payments/src/production-candidate/adapter') ||
    rel.startsWith('packages/payments/src/production-candidate/transport') ||
    rel.startsWith('packages/payments/src/production-candidate/auth')
  );
}

/**
 * Structural guards for the canonical rail adapter layer.
 * Adapters must not post journals, issue Execution Authority, leak
 * provider DTOs, store plaintext credentials, or invent a second
 * payment state machine.
 */
export function lintRailBoundary(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const alias of COMPETING_RAIL_PATHS) {
    if (existsSync(join(root, alias))) {
      findings.push(
        finding(
          'second-rail-package',
          alias,
          1,
          `competing rail package '${alias}' exists; use packages/payments RailAdapter`,
        ),
      );
    }
  }

  const files = walk(root);
  for (const file of files) {
    const rel = relative(root, file).replaceAll('\\', '/');
    if (rel.startsWith('tools/architectural-linter/')) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    const lines = source.split(/\r?\n/);
    const isTest = /\.test\.ts$/.test(rel) || rel.startsWith('tests/');

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      const lineNo = i + 1;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      if (isRailAdapterFile(rel) && !isTest) {
        if (/ledger\.postJournal\s*\(|\bpostJournal\s*\(/.test(line) && !/function\s+postJournal/.test(line)) {
          findings.push(
            finding(
              'rail-adapter-ledger-bypass',
              rel,
              lineNo,
              'rail adapter must not post journals; PaymentsService posts through postPaymentJournal',
            ),
          );
        }
        if (/AuthorityIssuer|\.issue\s*\(/.test(line) && /ExecutionAuthority|AuthorityIssuer/.test(line)) {
          findings.push(
            finding(
              'rail-adapter-authority-issue',
              rel,
              lineNo,
              'rail adapter must not issue Execution Authority',
            ),
          );
        }
      }

      if (
        rel === 'packages/payments/src/index.ts' &&
        /export\s+type\s+(SwiftMt|AchEntry|FedNowMessage|SepaPain|SamaTransfer|Uaepgs)/.test(line)
      ) {
        findings.push(
          finding(
            'provider-dto-leak',
            rel,
            lineNo,
            'provider-specific DTO must not escape into the payments domain API',
          ),
        );
      }

      if (
        isRailAdapterFile(rel) &&
        !isTest &&
        /(?:apiKey|clientSecret|password|privateKey)\s*:\s*['"][^'"]+['"]/.test(line)
      ) {
        findings.push(
          finding(
            'plaintext-provider-credential',
            rel,
            lineNo,
            'plaintext provider credential in adapter configuration; use SecretReference',
          ),
        );
      }

      if (
        rel === 'packages/payments/src/service.ts' &&
        /applyProviderCallback/.test(source) &&
        /callbacks\.ingest/.test(source) === false &&
        /applyProviderCallback/.test(line)
      ) {
        findings.push(
          finding(
            'unverified-webhook-mutation',
            rel,
            lineNo,
            'provider callback must be verified before changing payment state',
          ),
        );
      }

      if (
        rel === 'packages/payments/src/service.ts' &&
        /retryUnknownSubmission/.test(line) &&
        /decideRetry/.test(source) === false
      ) {
        findings.push(
          finding(
            'unsafe-unknown-retry',
            rel,
            lineNo,
            'unknown submission retry must consult decideRetry; do not generic-retry',
          ),
        );
      }

      if (
        !isTest &&
        rel !== 'packages/payments/src/payment.ts' &&
        /export\s+const\s+PAYMENT_STATUSES\s*=/.test(line)
      ) {
        findings.push(
          finding(
            'second-payment-state-machine',
            rel,
            lineNo,
            'PAYMENT_STATUSES is owned by packages/payments/src/payment.ts',
          ),
        );
      }
    }
  }

  return findings;
}
