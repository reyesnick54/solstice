#!/usr/bin/env node
/**
 * Practical YAML integrity for workflows and API specs.
 * Does not replace a full YAML schema compiler.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFLICT_START = /^<<<<<<<($| )/;
const CONFLICT_END = /^>>>>>>>/;
const CONFLICT_SEP = /^=======$/;

function listYaml(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) listYaml(full, out);
    else if (entry.endsWith('.yml') || entry.endsWith('.yaml')) out.push(full);
  }
  return out;
}

export function checkYamlFile(rel, text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  if (text.trim().length === 0) {
    findings.push(`${rel}: empty YAML file`);
    return findings;
  }
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (CONFLICT_START.test(line) || CONFLICT_END.test(line) || CONFLICT_SEP.test(line)) {
      findings.push(`${rel}:${i + 1}: merge conflict marker`);
    }
    if (/^\t/.test(line)) {
      findings.push(`${rel}:${i + 1}: YAML must not use tab indentation`);
    }
  }
  return findings;
}

export function checkYamlIntegrity(root = ROOT) {
  const findings = [];
  const targets = [
    ...listYaml(join(root, '.github/workflows')),
    ...listYaml(join(root, 'api')),
  ];
  if (targets.length === 0) {
    findings.push('no YAML workflow or API files found');
  }
  for (const abs of targets) {
    const rel = abs.slice(root.length + 1).replaceAll('\\', '/');
    const text = readFileSync(abs, 'utf8');
    findings.push(...checkYamlFile(rel, text));
    if (rel.startsWith('.github/workflows/')) {
      if (!/^on:/m.test(text) && !/^on /m.test(text)) {
        findings.push(`${rel}: workflow is missing an on: trigger`);
      }
      if (!/^jobs:/m.test(text)) {
        findings.push(`${rel}: workflow is missing jobs:`);
      }
    }
    if (rel.startsWith('api/') && rel.endsWith('.yaml')) {
      if (!/^openapi:\s+/m.test(text)) {
        findings.push(`${rel}: OpenAPI document is missing openapi:`);
      }
      if (!/^info:/m.test(text)) {
        findings.push(`${rel}: OpenAPI document is missing info:`);
      }
    }
  }
  return { findings, files: targets.length };
}

function main() {
  const { findings } = checkYamlIntegrity(ROOT);
  if (findings.length > 0) {
    console.error('[INTEGRITY] YAML validation failed:');
    for (const finding of findings) {
      console.error(`  ${finding}`);
    }
    process.exit(1);
  }
  console.log('[INTEGRITY] YAML: ok');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
