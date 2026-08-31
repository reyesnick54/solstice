#!/usr/bin/env node
/**
 * Repository YAML integrity:
 * - parse every tracked *.yaml / *.yml file
 * - reject merge conflict markers and tab indentation
 * - apply lightweight structural checks for provider catalogs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, parseAllDocuments, YAMLParseError } from 'yaml';
import { validateCatalog } from './lib/free-api-catalog-validator.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFLICT_START = /^<<<<<<<($| )/;
const CONFLICT_END = /^>>>>>>>/;
const CONFLICT_SEP = /^=======$/;
const HELM_TEMPLATE = /\{\{-?|\{\{/;

const PROVIDER_CATALOG_FILES = new Set([
  'config/providers/free-api-catalog.yaml',
  'config/providers/wave2-catalog-entries.yaml',
  'config/providers/wave2-access-discovery-catalog-entries.yaml',
  'config/providers/wave3-crypto-catalog-entries.yaml',
  'config/providers/wave4-catalog-entries.yaml',
  'config/providers/wave5-energy-resource-catalog-entries.yaml',
  'config/providers/wave5-physical-economy-catalog-entries.yaml',
  'config/providers/wave5-travel-catalog-entries.yaml',
  'config/providers/wave6-health-hin-catalog-entries.yaml',
  'config/providers/wave6-opportunity-skills-catalog-entries.yaml',
]);

export function listTrackedYaml(root = ROOT) {
  const output = execFileSync('git', ['ls-files', '*.yaml', '*.yml'], {
    cwd: root,
    encoding: 'utf8',
  });
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

function isHelmTemplate(rel, text) {
  return rel.includes('/templates/') || HELM_TEMPLATE.test(text);
}

function parseYamlText(rel, text) {
  if (/^---$/m.test(text)) {
    parseAllDocuments(text);
    return;
  }
  parseYaml(text);
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

  if (isHelmTemplate(rel, text)) {
    return findings;
  }

  try {
    parseYamlText(rel, text);
  } catch (error) {
    if (error instanceof YAMLParseError) {
      const line = error.linePos?.[0]?.line ?? '?';
      const col = error.linePos?.[0]?.col ?? '?';
      findings.push(`${rel}:${line}:${col}: YAML parse error: ${error.message}`);
    } else {
      findings.push(`${rel}: YAML parse error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return findings;
}

function validateProviderCatalogFile(rel, text, findings) {
  if (isHelmTemplate(rel, text)) {
    return;
  }

  let parsed;
  try {
    parsed = /^---$/m.test(text) ? parseAllDocuments(text)[0] : parseYaml(text);
  } catch {
    return;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    findings.push(`${rel}: provider catalog root must be an object`);
    return;
  }

  if (!Array.isArray(parsed.providers)) {
    findings.push(`${rel}: provider catalog must include a providers array`);
    return;
  }

  if (rel === 'config/providers/free-api-catalog.yaml') {
    const result = validateCatalog(parsed);
    if (!result.ok) {
      for (const error of result.errors) {
        findings.push(`${rel}: ${error}`);
      }
    }
    return;
  }

  const ids = new Set();
  for (const [index, provider] of parsed.providers.entries()) {
    if (!provider || typeof provider !== 'object') {
      findings.push(`${rel}: providers[${index}] must be an object`);
      continue;
    }
    if (typeof provider.provider_id !== 'string' || provider.provider_id.length === 0) {
      findings.push(`${rel}: providers[${index}].provider_id is required`);
    } else if (ids.has(provider.provider_id)) {
      findings.push(`${rel}: providers[${index}].provider_id duplicate "${provider.provider_id}"`);
    } else {
      ids.add(provider.provider_id);
    }
    if (typeof provider.name !== 'string' || provider.name.trim().length === 0) {
      findings.push(`${rel}: providers[${index}].name is required`);
    }
    if (typeof provider.primary_category !== 'string' || provider.primary_category.trim().length === 0) {
      findings.push(`${rel}: providers[${index}].primary_category is required`);
    }
  }
}

function validateOpenApiFile(rel, text, findings) {
  if (!/^openapi:\s+/m.test(text)) {
    findings.push(`${rel}: OpenAPI document is missing openapi:`);
  }
  if (!/^info:/m.test(text)) {
    findings.push(`${rel}: OpenAPI document is missing info:`);
  }
}

function validateWorkflowFile(rel, text, findings) {
  if (!/^on:/m.test(text) && !/^on /m.test(text)) {
    findings.push(`${rel}: workflow is missing an on: trigger`);
  }
  if (!/^jobs:/m.test(text)) {
    findings.push(`${rel}: workflow is missing jobs:`);
  }
}

export function checkYamlIntegrity(root = ROOT) {
  const findings = [];
  const targets = listTrackedYaml(root);

  if (targets.length === 0) {
    findings.push('no tracked YAML files found');
  }

  for (const rel of targets) {
    const abs = join(root, rel);
    if (!existsSync(abs)) {
      findings.push(`${rel}: tracked file missing on disk`);
      continue;
    }
    if (!statSync(abs).isFile()) {
      findings.push(`${rel}: tracked path is not a file`);
      continue;
    }

    const text = readFileSync(abs, 'utf8');
    findings.push(...checkYamlFile(rel, text));

    if (PROVIDER_CATALOG_FILES.has(rel)) {
      validateProviderCatalogFile(rel, text, findings);
    }
    if (rel.startsWith('api/') && rel.endsWith('.yaml')) {
      validateOpenApiFile(rel, text, findings);
    }
    if (rel.startsWith('.github/workflows/')) {
      validateWorkflowFile(rel, text, findings);
    }
  }

  return { findings, files: targets.length };
}

function main() {
  const { findings, files } = checkYamlIntegrity(ROOT);
  if (findings.length > 0) {
    console.error('[INTEGRITY] YAML validation failed:');
    for (const finding of findings) {
      console.error(`  ${finding}`);
    }
    process.exit(1);
  }
  console.log(`[INTEGRITY] YAML: ok (${files} tracked files)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
