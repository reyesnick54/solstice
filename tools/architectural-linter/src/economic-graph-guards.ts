import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { Finding } from './linter.ts';

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage']);
const COMPETING_GRAPH_PATHS = [
  'packages/economic-graph',
  'packages/financial-graph',
  'packages/user-graph',
  'packages/economic-memory',
  'packages/personal-finance-graph',
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

export function lintEconomicGraphBoundary(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const alias of COMPETING_GRAPH_PATHS) {
    if (existsSync(join(root, alias))) {
      findings.push(
        finding(
          'competing-economic-graph',
          alias,
          1,
          `competing economic graph package '${alias}' exists; use packages/personal-economic-graph`,
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
    const inPeg =
      rel.startsWith('packages/personal-economic-graph/') || rel.startsWith('services/economic-graph/');

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      const lineNo = i + 1;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      if (inPeg && !isTest && /postJournal\s*\(|postPaymentJournal\s*\(|postCardJournal\s*\(/.test(line)) {
        findings.push(
          finding('peg-posts-ledger', rel, lineNo, 'Personal Economic Graph must not post ledger journals'),
        );
      }

      if (
        inPeg &&
        !isTest &&
        /issuer\.issue\s*\(|AuthorityIssuer/.test(line) &&
        !/import type/.test(line)
      ) {
        findings.push(
          finding(
            'peg-issues-execution-authority',
            rel,
            lineNo,
            'Personal Economic Graph must not issue Execution Authority',
          ),
        );
      }

      if (inPeg && !isTest && /openAccount\s*\(/.test(line)) {
        findings.push(
          finding('peg-opens-account', rel, lineNo, 'Personal Economic Graph must not open accounts'),
        );
      }

      if (
        inPeg &&
        !isTest &&
        /confidence:\s*'AUTHORITATIVE'/.test(line) &&
        /INFERRED|DERIVED|USER_DECLARED|MODEL_INFERENCE/.test(line)
      ) {
        findings.push(
          finding(
            'inferred-labeled-authoritative',
            rel,
            lineNo,
            'inferred or derived facts must not be labeled AUTHORITATIVE',
          ),
        );
      }

      if (
        inPeg &&
        !isTest &&
        /crossCurrencyTotal\s*[:=]/.test(line) &&
        !/null|forbidden|must not|valuationContext/.test(line)
      ) {
        findings.push(
          finding(
            'peg-cross-currency-total',
            rel,
            lineNo,
            'PEG must not produce a cross-currency total without valuation context',
          ),
        );
      }

      if (
        inPeg &&
        !isTest &&
        /DATABASE_URL|PGPASSWORD|unrestricted.*credential|agent.*database credential/i.test(line) &&
        !/must not|do not|not receive|agents do not/.test(line)
      ) {
        findings.push(
          finding(
            'peg-unrestricted-ai-credentials',
            rel,
            lineNo,
            'PEG must not grant unrestricted database credentials to agents',
          ),
        );
      }
    }
  }

  return findings;
}
