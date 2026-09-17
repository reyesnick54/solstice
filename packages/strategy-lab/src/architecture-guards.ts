import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage']);

export type ArchitectureFinding = {
  readonly rule: string;
  readonly file: string;
  readonly line: number;
  readonly message: string;
};

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

/** Ensures only qualification service / governance may emit authoritative promotion decisions. */
export function lintStrategyPromotionAuthority(root: string): ArchitectureFinding[] {
  const findings: ArchitectureFinding[] = [];
  const files = walk(join(root, 'packages/strategy-lab/src'));
  for (const file of files) {
    if (file.endsWith('promotion-authority.ts') || file.endsWith('architecture-guards.ts')) {
      continue;
    }
    const rel = relative(root, file).replaceAll('\\', '/');
    const source = readFileSync(file, 'utf8');
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      if (/PROMOTED_TO_(SHADOW|PAPER)/.test(line) && /emit|publish|dispatch/.test(line)) {
        if (!/canEmitPromotionDecision|assertAuthoritativePromotion|StrategyPromotionService/.test(source)) {
          findings.push({
            rule: 'strategy-self-promotion-forbidden',
            file: rel,
            line: i + 1,
            message: 'authoritative promotion must flow through StrategyPromotionService authority checks',
          });
        }
      }
    }
  }
  return findings;
}
