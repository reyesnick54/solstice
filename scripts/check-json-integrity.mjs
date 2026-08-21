#!/usr/bin/env node
/**
 * Strict JSON integrity check.
 *
 * JSON.parse silently keeps the last duplicate key. This scanner walks
 * objects and rejects duplicate keys, then validates architecture IDs.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export class JsonIntegrityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'JsonIntegrityError';
  }
}

function lineOf(text, pos) {
  return text.slice(0, pos).split('\n').length;
}

function skipWs(text, i) {
  while (i < text.length && /[ \t\r\n]/.test(text[i])) i += 1;
  return i;
}

function parseString(text, i) {
  if (text[i] !== '"') {
    throw new JsonIntegrityError(`expected string at line ${lineOf(text, i)}`);
  }
  i += 1;
  let out = '';
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      out += c;
      i += 1;
      if (i < text.length) {
        out += text[i];
        i += 1;
      }
      continue;
    }
    if (c === '"') {
      return { value: out, next: i + 1 };
    }
    out += c;
    i += 1;
  }
  throw new JsonIntegrityError('unterminated string');
}

function parseNumber(text, i) {
  const start = i;
  if (text[i] === '-') i += 1;
  while (i < text.length && /[0-9.eE+-]/.test(text[i])) i += 1;
  const raw = text.slice(start, i);
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) {
    throw new JsonIntegrityError(`invalid number ${raw} at line ${lineOf(text, start)}`);
  }
  return { value: Number(raw), next: i };
}

export function parseJsonStrict(text, path = 'input') {
  let i = skipWs(text, 0);

  function parseValue() {
    i = skipWs(text, i);
    if (i >= text.length) {
      throw new JsonIntegrityError(`${path}: unexpected end of input`);
    }
    const c = text[i];
    if (c === '{') return parseObject();
    if (c === '[') return parseArray();
    if (c === '"') {
      const parsed = parseString(text, i);
      i = parsed.next;
      return parsed.value;
    }
    if (c === '-' || /[0-9]/.test(c)) {
      const parsed = parseNumber(text, i);
      i = parsed.next;
      return parsed.value;
    }
    if (text.startsWith('true', i)) {
      i += 4;
      return true;
    }
    if (text.startsWith('false', i)) {
      i += 5;
      return false;
    }
    if (text.startsWith('null', i)) {
      i += 4;
      return null;
    }
    throw new JsonIntegrityError(`${path}: unexpected ${c} at line ${lineOf(text, i)}`);
  }

  function parseObject() {
    const start = i;
    i += 1;
    const obj = {};
    const seen = new Map();
    i = skipWs(text, i);
    if (text[i] === '}') {
      i += 1;
      return obj;
    }
    while (true) {
      i = skipWs(text, i);
      if (text[i] !== '"') {
        throw new JsonIntegrityError(`${path}: expected object key at line ${lineOf(text, i)}`);
      }
      const keyPos = i;
      const keyParsed = parseString(text, i);
      const key = keyParsed.value;
      i = keyParsed.next;
      if (seen.has(key)) {
        throw new JsonIntegrityError(
          `${path}: duplicate key "${key}" at line ${lineOf(text, keyPos)} (first at line ${seen.get(key)})`,
        );
      }
      seen.set(key, lineOf(text, keyPos));
      i = skipWs(text, i);
      if (text[i] !== ':') {
        throw new JsonIntegrityError(`${path}: expected ':' after "${key}" at line ${lineOf(text, i)}`);
      }
      i += 1;
      obj[key] = parseValue();
      i = skipWs(text, i);
      if (text[i] === ',') {
        i += 1;
        i = skipWs(text, i);
        if (text[i] === '}') {
          throw new JsonIntegrityError(`${path}: trailing comma at line ${lineOf(text, i)}`);
        }
        continue;
      }
      if (text[i] === '}') {
        i += 1;
        return obj;
      }
      throw new JsonIntegrityError(
        `${path}: expected ',' or '}' at line ${lineOf(text, i)} (object started line ${lineOf(text, start)})`,
      );
    }
  }

  function parseArray() {
    i += 1;
    const arr = [];
    i = skipWs(text, i);
    if (text[i] === ']') {
      i += 1;
      return arr;
    }
    while (true) {
      arr.push(parseValue());
      i = skipWs(text, i);
      if (text[i] === ',') {
        i += 1;
        i = skipWs(text, i);
        if (text[i] === ']') {
          throw new JsonIntegrityError(`${path}: trailing comma in array at line ${lineOf(text, i)}`);
        }
        continue;
      }
      if (text[i] === ']') {
        i += 1;
        return arr;
      }
      throw new JsonIntegrityError(`${path}: expected ',' or ']' at line ${lineOf(text, i)}`);
    }
  }

  const value = parseValue();
  i = skipWs(text, i);
  if (i < text.length) {
    throw new JsonIntegrityError(`${path}: trailing content at line ${lineOf(text, i)}`);
  }
  return value;
}

export function collectIntegrityTargets(root = ROOT) {
  const targets = [join(root, 'package.json'), join(root, 'docs/architecture/manifest.json')];
  const baseline = join(root, 'docs/architecture/integrity-baseline.json');
  if (existsSync(baseline)) {
    targets.push(baseline);
  }
  const chunksDir = join(root, 'docs/architecture/chunks');
  if (existsSync(chunksDir)) {
    for (const entry of readdirSync(chunksDir).sort()) {
      if (entry.endsWith('.json')) {
        targets.push(join(chunksDir, entry));
      }
    }
  }
  const productizationDir = join(root, 'docs/productization');
  if (existsSync(productizationDir)) {
    for (const entry of readdirSync(productizationDir).sort()) {
      if (entry.endsWith('.json')) {
        targets.push(join(productizationDir, entry));
      }
    }
  }
  return targets;
}

function uniqueIds(items, path, label) {
  const seen = new Map();
  for (const item of items ?? []) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string') {
      throw new JsonIntegrityError(`${path}: malformed ${label} object missing string id`);
    }
    if (seen.has(item.id)) {
      throw new JsonIntegrityError(`${path}: duplicate ${label} id "${item.id}"`);
    }
    seen.set(item.id, true);
  }
}

export function countPackageTestKeys(text) {
  return [...text.matchAll(/^\s*"test"\s*:/gm)].length;
}

export function checkJsonIntegrity(root = ROOT) {
  const findings = [];
  const targets = collectIntegrityTargets(root);
  let packageJson;
  let manifest;
  const chunkIds = new Map();
  for (const abs of targets) {
    if (!existsSync(abs)) {
      findings.push(`missing integrity target: ${abs.slice(root.length + 1)}`);
      continue;
    }
    const rel = abs.slice(root.length + 1).replaceAll('\\', '/');
    const text = readFileSync(abs, 'utf8');
    let parsed;
    try {
      parsed = parseJsonStrict(text, rel);
    } catch (error) {
      findings.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    if (rel === 'package.json') {
      packageJson = parsed;
      const testKeyCount = countPackageTestKeys(text);
      if (testKeyCount !== 1) {
        findings.push(`package.json must contain exactly one "test" script (found ${testKeyCount})`);
      }
    }
    if (rel === 'docs/architecture/manifest.json') {
      manifest = parsed;
      try {
        uniqueIds(parsed.packages, rel, 'package');
        uniqueIds(parsed.components, rel, 'component');
        uniqueIds(parsed.capabilities, rel, 'capability');
        uniqueIds(parsed.boundedContexts, rel, 'bounded context');
      } catch (error) {
        findings.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (rel.startsWith('docs/architecture/chunks/') && parsed && typeof parsed === 'object' && typeof parsed.chunk === 'string') {
      if (chunkIds.has(parsed.chunk)) {
        findings.push(`${rel}: duplicate chunk id "${parsed.chunk}" (also ${chunkIds.get(parsed.chunk)})`);
      } else {
        chunkIds.set(parsed.chunk, rel);
      }
    }
  }
  return { findings, packageJson, manifest };
}

function main() {
  const { findings } = checkJsonIntegrity(ROOT);
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(finding);
    }
    process.exit(1);
  }
  console.log('json integrity: ok');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
