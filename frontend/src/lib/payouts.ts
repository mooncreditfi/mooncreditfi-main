import { BN } from "@coral-xyz/anchor";

const BASIS_POINTS_DENOMINATOR = new BN(10_000);
const ZERO = new BN(0);

function mulDivFloor(amount: BN, basisPoints: BN, denominator: BN): BN {
  if (denominator.lte(ZERO)) throw new Error("Payout denominator must be greater than zero.");
  return amount.mul(basisPoints).div(denominator);
}

export function calculateInvestorPayout(
  contribution: BN,
  totalContributed: BN,
  totalReturned: BN,
  investorProfitShareBps: number,
): BN {
  if (totalContributed.lte(ZERO)) {
    throw new Error("Total contributions must be greater than zero.");
  }
  if (
    !Number.isInteger(investorProfitShareBps) ||
    investorProfitShareBps < 0 ||
    investorProfitShareBps > 10_000
  ) {
    throw new Error("Investor profit share must be between 0 and 10,000 basis points.");
  }

  if (totalReturned.lt(totalContributed)) {
    return mulDivFloor(totalReturned, contribution, totalContributed);
  }

  const profit = totalReturned.sub(totalContributed);
  const investorProfit = mulDivFloor(
    profit,
    new BN(investorProfitShareBps),
    BASIS_POINTS_DENOMINATOR,
  );
  const investorProfitShare = mulDivFloor(investorProfit, contribution, totalContributed);
  return contribution.add(investorProfitShare);
}

export function calculateEntrepreneurProfit(
  totalContributed: BN,
  totalReturned: BN,
  entrepreneurProfitBps: number,
): BN {
  if (
    !Number.isInteger(entrepreneurProfitBps) ||
    entrepreneurProfitBps < 0 ||
    entrepreneurProfitBps > 10_000
  ) {
    throw new Error("Entrepreneur profit share must be between 0 and 10,000 basis points.");
  }
  const profit = totalReturned.gt(totalContributed) ? totalReturned.sub(totalContributed) : ZERO;
  return mulDivFloor(profit, new BN(entrepreneurProfitBps), BASIS_POINTS_DENOMINATOR);
}
