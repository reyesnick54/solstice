#!/usr/bin/env node
// Local preview of dist/ that mimics Cloudflare Pages: applies the global
// block of _headers (CSP and security headers) and the SPA fallback.
// Development only.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'dist');
const port = Number(process.env.PORT || 8788);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json' };

function globalHeaders() {
  const text = readFileSync(join(root, '_headers'), 'utf8');
  const block = text.split(/\n(?=\/)/)[0];
  return Object.fromEntries(
    block
      .split('\n')
      .slice(1)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]),
  );
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://local');
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!file.startsWith(root)) return res.writeHead(400).end();
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  const headers = { ...globalHeaders(), 'content-type': TYPES[extname(file)] || 'application/octet-stream' };
  // Local http: drop directives that only make sense over https.
  headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace('; upgrade-insecure-requests', '');
  delete headers['Strict-Transport-Security'];
  res.writeHead(200, headers).end(readFileSync(file));
}).listen(port, '127.0.0.1', () => console.log(`dashboard preview on http://127.0.0.1:${port}`));
