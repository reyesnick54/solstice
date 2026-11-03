#!/usr/bin/env node
/**
 * Fail closed if quarantined OSS assimilation trees are wired into build or runtime.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'vendor/assimilation/SOURCE_IMPORT_MANIFEST.json');
const QUARANTINE = join(ROOT, 'vendor/assimilation/QUARANTINE.json');

function main() {
  const findings = [];

  if (!existsSync(MANIFEST)) {
    findings.push('missing vendor/assimilation/SOURCE_IMPORT_MANIFEST.json');
  }
  if (!existsSync(QUARANTINE)) {
    findings.push('missing vendor/assimilation/QUARANTINE.json');
  }

  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  for (const ws of pkg.workspaces ?? []) {
    if (ws.includes('vendor') || ws.includes('assimilation')) {
      findings.push(`package.json workspaces must not include assimilation vendor paths (${ws})`);
    }
  }

  const tsconfig = JSON.parse(readFileSync(join(ROOT, 'tsconfig.json'), 'utf8'));
  const include = tsconfig.include ?? [];
  for (const pattern of include) {
    if (pattern.startsWith('vendor/') || pattern.includes('assimilation')) {
      findings.push(`tsconfig include must not cover assimilation vendor paths (${pattern})`);
    }
  }
  const exclude = tsconfig.exclude ?? [];
  if (!exclude.some((entry) => entry === 'vendor/**' || entry === 'vendor/assimilation/**')) {
    findings.push('tsconfig exclude must list vendor/** or vendor/assimilation/**');
  }

  const dockerignore = readFileSync(join(ROOT, '.dockerignore'), 'utf8');
  if (!/vendor\/assimilation/.test(dockerignore)) {
    findings.push('.dockerignore must exclude vendor/assimilation from container contexts');
  }

  const testRunner = readFileSync(join(ROOT, 'scripts/run-repository-tests.mjs'), 'utf8');
  if (/vendor\/assimilation/.test(testRunner)) {
    findings.push('repository test globs must not include vendor/assimilation');
  }

  if (existsSync(MANIFEST)) {
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    for (const source of manifest.sources ?? []) {
      if (source.runtimeDependency !== false || source.upstreamRequiredAtRuntime !== false || source.submodule !== false) {
        findings.push(`${source.sourceName}: assimilation manifest must declare non-runtime, non-submodule posture`);
      }
      if (source.sourceAssimilationState !== 'QUARANTINED') {
        findings.push(`${source.sourceName}: sourceAssimilationState must remain QUARANTINED until native conversion`);
      }
      const vendorPath = join(ROOT, source.vendorPath ?? '');
      if (!existsSync(vendorPath)) {
        findings.push(`${source.sourceName}: missing imported tree at ${source.vendorPath}`);
      }
    }
  }

  if (findings.length > 0) {
    console.error('[ASSIMILATION QUARANTINE] failed:');
    for (const finding of findings) {
      console.error(`  ${finding}`);
    }
    process.exit(1);
  }
  console.log('[ASSIMILATION QUARANTINE] vendor/assimilation is excluded from compile, workspaces, tests, and container bundles');
}

main();
