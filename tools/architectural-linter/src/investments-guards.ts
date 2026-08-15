import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { Finding } from './linter.ts';

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage']);
const COMPETING_PATHS = [
  'packages/brokerage',
  'packages/portfolio',
  'packages/trading',
  'packages/wealth',
  'packages/securities-core',
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

export function lintInvestmentBoundary(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const alias of COMPETING_PATHS) {
    if (existsSync(join(root, alias))) {
      findings.push(
        finding(
          'competing-investment-system',
          alias,
          1,
          `competing investment package '${alias}' exists; use packages/investments`,
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
    const inInvestments = rel.startsWith('packages/investments/');
    const inAgent = rel.startsWith('packages/agent/');
    const inGrowth = rel.startsWith('packages/platform/src/growth/');

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      const lineNo = i + 1;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      if (inInvestments && !isTest && /^\s*(readonly\s+)?balance\s*[?:]/.test(line)) {
        findings.push(
          finding('investment-account-balance', rel, lineNo, 'InvestmentAccountProfile must not store a balance'),
        );
      }

      if (
        inAgent &&
        !isTest &&
        !rel.endsWith('isolation.ts') &&
        /packages\/investments|PaperBrokerProvider|BrokerExecutionProvider|InvestmentsService/.test(line)
      ) {
        findings.push(finding('agent-imports-broker', rel, lineNo, 'Personal Economy Agent must not import the broker or investments executor'));
      }

      if (inGrowth && !isTest && /createPaperOrder\s*\(|investments\.createPaperOrder/.test(line)) {
        findings.push(finding('growth-auto-submits-order', rel, lineNo, 'Growth Orchestrator must not submit paper orders'));
      }

      if (inInvestments && !isTest && /LIVE_INVESTMENT_EXECUTION\s*=\s*true/.test(line)) {
        findings.push(finding('live-investment-enabled', rel, lineNo, 'LIVE_INVESTMENT_EXECUTION must remain false'));
      }
    }
  }

  return findings;
}
