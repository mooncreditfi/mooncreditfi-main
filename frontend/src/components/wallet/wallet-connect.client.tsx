import "./wallet-details-styles";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import { SiSolana } from "react-icons/si";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMoonCreditProfile } from "@/lib/account-profile";
import { SOLANA_NETWORK, MOONCREDIT_USDC_MINT } from "@/lib/platform-capabilities";
import { createSolanaSignInMessage } from "@/lib/solana-sign-in-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-provider";

type WalletConnectProps = {
  authenticated?: boolean;
  requireAuthentication?: boolean;
  showBalance?: boolean;
};

const walletLinks: Record<string, string> = {
  Phantom: "https://phantom.app/download",
  Solflare: "https://solflare.com/download",
};
const explorerAddress = (address: string) =>
  `https://explorer.solana.com/address/${address}?cluster=${SOLANA_NETWORK}`;
function shortAddress(address: string): string {
  return `${address.slice(0, 5)}…${address.slice(-5)}`;
}
function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/user rejected|declined|cancelled/i.test(message)) return "Request declined. You can try again when ready.";
  if (/unsupported provider|provider (?:is )?(?:disabled|not enabled)|web3.{0,40}(?:disabled|not enabled)/i.test(message))
    return "Supabase Web3 authentication is disabled. Enable the Solana Web3 Wallet provider in Supabase Dashboard under Authentication → Sign In / Providers.";
  if (/redirect|domain|uri/i.test(message)) return "Supabase rejected this sign-in domain. Add this app URL to the Supabase Authentication redirect URLs.";
  return message || "Wallet request failed. Please retry.";
}

