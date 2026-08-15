import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { Finding } from './linter.ts';

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage']);
const COMPETING_PATHS = [
  'packages/growth-os',
  'packages/compounder',
  'packages/wealth-agent',
  'packages/mandates-v2',
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

export function lintGrowthBoundary(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const alias of COMPETING_PATHS) {
    if (existsSync(join(root, alias))) {
      findings.push(
        finding(
          'competing-growth-system',
          alias,
          1,
          `competing growth package '${alias}' exists; use packages/platform`,
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
    const inGrowth = rel.startsWith('packages/platform/');
    const inAgent = rel.startsWith('packages/agent/');

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      const lineNo = i + 1;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      if (
        inAgent &&
        !isTest &&
        !rel.endsWith('isolation.ts') &&
        /packages\/platform|@solstice\/platform/.test(line)
      ) {
        findings.push(
          finding('agent-depends-on-platform', rel, lineNo, 'packages/agent must not depend on packages/platform'),
        );
      }

      if (
        (inGrowth || inAgent) &&
        !isTest &&
        /postJournal\s*\(|postPaymentJournal\s*\(|postCardJournal\s*\(/.test(line)
      ) {
        findings.push(
          finding('growth-posts-ledger', rel, lineNo, 'Growth Orchestrator / agent must not post ledger journals'),
        );
      }

      if (
        (inGrowth || inAgent) &&
        !isTest &&
        /issuer\.issue\s*\(|new AuthorityIssuer|AuthorityIssuer\.issue/.test(line)
      ) {
        findings.push(
          finding(
            'growth-issues-execution-authority',
            rel,
            lineNo,
            'Growth Orchestrator must not issue Execution Authority',
          ),
        );
      }

      if ((inGrowth || inAgent) && !isTest && /submitToRail|railAdapter\.submit|adapter\.submit\(/.test(line)) {
        findings.push(
          finding('growth-calls-rail-execution', rel, lineNo, 'Growth Orchestrator must not call rail execution'),
        );
      }

      if (inGrowth && !isTest && /class\s+(PolicyEngine|RiskEngine|ScreeningEngine)\b/.test(line)) {
        findings.push(
          finding(
            'growth-second-policy-engine',
            rel,
            lineNo,
            'do not create a second policy or risk engine inside Growth',
          ),
        );
      }

      if (
        inGrowth &&
        !isTest &&
        /guaranteedReturn|guaranteed_return|promisedReturn|promised_return/.test(line)
      ) {
        findings.push(
          finding(
            'guaranteed-return-as-fact',
            rel,
            lineNo,
            'guaranteed-return output must not be encoded as a deterministic fact',
          ),
        );
      }

      if (
        inGrowth &&
        !isTest &&
        /state:\s*'ACTIVE'/.test(line) &&
        /interpretation|sourceText|modelText/.test(line) &&
        !/compileEconomicMandate|confirmation/.test(line)
      ) {
        findings.push(
          finding(
            'ai-mandate-activated-without-compiler',
            rel,
            lineNo,
            'AI-generated mandate text cannot be activated without deterministic validation',
          ),
        );
      }

      if (
        inGrowth &&
        !isTest &&
        /overrideForbidden:\s*false/.test(line)
      ) {
        findings.push(
          finding('hard-constraint-model-override', rel, lineNo, 'hard constraints cannot be overridden by a model'),
        );
      }

      if (
        inGrowth &&
        !isTest &&
        /plan\.state\s*===\s*'STALE'/.test(line) &&
        /orderedProposedActions|materializeGrowthAction/.test(line) &&
        !/cannot|must not|STALE/.test(source)
      ) {
        findings.push(
          finding('stale-plan-treated-as-current', rel, lineNo, 'stale GrowthPlan must not be treated as current'),
        );
      }

      if (
        inGrowth &&
        !isTest &&
        /REVIEW_INVESTMENT_OPPORTUNITY_FUTURE/.test(line) &&
        /actionType:\s*ACTION_TYPES/.test(line)
      ) {
        findings.push(
          finding(
            'unsupported-investment-materialized',
            rel,
            lineNo,
            'unsupported investment action cannot materialize an ActionIntent',
          ),
        );
      }
    }
  }

  return findings;
}
