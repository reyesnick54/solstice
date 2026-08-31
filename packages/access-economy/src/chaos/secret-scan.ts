/**
 * ACCESS Wave 5 — secret leak scan for Access surfaces (fixtures/tests only).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN_PATTERNS: readonly { readonly name: string; readonly pattern: RegExp }[] = Object.freeze([
  { name: 'api_key', pattern: /api[_-]?key\s*[:=]\s*['"][a-z0-9]{20,}/i },
  { name: 'webhook_secret', pattern: /whsec_[a-z0-9]{20,}/i },
  { name: 'pan', pattern: /\b4[0-9]{12}(?:[0-9]{3})?\b/ },
  { name: 'cvv', pattern: /\bcvv\s*[:=]\s*['"]?\d{3,4}/i },
  { name: 'private_key', pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/ },
  { name: 'seed_phrase', pattern: /\b(abandon|ability|able|about)\b.*\b(zoo)\b/i },
  { name: 'baas_credential', pattern: /baas[_-]?(api|secret|token)\s*[:=]\s*['"][a-z0-9]{16,}/i },
]);

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.json', '.md', '.yaml', '.yml']);

export type SecretScanFinding = {
  readonly file: string;
  readonly pattern: string;
};

function walk(dir: string, roots: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git') {
        continue;
      }
      walk(full, roots);
      continue;
    }
    const ext = entry.includes('.') ? `.${entry.split('.').pop()}` : '';
    if (!SCAN_EXTENSIONS.has(ext)) {
      continue;
    }
    roots.push(full);
  }
}

export function scanAccessPathsForSecrets(paths: readonly string[]): readonly SecretScanFinding[] {
  const files: string[] = [];
  for (const root of paths) {
    const stat = statSync(root);
    if (stat.isDirectory()) {
      walk(root, files);
    } else {
      files.push(root);
    }
  }

  const findings: SecretScanFinding[] = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.pattern.test(source)) {
        findings.push(Object.freeze({ file, pattern: rule.name }));
      }
    }
  }
  return Object.freeze(findings);
}
