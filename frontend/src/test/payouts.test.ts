import { BN } from "@coral-xyz/anchor";
import { describe, expect, it } from "vitest";
import { calculateEntrepreneurProfit, calculateInvestorPayout } from "@/lib/payouts";

describe("contract payout calculations", () => {
  it.each([
    ["loss is allocated pro-rata", "100", "1000", "800", 8000, "80"],
    ["profit is shared after the contribution is returned", "100", "1000", "1200", 8000, "116"],
    ["break-even returns only contributed capital", "100", "1000", "1000", 8000, "100"],
    ["a zero investor share returns only contributed capital", "100", "1000", "1200", 0, "100"],
    ["rounding is floored like the Rust implementation", "1", "3", "1", 10000, "0"],
  ])("%s", (_description, contribution, total, returned, shareBps, expected) => {
    expect(
      calculateInvestorPayout(
        new BN(contribution),
        new BN(total),
        new BN(returned),
        shareBps,
      ).toString(),
    ).toBe(expected);
  });

  it("calculates entrepreneur profit with the contract's basis-point floor", () => {
    expect(calculateEntrepreneurProfit(new BN(1000), new BN(1200), 2000).toString()).toBe("40");
    expect(calculateEntrepreneurProfit(new BN(1200), new BN(1000), 2000).toString()).toBe("0");
  });

  it("rejects payouts with an invalid denominator or share", () => {
    expect(() => calculateInvestorPayout(new BN(1), new BN(0), new BN(1), 5000)).toThrow();
    expect(() => calculateInvestorPayout(new BN(1), new BN(2), new BN(3), 10001)).toThrow();
  });
});
