#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(ROOT, 'config/providers/free-api-catalog.yaml');

let text = readFileSync(path, 'utf8');

// Remove standard git conflict markers, keeping origin/main (theirs).
while (text.includes('<<<<<<<')) {
  const start = text.indexOf('<<<<<<<');
  const mid = text.indexOf('=======', start);
  const end = text.indexOf('>>>>>>>', mid);
  if (mid < 0 || end < 0) throw new Error('Malformed conflict marker block');
  const theirs = text.slice(mid + '======='.length, end).replace(/^\n/, '');
  const after = text.slice(end);
  const afterNl = after.indexOf('\n');
  text = text.slice(0, start) + theirs + (afterNl >= 0 ? after.slice(afterNl) : '');
}

// Remove corrupted duplicate open-food-facts block inserted before the real one.
const marker = '  - provider_id: open-food-facts\n    name: Open Food Facts\n    short_name: OFF\n';
const first = text.indexOf(marker);
const second = text.indexOf(marker, first + 1);
if (first >= 0 && second > first) {
  text = text.slice(0, first) + text.slice(second);
}

writeFileSync(path, text, 'utf8');
console.log('Resolved catalog conflict artifacts');
