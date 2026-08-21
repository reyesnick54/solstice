#!/usr/bin/env node
/**
 * Validate API specifications under api/.
 * Does not redesign the APIs. Phase B owns production API/BFF architecture.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseJsonStrict } from './check-json-integrity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);
const SECRET_RES = [
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk_live_[0-9a-zA-Z]{16,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/,
  /\bnpm_[A-Za-z0-9]{36,}\b/,
];

function deriveOperationId(method, path) {
  return `${method}_${path.replaceAll(/[{}]/g, '').replaceAll(/[^A-Za-z0-9]+/g, '_').replaceAll(/^_|_$/g, '')}`;
}

function extractOperations(text) {
  const operations = [];
  let currentPath = null;
  let currentOp = null;
  for (const line of text.split(/\r?\n/)) {
    const pathMatch = /^  (\/\S+):\s*$/.exec(line);
    if (pathMatch) {
      currentPath = pathMatch[1];
      currentOp = null;
      continue;
    }
    const methodMatch = /^    ([A-Za-z]+):\s*$/.exec(line);
    if (methodMatch && currentPath && HTTP_METHODS.has(methodMatch[1].toLowerCase())) {
      currentOp = {
        method: methodMatch[1].toLowerCase(),
        path: currentPath,
        operationId: null,
      };
      operations.push(currentOp);
      continue;
    }
    const idMatch = /^      operationId:\s*['"]?([A-Za-z0-9._-]+)['"]?\s*$/.exec(line);
    if (idMatch && currentOp) {
      currentOp.operationId = idMatch[1];
    }
  }
  for (const operation of operations) {
    if (!operation.operationId) {
      operation.operationId = deriveOperationId(operation.method, operation.path);
    }
  }
  return operations;
}

function extractRefs(text) {
  return [...text.matchAll(/\$ref:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function refExists(text, ref) {
  if (!ref.startsWith('#/')) return false;
  const parts = ref.slice(2).split('/');
  const name = parts[parts.length - 1];
  if (!name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\s+${escaped}:\\s*$`, 'm').test(text);
}

function scanSecrets(rel, text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    for (const re of SECRET_RES) {
      if (re.test(line)) {
        findings.push(`${rel}:${i + 1}: example or spec text looks like a real secret`);
      }
    }
  }
  return findings;
}

export function checkApiSpecs(root = ROOT) {
  const findings = [];
  const apiDir = join(root, 'api');
  if (!existsSync(apiDir)) {
    return { findings: ['api/: directory missing'], files: 0 };
  }
  const files = readdirSync(apiDir).sort().filter((name) => /\.(ya?ml|json)$/.test(name));
  if (files.length === 0) {
    findings.push('api/: no specification files found');
  }
  for (const name of files) {
    const rel = `api/${name}`;
    const text = readFileSync(join(root, rel), 'utf8');
    findings.push(...scanSecrets(rel, text));
    if (name.endsWith('.json')) {
      let parsed;
      try {
        parsed = parseJsonStrict(text, rel);
      } catch (error) {
        findings.push(error instanceof Error ? error.message : String(error));
        continue;
      }
      const version = parsed.apiVersion ?? parsed.event_version ?? parsed.schemaVersion ?? parsed.version;
      if (version == null) {
        findings.push(`${rel}: versioned API metadata is missing`);
      }
      continue;
    }
    if (!/^openapi:\s*3\./m.test(text)) {
      findings.push(`${rel}: openapi version must be 3.x`);
    }
    if (!/^info:/m.test(text)) {
      findings.push(`${rel}: info object is required`);
    }
    if (!/^  title:\s+\S/m.test(text)) {
      findings.push(`${rel}: info.title is required`);
    }
    if (!/^  version:\s+\S/m.test(text)) {
      findings.push(`${rel}: versioned API metadata (info.version) is required`);
    }
    if (!/^paths:/m.test(text)) {
      findings.push(`${rel}: paths object is required`);
    }
    const operations = extractOperations(text);
    if (operations.length === 0) {
      findings.push(`${rel}: no HTTP operations found`);
    }
    const ids = new Map();
    for (const operation of operations) {
      const previous = ids.get(operation.operationId);
      if (previous) {
        findings.push(
          `${rel}: duplicate operationId "${operation.operationId}" (${previous.method} ${previous.path} and ${operation.method} ${operation.path})`,
        );
      }
      ids.set(operation.operationId, operation);
    }
    for (const ref of extractRefs(text)) {
      if (!refExists(text, ref)) {
        findings.push(`${rel}: unresolved $ref ${ref}`);
      }
    }
  }
  return { findings, files: files.length };
}

function main() {
  const { findings } = checkApiSpecs(ROOT);
  if (findings.length > 0) {
    console.error('[API] specification validation failed:');
    for (const finding of findings) {
      console.error(`  ${finding}`);
    }
    process.exit(1);
  }
  console.log('[API] OpenAPI and contract specs: ok');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
