import { describe, expect, it } from "vitest";
import {
  parseUsdcAmount,
  parseUsdcAmountAllowZero,
  validateContributionAmount,
} from "@/lib/pool-utils";

describe("USDC pool amount validation", () => {
  it("converts six-decimal USDC exactly to base units", () => {
    expect(parseUsdcAmount("12.340005").toString()).toBe("12340005");
  });

  it("allows a zero return amount for a settlement", () => {
    expect(parseUsdcAmountAllowZero("0.000000").toString()).toBe("0");
    expect(() => parseUsdcAmount("0")).toThrow("greater than zero");
  });

  it.each(["0", "1.0000001", "-1", "1e2", ".5"])("rejects invalid USDC amount %s", (value) => {
    expect(() => parseUsdcAmount(value)).toThrow();
  });

  it("rejects contributions beyond the pool's remaining funding target", () => {
    expect(
      validateContributionAmount(parseUsdcAmount("10.01"), parseUsdcAmount("10"), true),
    ).toContain("remaining target of 10 USDC");
  });

  it("blocks contributions after a pool closes", () => {
    expect(validateContributionAmount(parseUsdcAmount("1"), parseUsdcAmount("10"), false)).toBe(
      "This pool is not open for contributions.",
    );
  });
});
