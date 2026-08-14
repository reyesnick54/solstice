import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { Finding } from './linter.ts';

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage']);
const COMPETING_CRYPTO_PATHS = ['packages/crypto', 'packages/kms', 'packages/secrets'];
const BUSINESS_SERVICE_FILES = [
  'services/accounts/src/money-movement.ts',
  'services/accounts/src/open-account.ts',
  'services/accounts/src/balances.ts',
  'services/accounts/src/catalog.ts',
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

export function lintSecurityBoundary(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const alias of COMPETING_CRYPTO_PATHS) {
    if (existsSync(join(root, alias))) {
      findings.push(
        finding(
          'competing-crypto-provider',
          alias,
          1,
          `competing cryptographic package '${alias}' exists; use packages/security`,
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
    const inSecurity = rel.startsWith('packages/security/');
    const isCompositionRoot =
      rel === 'services/accounts/src/runtime.ts' ||
      rel === 'services/accounts/src/postgres-runtime.ts' ||
      rel === 'services/accounts/src/security-audit.ts';

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      const lineNo = i + 1;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      if (
        BUSINESS_SERVICE_FILES.includes(rel) &&
        /packages\/security\/src\/simulation\.ts|createSimulationKeyProvider|SimulationKeyProvider/.test(
          line,
        )
      ) {
        findings.push(
          finding(
            'business-imports-dev-key-provider',
            rel,
            lineNo,
            'business services must not import the development/simulation key provider',
          ),
        );
      }

      if (
        !inSecurity &&
        !isTest &&
        !isCompositionRoot &&
        rel.startsWith('services/') &&
        /createHmac\s*\(/.test(line)
      ) {
        findings.push(
          finding(
            'raw-execution-authority-signing-key',
            rel,
            lineNo,
            'business services must not HMAC Execution Authority material directly; use AuthorityIssuer → KeyProvider',
          ),
        );
      }

      if (
        rel.startsWith('packages/domain/') &&
        !isTest &&
        /PrivateKeyMaterial|BEGIN [A-Z ]*PRIVATE KEY/.test(line)
      ) {
        findings.push(
          finding(
            'private-key-in-domain-object',
            rel,
            lineNo,
            'domain objects must not hold private key material',
          ),
        );
      }

      if (
        !inSecurity &&
        !isTest &&
        !isCompositionRoot &&
        rel.startsWith('services/') &&
        /AUTHORITY_SECRET|signingSecret\s*=\s*['"][^'"]+['"]/.test(line)
      ) {
        findings.push(
          finding(
            'raw-secret-constant',
            rel,
            lineNo,
            'do not embed raw signing secrets in protected production service paths',
          ),
        );
      }
    }
  }

  return findings;
}
