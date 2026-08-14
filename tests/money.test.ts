import { describe, expect, it } from "vitest";
import { Money, RoundingMode, roundQuotient } from "../src/money/Money.ts";

describe("Money primitive", () => {
  it("stores integer minor units as bigint", () => {
    const money = Money.fromMinorUnits(250n, "USD");
    expect(typeof money.minorUnits).toBe("bigint");
    expect(money.minorUnits).toBe(250n);
    expect(money.currency).toBe("USD");
  });

  it("rejects a number at fromMinorUnits", () => {
    expect(() =>
      Money.fromMinorUnits(100 as unknown as bigint, "USD"),
    ).toThrow(/bigint/);
  });

  it("rejects a decimal string", () => {
    expect(() => Money.fromMinorUnitsString("100.00", "USD")).toThrow(
      /integer/,
    );
  });

  it("adds and subtracts same-currency amounts without float", () => {
    const a = Money.fromMinorUnits(100n, "USD");
    const b = Money.fromMinorUnits(40n, "USD");
    expect(a.plus(b).minorUnits).toBe(140n);
    expect(a.minus(b).minorUnits).toBe(60n);
  });

  it("refuses cross-currency arithmetic", () => {
    const usd = Money.fromMinorUnits(1n, "USD");
    const eur = Money.fromMinorUnits(1n, "EUR");
    expect(() => usd.plus(eur)).toThrow(/Currency mismatch/);
  });

  it("applies HALF_EVEN on an exact half without float", () => {
    // 5 / 2 = 2.5 → even neighbor is 2
    expect(roundQuotient(5n, 2n, RoundingMode.HALF_EVEN)).toBe(2n);
    // 7 / 2 = 3.5 → even neighbor is 4
    expect(roundQuotient(7n, 2n, RoundingMode.HALF_EVEN)).toBe(4n);
  });

  it("allocate uses only bigint factors", () => {
    const principal = Money.fromMinorUnits(100n, "USD");
    const share = principal.allocate(1n, 3n, RoundingMode.FLOOR);
    expect(share.minorUnits).toBe(33n);
    expect(() =>
      principal.allocate(1 as unknown as bigint, 3n, RoundingMode.FLOOR),
    ).toThrow(/bigint/);
  });
});
