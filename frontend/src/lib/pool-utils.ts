import { BN } from "@coral-xyz/anchor";

export function parseUsdcAmount(value: string): BN {
  const amount = parseUsdcAmountAllowZero(value);
  if (amount.lte(new BN(0))) throw new Error("USDC amount must be greater than zero.");
  return amount;
}

export function parseUsdcAmountAllowZero(value: string): BN {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,6}))?$/.exec(value.trim());
  if (!match) throw new Error("Enter a USDC amount with up to six decimal places.");
  const [whole, fraction = ""] = match.slice(1);
  return new BN(`${whole}${fraction.padEnd(6, "0")}`);
}

export function validateContributionAmount(
  amount: BN,
  remaining: BN,
  poolIsOpen: boolean,
): string | null {
  if (!poolIsOpen) return "This pool is not open for contributions.";
  if (amount.gt(remaining)) {
    return `Contribution exceeds the remaining target of ${formatUsdc(remaining)} USDC.`;
  }
  return null;
}

function formatUsdc(amount: BN): string {
  const whole = amount.div(new BN(1_000_000)).toString();
  const fractional = amount.mod(new BN(1_000_000)).toString().padStart(6, "0").replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole;
}
