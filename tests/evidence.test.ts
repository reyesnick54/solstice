import { describe, expect, it } from "vitest";
import { GENESIS_PREV_SHA256 } from "../src/evidence/EvidenceVault.ts";
import { REAL_MONEY_ENABLED } from "../src/flags/capabilities.ts";
import { depositIntent, runtimeWithClearedAccount } from "./helpers.ts";

describe("evidence chain and capability flags", () => {
  it("seals a hash-chained record for a posted deposit and verifies the chain", () => {
    const { runtime, accountId } = runtimeWithClearedAccount();
    const result = runtime.kernel.submit(
      depositIntent(accountId, 10n, "dep-evidence"),
    );
    expect(result.outcome).toBe("POSTED");
    const chain = runtime.evidence.verifyChain();
    expect(chain.ok).toBe(true);
    expect(chain.length).toBeGreaterThanOrEqual(1);
    const first = runtime.evidence.list()[0]!;
    expect(first.prevRecordSha256).toBe(GENESIS_PREV_SHA256);
    expect(first.recordSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("REAL_MONEY_ENABLED remains false", () => {
    expect(REAL_MONEY_ENABLED).toBe(false);
    const { runtime } = runtimeWithClearedAccount();
    expect(runtime.capabilities.REAL_MONEY_ENABLED).toBe(false);
  });
});
