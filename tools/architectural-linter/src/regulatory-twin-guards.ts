import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { Finding } from './linter.ts';

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage']);
const COMPETING_PATHS = [
  'packages/regulatory-digital-twin',
  'packages/policy-engine-v2',
  'packages/compliance-simulator-v2',
  'packages/kernel-sandbox',
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

export function lintRegulatoryTwinBoundary(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const alias of COMPETING_PATHS) {
    if (existsSync(join(root, alias))) {
      findings.push(
        finding(
          'competing-regulatory-twin',
          alias,
          1,
          `competing Regulatory Digital Twin package '${alias}' exists; use packages/regulatory-twin`,
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
    const inRdt = rel.startsWith('packages/regulatory-twin/');

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      const lineNo = i + 1;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      if (
        inRdt &&
        !isTest &&
        /postJournal\s*\(|postPaymentJournal\s*\(|postCardJournal\s*\(|reserveLiquidity\s*\(/.test(line)
      ) {
        findings.push(
          finding('rdt-posts-ledger', rel, lineNo, 'Regulatory Digital Twin must not mutate financial state'),
        );
      }

      if (
        inRdt &&
        !isTest &&
        /issuer\.issue\s*\(|new AuthorityIssuer|AuthorityIssuer\.issue|kernel\.submit\s*\(/.test(line)
      ) {
        findings.push(
          finding(
            'rdt-issues-execution-authority',
            rel,
            lineNo,
            'Regulatory Digital Twin must not issue Execution Authority',
          ),
        );
      }

      if (inRdt && !isTest && /class\s+(PolicyEngine|ComplianceKernel)\b/.test(line)) {
        findings.push(
          finding(
            'rdt-second-kernel',
            rel,
            lineNo,
            'do not create a second Compliance Kernel or policy engine inside RDT',
          ),
        );
      }

      if (
        inRdt &&
        !isTest &&
        /legalReviewStatus:\s*'CONFIRMED_BY_COUNSEL'/.test(line) &&
        !/FORBIDDEN|cannot|refused|never/.test(source)
      ) {
        findings.push(
          finding(
            'rdt-fake-counsel',
            rel,
            lineNo,
            'RDT cannot mark CONFIRMED_BY_COUNSEL without counsel evidence',
          ),
        );
      }

      if (
        inRdt &&
        !isTest &&
        /productionRegistry\.activatePack|this\.productionRegistry\.activatePack/.test(line)
      ) {
        findings.push(
          finding(
            'rdt-activates-production-policy',
            rel,
            lineNo,
            'RDT must not activate candidate packs on the production registry',
          ),
        );
      }
    }
  }

  return findings;
}
