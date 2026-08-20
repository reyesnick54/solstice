import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateDeclaredChunks } from "./constitution.ts";
import { evaluateCapability, loadManifest } from "./manifest.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function exists(rel: string): boolean {
  return existsSync(join(ROOT, rel));
}

describe("Chunk 157 constitution — production adversarial resilience campaign", () => {
  it("extends the existing range rather than creating a second campaign owner", () => {
    const chunk = JSON.parse(read("docs/architecture/chunks/chunk-157.json")) as {
      chunk: string;
      requires: readonly string[];
    };
    assert.equal(chunk.chunk, "CHUNK-157");
    assert.ok(chunk.requires.includes("sunrey-adversarial-range"));
    assert.ok(chunk.requires.includes("security"));
    assert.ok(chunk.requires.includes("kernel"));
    assert.ok(chunk.requires.includes("custody"));

    const manifest = loadManifest(ROOT);
    assert.equal(evaluateCapability(manifest, "sunrey-adversarial-range").status, "IMPLEMENTED");
    assert.equal(evaluateCapability(manifest, "sunrey-adversarial-range").owner, "packages/sunrey-range");

    const declared = evaluateDeclaredChunks(ROOT, manifest).find((evaluation) => evaluation.chunk === "CHUNK-157");
    assert.ok(declared, "CHUNK-157 declaration must exist under docs/architecture/chunks/");
    assert.equal(declared.mustStop, false);
    assert.deepEqual(declared.missing, []);

    assert.equal(exists("packages/red-team"), false);
    assert.equal(exists("packages/chaos-v2"), false);
    assert.equal(exists("packages/security-range-v2"), false);
    assert.equal(exists("packages/pentest"), false);
    assert.equal(exists("packages/adversarial-v2"), false);
  });

  it("keeps the campaign isolated from live targets and live flags", () => {
    const security = read("docs/security/chunk-157-production-adversarial-resilience.md");
    assert.match(security, /isolated defensive test range/i);
    assert.match(security, /NO LIVE PENETRATION TESTING/i);
    assert.match(security, /NO EXTERNAL TARGETS/i);
    const constitution = read("docs/architecture/constitution.md");
    assert.match(constitution, /Chunk 157/);
    assert.match(constitution, /sunrey-adversarial-range/);
    assert.doesNotMatch(security, /CONFIRMED_BY_COUNSEL/);
  });

  it("does not invent a second formal-proof owner", () => {
    const security = read("docs/security/chunk-157-production-adversarial-resilience.md");
    assert.match(security, /executable property tests, not formal verification/);
    assert.match(security, /not TLA\+/);
    assert.doesNotMatch(security, /Coq proof/);
  });
});
