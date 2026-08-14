import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { Finding } from './linter.ts';

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage']);
const COMPETING_PATHS = [
  'packages/aml',
  'packages/fraud',
  'packages/sanctions',
  'packages/risk-compliance',
  'packages/compliance',
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

export function lintComplianceBoundary(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const alias of COMPETING_PATHS) {
    if (existsSync(join(root, alias))) {
      findings.push(
        finding(
          'competing-compliance-package',
          alias,
          1,
          `competing compliance package '${alias}' exists; use packages/kernel/src/compliance`,
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
    const inCompliance = rel.startsWith('packages/kernel/src/compliance/');

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      const lineNo = i + 1;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      if (
        inCompliance &&
        !isTest &&
        /issuer\.issue\s*\(|AuthorityIssuer\.issue/.test(line)
      ) {
        findings.push(
          finding(
            'screening-issues-execution-authority',
            rel,
            lineNo,
            'screening/fraud must not issue Execution Authority',
          ),
        );
      }

      if (
        inCompliance &&
        !isTest &&
        /outcome\s*=\s*'CLEAR'/.test(line) &&
        /UNAVAILABLE/.test(source) &&
        /available\s*===\s*false|!raw\.available|!.*available/.test(line)
      ) {
        findings.push(
          finding(
            'outage-implicit-clear',
            rel,
            lineNo,
            'provider unavailable must not be rewritten to CLEAR',
          ),
        );
      }

      if (
        !isTest &&
        /providerPayload|rawProvider|articleBody|articleContent/.test(line) &&
        (rel.startsWith('packages/events/') || rel.includes('evidence') || inCompliance)
      ) {
        if (
          /SENSITIVE_PAYLOAD_KEYS|must not include|assertSafeEventPayload|forbidden|must not/.test(
            source,
          ) &&
          rel === 'packages/events/src/envelope.ts'
        ) {
          continue;
        }
        if (/must not|forbidden|SENSITIVE/.test(line)) {
          continue;
        }
        findings.push(
          finding(
            'raw-provider-payload',
            rel,
            lineNo,
            'do not write raw provider payloads or article bodies to events/evidence',
          ),
        );
      }
    }
  }
  return findings;
}
