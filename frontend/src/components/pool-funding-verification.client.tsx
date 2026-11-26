import { useCallback, useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { CheckCircle2, CircleAlert, ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import { useProgram } from "@/lib/use-mooncredit";
import { fetchFundingVerification, type FundingVerification } from "@/lib/pool-verification";
import { moonCreditUsdcMint } from "@/lib/mooncredit-program";
import { Button } from "@/components/ui/button";

const explorer = (key: PublicKey) => `https://explorer.solana.com/address/${key.toBase58()}?cluster=devnet`;
function short(key: PublicKey) { const value = key.toBase58(); return `${value.slice(0, 5)}…${value.slice(-5)}`; }
function amount(value: { toString(): string }) {
  const raw = BigInt(value.toString());
  const whole = raw / 1_000_000n;
  const fraction = (raw % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
}
function rate(bps: number) { return `${(bps / 100).toFixed(2).replace(/\.?0+$/, "")}%`; }

export function PoolFundingVerificationCard({ poolAddress }: { poolAddress: string }) {
  const { connection } = useConnection();
  const program = useProgram();
  const [result, setResult] = useState<FundingVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const verify = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const address = new PublicKey(poolAddress);
      setResult(await fetchFundingVerification(connection, program, address));
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "Could not verify pool.");
    } finally { setLoading(false); }
  }, [connection, program, poolAddress]);
  useEffect(() => { void verify(); }, [verify]);
  const pool = result?.pool;
  const proposal = result?.proposal;
  const remaining = pool && pool.fundingGoal.gte(pool.totalContributed) ? pool.fundingGoal.sub(pool.totalContributed) : null;
  const checks = result?.checks;

  return <section className={`funding-verification ${result?.verified ? "is-verified" : error || result ? "is-warning" : "is-loading"}`} aria-label="On-chain funding verification">
    <header className="funding-verification-header">
      <div>{result?.verified ? <CheckCircle2 aria-hidden="true"/> : error || result ? <ShieldAlert aria-hidden="true"/> : <CircleAlert aria-hidden="true"/>}
        <div><h4>{result?.verified ? "On-chain terms verified" : error || result ? "Contribution verification failed" : "Verifying on-chain terms…"}</h4>
          <p>{result?.verified ? "Pool and approved proposal match at confirmed commitment." : error || result?.errors.join(" ") || "Fetching pool and proposal accounts directly from Solana Devnet."}</p>
        </div></div>
      <Button type="button" variant="quiet" size="icon" aria-label="Refresh verification" onClick={() => void verify()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""}/></Button>
    </header>
    <div className="funding-verification-grid">
      <div><span>Funding target · on-chain</span><strong>{pool ? `${amount(pool.fundingGoal)} USDC` : "Unavailable"}</strong></div>
      <div><span>Raised · on-chain</span><strong>{pool ? `${amount(pool.totalContributed)} USDC` : "Unavailable"}</strong></div>
      <div><span>Remaining · on-chain</span><strong>{remaining ? `${amount(remaining)} USDC` : pool ? "0 USDC" : "Unavailable"}</strong></div>
      <div><span>Entrepreneur share · on-chain</span><strong>{pool && proposal ? rate(pool.entrepreneurProfitBps) : "Unavailable"}</strong></div>
      <div><span>Investor share · distribution terms</span><strong>{pool && proposal ? rate(10_000 - pool.entrepreneurProfitBps) : "Unavailable"}</strong></div>
      <div><span>Mint · on-chain</span><strong>{pool ? (pool.mint.equals(moonCreditUsdcMint) ? "Configured USDC" : short(pool.mint)) : "Unavailable"}</strong></div>
    </div>
    <div className="funding-verification-links">
      <a href={explorer(new PublicKey(poolAddress))} target="_blank" rel="noreferrer">Pool {short(new PublicKey(poolAddress))} <ExternalLink aria-hidden="true"/></a>
      {result?.proposalAddress && <a href={explorer(result.proposalAddress)} target="_blank" rel="noreferrer">Proposal {short(result.proposalAddress)} <ExternalLink aria-hidden="true"/></a>}
    </div>
    <ul className="funding-check-list">
      {checks && Object.entries({
        "Pool account fetched from program": checks.poolFound,
        "Proposal account fetched from program": checks.proposalFound,
        "Proposal approved": checks.proposalApproved,
        "Entrepreneur addresses match": checks.entrepreneurMatches,
        "Funding targets match": checks.fundingGoalMatches,
        "Profit shares match": checks.profitShareMatches,
        "USDC mint matches configured mint": checks.usdcMintMatches,
        "Pool status is open": checks.poolOpen,
        "Funding target not reached": checks.fundingRemaining,
      }).map(([label, passed]) => <li className={passed ? "check-pass" : "check-fail"} key={label}>{passed ? <CheckCircle2/> : <ShieldAlert/>}{label}</li>)}
    </ul>
    <aside className="funding-offchain-note"><strong>Business information · off-chain</strong><p>Business profile and documents are entrepreneur-provided application data, not stored or verified by Solana. No linked profile or independent document verification is asserted here.</p><span>Document verification status: Not verified on-chain</span></aside>
  </section>;
}
