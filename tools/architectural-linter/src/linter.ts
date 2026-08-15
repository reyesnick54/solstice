import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export type Finding = {
  readonly rule: string;
  readonly file: string;
  readonly line: number;
  readonly message: string;
};

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage']);

function walk(dir: string, out: string[] = []): string[] {
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

function stripComments(line: string): string {
  const noLine = line.replace(/\/\/.*$/, '');
  return noLine;
}

export function lintSource(file: string, source: string): Finding[] {
  const findings: Finding[] = [];
  const rel = file.replaceAll('\\', '/');
  const lines = source.split(/\r?\n/);
  const isAccountDomain = /packages\/domain\/src\/account\.ts$/.test(rel);
  const isLedgerJournal = /packages\/ledger\/src\/journal\.ts$/.test(rel);
  const isMoneyMovement =
    /services\/accounts\/src\/(money-movement|banking-operations)\.ts$/.test(rel) ||
    /packages\/payments\/src\/journals\.ts$/.test(rel) ||
    /packages\/cards\/src\/journals\.ts$/.test(rel) ||
    /packages\/treasury\/src\/service\.ts$/.test(rel);
  const isBalanceOrGrowth =
    /balances\.ts$/.test(rel) || /growth\.ts$/.test(rel) || /position/.test(rel);
  const isMoneyPath =
    /packages\/money\//.test(rel) ||
    /packages\/ledger\//.test(rel) ||
    /services\/accounts\/src\/(money-movement|banking-operations|balances|available-funds)\.ts$/.test(rel) ||
    /packages\/cards\/src\/(accounting|journals|service)\.ts$/.test(rel) ||
    /packages\/personal-economic-graph\/src\/(cash-flow|recurring|snapshot|service)\.ts$/.test(rel) ||
    /packages\/platform\/src\/(growth\/(feasibility|candidates|goal-feasibility|ranking)|mandate\/compiler)\.ts$/.test(
      rel,
    );
  const isTest = /\.test\.ts$/.test(rel) || /\/tests\//.test(rel);

  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const raw = lines[i] ?? '';
    const trimmed = raw.trim();
    if (
      trimmed.startsWith('*') ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*/')
    ) {
      continue;
    }
    const line = stripComments(raw);

    if (!isAccountDomain && !isTest && /openAccount\s*\(/.test(line)) {
      const call = line.slice(line.indexOf('openAccount'));
      const inner = call.replace(/^openAccount\s*/, '');
      if (inner.startsWith('()')) {
        findings.push({
          rule: 'account-requires-execution-authority',
          file: rel,
          line: lineNo,
          message: 'openAccount() called with no ExecutionAuthority argument',
        });
      } else if (
        /openAccount\s*\(\s*\{/.test(line) ||
        /openAccount\s*\(\s*fields/.test(line) ||
        /openAccount\s*\(\s*input/.test(line)
      ) {
        findings.push({
          rule: 'account-requires-execution-authority',
          file: rel,
          line: lineNo,
          message: 'Account constructed without an ExecutionAuthority argument',
        });
      } else if (
        /openAccount\s*\(/.test(line) &&
        !/authority|verified|ea\b/i.test(line)
      ) {
        findings.push({
          rule: 'account-requires-execution-authority',
          file: rel,
          line: lineNo,
          message: 'openAccount first argument must be a verified ExecutionAuthority',
        });
      }
    }

    if (
      !isAccountDomain &&
      !isTest &&
      /accountClass:/.test(line) &&
      /openedAt:/.test(source) &&
      /ownerId:/.test(source) &&
      /status:\s*'OPEN'/.test(source) &&
      /freezeAccount|openAccount/.test(line) === false &&
      /\{\s*$/.test(line) === false
    ) {
      // handled per-file below
    }

    if (
      /postJournal\s*\(/.test(line) &&
      !isLedgerJournal &&
      !isMoneyMovement &&
      !isTest
    ) {
      findings.push({
        rule: 'journal-outside-authorized-path',
        file: rel,
        line: lineNo,
        message: 'ledger journal written outside the authorized path (Ledger.postJournal from money-movement)',
      });
    }

    if (/\.journals\.push\s*\(/.test(line) && !isLedgerJournal) {
      findings.push({
        rule: 'journal-outside-authorized-path',
        file: rel,
        line: lineNo,
        message: 'direct journals.push is forbidden outside packages/ledger/src/journal.ts',
      });
    }

    if (isAccountDomain && /^\s*(readonly\s+)?balance\s*[?:]/.test(line)) {
      findings.push({
        rule: 'no-balance-on-account',
        file: rel,
        line: lineNo,
        message: 'a balance must not be persisted as a field on an Account entity',
      });
    }

    if (
      isBalanceOrGrowth &&
      /\b(percentageReturn|returnPercentage|yieldPct|annualYield|growthRate|apy|APR)\b/i.test(
        line,
      )
    ) {
      findings.push({
        rule: 'no-blended-return-percentage',
        file: rel,
        line: lineNo,
        message: 'blended return-percentage or yield identifier is forbidden on balance/growth paths',
      });
    }

    if (isMoneyPath && !isTest) {
      if (/\bparseFloat\s*\(/.test(line) || /\bNumber\s*\(/.test(line)) {
        findings.push({
          rule: 'no-float-in-money-path',
          file: rel,
          line: lineNo,
          message: 'floating-point coercion is forbidden in a money path',
        });
      }
      if (/(?<![.\w])\d+\.\d+(?![.\w])/.test(line) && !/schemaVersion/.test(line)) {
        findings.push({
          rule: 'no-float-in-money-path',
          file: rel,
          line: lineNo,
          message: 'floating-point literal is forbidden in a money path',
        });
      }
      if (/\bMath\.(round|floor|ceil|pow)\s*\(/.test(line)) {
        findings.push({
          rule: 'no-float-in-money-path',
          file: rel,
          line: lineNo,
          message: 'IEEE Math.* rounding is forbidden in a money path; use bigint rounding modes',
        });
      }
    }
  }

  if (
    isAccountDomain === false &&
    !isTest &&
    /export type Account\s*=/.test(source) === false &&
    /ownerId:/.test(source) &&
    /accountClass:/.test(source) &&
    /openedAt:/.test(source) &&
    /status:\s*'OPEN'/.test(source) &&
    !/openAccount\(/.test(source)
  ) {
    const lineNo = lines.findIndex((l) => /status:\s*'OPEN'/.test(l)) + 1;
    if (lineNo > 0) {
      findings.push({
        rule: 'account-requires-execution-authority',
        file: rel,
        line: lineNo,
        message: 'Account-shaped object constructed without going through openAccount(ExecutionAuthority, ...)',
      });
    }
  }

  return findings;
}

export function lintTree(root: string): Finding[] {
  const files = walk(root);
  const findings: Finding[] = [];
  for (const file of files) {
    if (file.includes('/tools/architectural-linter/')) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    const rel = relative(root, file);
    findings.push(...lintSource(rel, source));
  }
  return findings;
}

export function formatFindings(findings: Finding[]): string {
  return findings
    .map((f) => `${f.file}:${f.line} [${f.rule}] ${f.message}`)
    .join('\n');
}
