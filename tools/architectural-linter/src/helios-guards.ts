import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { Finding } from './linter.ts';

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage']);
const COMPETING_PATHS = [
  'packages/helios',
  'packages/helios-permissions',
  'packages/helios-authority',
  'packages/work-order-engine',
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

export function lintHeliosBoundary(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const alias of COMPETING_PATHS) {
    if (existsSync(join(root, alias))) {
      findings.push(
        finding(
          'competing-helios-system',
          alias,
          1,
          `competing HELIOS package '${alias}' exists; extend packages/platform/src/helios`,
        ),
      );
    }
  }

  const files = walk(root);
  for (const file of files) {
    const rel = relative(root, file).replaceAll('\\', '/');
    if (!rel.startsWith('packages/platform/src/helios/')) {
      continue;
    }
    if (rel.endsWith('.test.ts')) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      const lineNo = i + 1;
      if (/AuthorityIssuer|issueExecutionAuthority|postJournal|openAccount/.test(line)) {
        findings.push(
          finding(
            'helios-bypasses-canonical-authority',
            rel,
            lineNo,
            'HELIOS work order code must not issue Execution Authority or post journals directly',
          ),
        );
      }
      if (/grantsExecutionAuthority:\s*true|authorizesFinancialExecution:\s*true/.test(line)) {
        findings.push(
          finding(
            'helios-grants-execution-authority',
            rel,
            lineNo,
            'HELIOS work orders must never grant Execution Authority or authorize financial execution',
          ),
        );
      }
    }
  }

  return findings;
}
