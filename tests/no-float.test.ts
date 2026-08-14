import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Money } from "../src/money/Money.ts";
import { depositIntent, runtimeWithClearedAccount } from "./helpers.ts";

const AMOUNT_PATH_ROOTS = [
  "src/money",
  "src/ledger",
  "src/deposit",
  "src/kernel",
  "src/authority",
  "src/growth",
];

const BANNED = [
  { name: "decimal literal", pattern: /(?<![\w.])\d+\.\d+/ },
  { name: "parseFloat", pattern: /parseFloat\s*\(/ },
  { name: "Number.parseFloat", pattern: /Number\.parseFloat\s*\(/ },
  { name: "toFixed", pattern: /\.toFixed\s*\(/ },
];

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("no float in the amount path", () => {
  it("amount-path sources contain no floating-point literals or parsers", () => {
    const files = AMOUNT_PATH_ROOTS.flatMap((root) => walkTsFiles(root));
    expect(files.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const code = source
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("*") && !line.trimStart().startsWith("//"))
        .join("\n");
      for (const ban of BANNED) {
        if (ban.pattern.test(code)) {
          violations.push(`${file}: ${ban.name}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("posted deposit amounts remain bigint end-to-end", () => {
    const { runtime, accountId } = runtimeWithClearedAccount();
    const result = runtime.kernel.submit(
      depositIntent(accountId, 1234n, "dep-bigint-only"),
    );
    expect(result.outcome).toBe("POSTED");
    if (result.outcome !== "POSTED") return;
    for (const posting of result.journal.postings) {
      expect(posting.amount).toBeInstanceOf(Money);
      expect(typeof posting.amount.minorUnits).toBe("bigint");
    }
    expect(typeof result.event.amountMinorUnits).toBe("string");
    expect(result.event.amountMinorUnits).toBe("1234");
    expect(result.event.amountMinorUnits.includes(".")).toBe(false);
  });

  it("Money construction from a float-like string is rejected", () => {
    expect(() => Money.fromMinorUnitsString("10.5", "USD")).toThrow();
    expect(() => Money.fromMinorUnitsString("1e2", "USD")).toThrow();
  });
});