export function WalletConnectButtonClient({
  authenticated = false,
  requireAuthentication = true,
  showBalance = false,
}: WalletConnectProps) {
  const navigate = useNavigate();
  const { connection } = useConnection();
  const walletState = useWallet();
  const { wallets, wallet, publicKey, connected, connecting, select, connect, disconnect } = walletState;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectingName, setConnectingName] = useState<string | null>(null);
  const [balanceLamports, setBalanceLamports] = useState<number | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [usdcAccountMissing, setUsdcAccountMissing] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const address = publicKey?.toBase58();
  const addressRef = useRef(address);

  useEffect(() => {
    if (!showBalance || !connected || !publicKey) {
      setBalanceLamports(null);
      setUsdcBalance(null);
      setUsdcAccountMissing(false);
      setBalanceError(null);
      return;
    }
    let active = true;
    const refreshBalances = async () => {
      try {
        const lamports = await connection.getBalance(publicKey, "confirmed");
        if (active) {
          setBalanceLamports(lamports);
          setBalanceError(null);
        }
      } catch (error) {
        if (active) setBalanceError(error instanceof Error ? error.message : "Solana RPC request failed.");
      }
      try {
        const ata = getAssociatedTokenAddressSync(MOONCREDIT_USDC_MINT, publicKey);
        const result = await connection.getTokenAccountBalance(ata, "confirmed");
        if (active) {
          setUsdcBalance(result.value.uiAmountString ?? result.value.amount);
          setUsdcAccountMissing(false);
        }
      } catch {
        if (active) {
          setUsdcBalance(null);
          setUsdcAccountMissing(true);
        }
      }
    };
    void refreshBalances();
    const subscriptionId = connection.onAccountChange(publicKey, (accountInfo) => {
      if (active) setBalanceLamports(accountInfo.lamports);
    }, "confirmed");
    window.addEventListener("focus", refreshBalances);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshBalances);
      void connection.removeAccountChangeListener(subscriptionId).catch((error) =>
        console.error("Could not unsubscribe from wallet balance updates.", error),
      );
    };
  }, [connected, connection, publicKey, showBalance]);

  useEffect(() => { addressRef.current = address; }, [address]);

  useEffect(() => {
    if (!connectingName || wallet?.adapter.name !== connectingName) return;
    void connect().then(() => {
      setConnectingName(null);
    }).catch((error) => {
      setConnectingName(null);
      toast.error(errorText(error));
    });
  }, [connect, connectingName, wallet]);

  async function authenticate() {
    if (!connected || !address) { toast.error("Connect a wallet before signing in."); return; }
    if (!walletState.signMessage) { toast.error("This wallet cannot sign a sign-in message. Select Phantom or Solflare."); return; }
    setBusy(true);
    try {
      const url = new URL(window.location.href);
      const message = createSolanaSignInMessage({
        domain: url.host,
        uri: url.origin,
        address,
        statement: "Sign in to MoonCreditFi. This signature does not authorize a blockchain transaction.",
        chainId: `solana:${SOLANA_NETWORK}`,
        nonce: crypto.randomUUID().replace(/-/g, ""),
        issuedAt: new Date().toISOString(),
      });
      const signature = await walletState.signMessage(new TextEncoder().encode(message));
      const { data, error } = await supabase.auth.signInWithWeb3({ chain: "solana", message, signature });
      if (error) throw error;
      if (!data.session || !data.user) throw new Error("Supabase Auth did not return a signed-in user session.");
      if (addressRef.current !== address) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw new Error(`Wallet changed during sign-in and the session could not be cleared: ${signOutError.message}`);
        throw new Error("The connected wallet changed during sign-in. Please try again.");
      }
      toast.success("Wallet authenticated.");
      if (requireAuthentication) {
        const profile = getMoonCreditProfile(data.user);
        if (!profile) void navigate({ to: "/onboarding" });
        else void navigate({ to: profile.roles.includes("entrepreneur") ? "/entrepreneur" : "/dashboard", search: { view: "overview" } });
      }
    } catch (error) {
      toast.error(errorText(error));
    } finally { setBusy(false); }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    else toast.success("Signed out.");
  }
  function chooseWallet(walletName: string) {
    const selectedWallet = wallets.find((item) => item.adapter.name === walletName);
    if (!selectedWallet) { toast.error("That wallet is not supported."); return; }
    setConnectingName(walletName);
    select(selectedWallet.adapter.name);
  }
  async function copyAddress() {
    if (!address) return;
    try { await navigator.clipboard.writeText(address); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { toast.error("Could not copy the wallet address."); }
  }

  return <>
    {connected && address ? (
      <Button type="button" variant="wallet" className="wallet-mobile-trigger" onClick={() => setOpen(true)} aria-label="Open wallet details">
        <WalletIcon aria-hidden="true" />
        <span className="wallet-trigger-label">{authenticated ? shortAddress(address) : "Wallet"}</span>
        {authenticated && <span className="wallet-auth-dot" aria-label="Authenticated" />}
      </Button>
    ) : (
      <Button type="button" variant="gold" className="wallet-mobile-trigger" onClick={() => setOpen(true)} disabled={connecting} aria-label="Connect wallet">
        {connecting ? <Loader2 className="animate-spin"/> : <WalletIcon/>}
        <span className="wallet-trigger-label">{connecting ? "Connecting…" : "Connect wallet"}</span>
      </Button>
    )}

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="wallet-dialog wallet-details-dialog">
        <DialogHeader className="wallet-details-header">
          <DialogTitle className="wallet-details-title">{connected ? "Wallet details" : "Connect a wallet"}</DialogTitle>
          <DialogDescription className="wallet-details-description">
            {connected ? "Wallet information and live balances from Solana Devnet." : "Connect Phantom or Solflare. Signing in is separate from connecting and never submits a transaction."}
          </DialogDescription>
        </DialogHeader>
        <div className="wallet-network"><span className="network-badge"><span/><SiSolana className="network-badge-icon" aria-hidden="true"/>Solana {SOLANA_NETWORK}</span></div>
        {connected && address ? <>
          <section className="wallet-detail-card" aria-label="Connected wallet information">
            <div className="wallet-detail-heading"><img src={wallet?.adapter.icon} alt="" width="36" height="36"/><div><strong>{wallet?.adapter.name ?? "Solana wallet"}</strong><span>{authenticated ? "Authenticated session" : "Connected · not signed in"}</span></div></div>
            <p className="wallet-detail-label">Public wallet address</p>
            <div className="wallet-address-row"><code>{address}</code><Button type="button" variant="ghost" size="icon" aria-label="Copy full wallet address" onClick={() => void copyAddress()}>{copied ? <Check/> : <Copy/>}</Button><a href={explorerAddress(address)} target="_blank" rel="noreferrer" aria-label="View wallet on Solana Explorer"><ExternalLink/></a></div>
          </section>
          <section className="wallet-balances" aria-label="Wallet balances">
            <article><span><SiSolana aria-hidden="true"/> SOL</span><strong>{balanceLamports === null ? (balanceError ? "Unavailable" : "Loading…") : `${(balanceLamports / LAMPORTS_PER_SOL).toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`}</strong><small>Native SOL · confirmed balance</small></article>
            <article><span>USDC</span><strong>{usdcBalance !== null ? `${Number(usdcBalance).toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC` : usdcAccountMissing ? "No token account" : "Loading…"}</strong><small>{usdcAccountMissing ? "Create a USDC token account by receiving Devnet USDC." : `MoonCreditFi Devnet mint · 6 decimals`}</small></article>
          </section>
          {balanceError && <p className="wallet-balance-error" role="status">SOL balance unavailable: {balanceError}</p>}
          <div className="wallet-detail-actions">
            {!authenticated && <Button type="button" variant="gold" disabled={busy} onClick={() => void authenticate()}>{busy ? <Loader2 className="animate-spin"/> : <WalletIcon/>}{busy ? "Authenticating…" : "Sign in with wallet"}</Button>}
            {authenticated && <Button type="button" variant="gold" onClick={() => void signOut()}><LogOut/>Sign out</Button>}
            <Button type="button" variant="quiet" onClick={() => void disconnect()}><X/>Disconnect wallet</Button>
          </div>
        </> : <div className="wallet-options">
          {wallets.map(({ adapter, readyState }) => {
            const installed = readyState === WalletReadyState.Installed;
            const selected = wallet?.adapter.name === adapter.name;
            return <div className="wallet-option" key={adapter.name}>
              <button type="button" className="wallet-option-select" onClick={() => chooseWallet(adapter.name)} disabled={connecting || busy || connectingName !== null}>
                <img src={adapter.icon} alt="" width="34" height="34"/><span><strong>{adapter.name}</strong><small>{selected && connected ? "Connected" : installed ? "Ready to connect" : "Not detected"}</small></span>{(connecting || connectingName === adapter.name) && selected && <Loader2 className="animate-spin"/>}
              </button>
              {!installed && walletLinks[adapter.name] && <a href={walletLinks[adapter.name]} target="_blank" rel="noreferrer">Install {adapter.name}<ExternalLink size={14}/></a>}
            </div>;
          })}
        </div>}
        <p className="wallet-notice">Never share a recovery phrase or private key. Signing in verifies wallet control; it does not authorize a blockchain transaction.</p>
      </DialogContent>
    </Dialog>
  </>;
}
