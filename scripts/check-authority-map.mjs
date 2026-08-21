#!/usr/bin/env node
/**
 * Validate docs/productization/sunrey-authority-map.json.
 * Fail closed on malformed maps, duplicate authorities, or missing owners.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseJsonStrict } from './check-json-integrity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const AUTHORITY_MAP_REL = 'docs/productization/sunrey-authority-map.json';

const REQUIRED_NON_NEGOTIABLE = [
  'LEDGER',
  'KERNEL',
  'EXECUTION_AUTHORITY',
  'AI',
  'FRONTEND',
  'SUNREY_CHAIN',
  'SUNREY_COIN_MOONREY_COIN',
  'PROVIDERS',
  'PRODUCTION',
];

export function loadAuthorityMap(root = ROOT) {
  const rel = AUTHORITY_MAP_REL;
  const abs = join(root, rel);
  if (!existsSync(abs)) {
    throw new Error(`${rel}: missing authority map`);
  }
  return parseJsonStrict(readFileSync(abs, 'utf8'), rel);
}

export function checkAuthorityMap(root = ROOT) {
  const findings = [];
  let map;
  try {
    map = loadAuthorityMap(root);
  } catch (error) {
    return { findings: [error instanceof Error ? error.message : String(error)], map: null };
  }

  if (map.schemaVersion !== 1) {
    findings.push(`${AUTHORITY_MAP_REL}: schemaVersion must be 1`);
  }
  if (map.status !== 'FROZEN_FOR_PRODUCTIZATION') {
    findings.push(`${AUTHORITY_MAP_REL}: status must remain FROZEN_FOR_PRODUCTIZATION`);
  }

  const posture = map.productionPosture ?? {};
  for (const [name, expected] of [
    ['PRODUCTION_READY', false],
    ['PRODUCTION_ACTIVE', false],
    ['LIVE_CONNECTIVITY_ENABLED', false],
    ['production_authorized', false],
  ]) {
    if (posture[name] !== expected) {
      findings.push(`${AUTHORITY_MAP_REL}: productionPosture.${name} must be ${expected}`);
    }
  }

  const nonNeg = map.nonNegotiable ?? {};
  for (const key of REQUIRED_NON_NEGOTIABLE) {
    if (typeof nonNeg[key] !== 'string' || nonNeg[key].length === 0) {
      findings.push(`${AUTHORITY_MAP_REL}: nonNegotiable.${key} is required`);
    }
  }

  const authorities = Array.isArray(map.authorities) ? map.authorities : [];
  if (authorities.length === 0) {
    findings.push(`${AUTHORITY_MAP_REL}: authorities[] must not be empty`);
  }
  const seenIds = new Map();
  const seenNames = new Map();
  for (const row of authorities) {
    if (!row || typeof row !== 'object') {
      findings.push(`${AUTHORITY_MAP_REL}: malformed authority row`);
      continue;
    }
    if (typeof row.id !== 'string' || row.id.length === 0) {
      findings.push(`${AUTHORITY_MAP_REL}: authority missing id`);
      continue;
    }
    if (seenIds.has(row.id)) {
      findings.push(`${AUTHORITY_MAP_REL}: duplicate canonical authority id "${row.id}"`);
    }
    seenIds.set(row.id, row);
    if (typeof row.authority === 'string') {
      const previous = seenNames.get(row.authority);
      if (previous && previous !== row.owner) {
        findings.push(
          `${AUTHORITY_MAP_REL}: duplicate canonical authority "${row.authority}" owned by ${previous} and ${row.owner}`,
        );
      }
      seenNames.set(row.authority, row.owner);
    }
    if (row.unique !== true) {
      findings.push(`${AUTHORITY_MAP_REL}: authority ${row.id} must set unique=true`);
    }
    if (typeof row.owner !== 'string' || !existsSync(join(root, row.owner))) {
      findings.push(`${AUTHORITY_MAP_REL}: authority ${row.id} owner path missing: ${String(row.owner)}`);
    }
    if (typeof row.authoritativePath === 'string' && !existsSync(join(root, row.authoritativePath))) {
      findings.push(`${AUTHORITY_MAP_REL}: authority ${row.id} authoritativePath missing: ${row.authoritativePath}`);
    }
  }

  for (const id of map.requiredAuthorityIds ?? []) {
    if (!seenIds.has(id)) {
      findings.push(`${AUTHORITY_MAP_REL}: required authority "${id}" is absent`);
    }
  }

  return { findings, map };
}

function main() {
  const { findings } = checkAuthorityMap(ROOT);
  if (findings.length > 0) {
    console.error('[ARCHITECTURE] authority-map failed:');
    for (const finding of findings) {
      console.error(`  ${finding}`);
    }
    process.exit(1);
  }
  console.log('[ARCHITECTURE] authority-map: ok');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
