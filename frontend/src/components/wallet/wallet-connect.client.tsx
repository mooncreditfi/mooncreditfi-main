import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { Check, Copy, ExternalLink, Loader2, LogOut, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMoonCreditProfile } from "@/lib/account-profile";
import { SOLANA_NETWORK } from "@/lib/platform-capabilities";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type WalletConnectProps = {
  onAuthenticated?: () => void;
};

const walletLinks: Record<string, string> = {
  Phantom: "https://phantom.app/download",
  Solflare: "https://solflare.com/download",
};

function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/user rejected|declined|cancelled/i.test(message)) {
    return "Request declined. You can try again when ready.";
  }
  if (
    /unsupported provider|provider (?:is )?(?:disabled|not enabled)|web3.{0,40}(?:disabled|not enabled)/i.test(
      message,
    )
  ) {
    return "Supabase Web3 authentication is disabled. Enable the Solana Web3 Wallet provider in Supabase Dashboard under Authentication → Sign In / Providers.";
  }
  if (/redirect|domain|uri/i.test(message)) {
    return "Supabase rejected this sign-in domain. Add this app URL to the Supabase Authentication redirect URLs.";
  }
  return message || "Wallet request failed. Please retry.";
}

export function WalletConnectButtonClient({ onAuthenticated }: WalletConnectProps) {
  const navigate = useNavigate();
  const walletState = useWallet();
  const { wallets, wallet, publicKey, connected, connecting, select, connect, disconnect } =
    walletState;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectingName, setConnectingName] = useState<string | null>(null);
  const address = publicKey?.toBase58();
  const addressRef = useRef(address);

  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  useEffect(() => {
    if (!connectingName || wallet?.adapter.name !== connectingName) return;
    void connect()
      .then(() => {
        setConnectingName(null);
        setOpen(false);
      })
      .catch((error) => {
        setConnectingName(null);
        toast.error(errorText(error));
      });
  }, [connect, connectingName, wallet]);

  async function authenticate() {
    if (!connected || !address) {
      toast.error("Connect a wallet before signing in.");
      return;
    }
    if (!walletState.signMessage) {
      toast.error("This wallet cannot sign a sign-in message. Select Phantom or Solflare.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithWeb3({
        chain: "solana",
        statement:
          "Sign in to MoonCreditFi. This signature does not authorize a blockchain transaction.",
        wallet: {
          publicKey: walletState.publicKey,
          signMessage: walletState.signMessage,
        },
        options: {
          signInWithSolana: {
            chainId: `solana:${SOLANA_NETWORK}`,
            nonce: crypto.randomUUID().replace(/-/g, ""),
          },
        },
      });
      if (error) throw error;
      if (!data.session || !data.user) {
        throw new Error("Supabase Auth did not return a signed-in user session.");
      }
      if (addressRef.current !== address) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError)
          throw new Error(
            `The wallet changed during sign-in and the session could not be cleared: ${signOutError.message}`,
          );
        throw new Error("The connected wallet changed during sign-in. Please try again.");
      }

      setOpen(false);
      toast.success("Wallet authenticated.");
      if (onAuthenticated) {
        onAuthenticated();
      } else {
        const profile = getMoonCreditProfile(data.user);
        if (!profile) {
          void navigate({ to: "/onboarding" });
        } else {
          void navigate({
            to: profile.roles.includes("entrepreneur") ? "/entrepreneur" : "/dashboard",
            search: { view: "overview" },
          });
        }
      }
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  function chooseWallet(walletName: string) {
    const selectedWallet = wallets.find((item) => item.adapter.name === walletName);
    if (!selectedWallet) {
      toast.error("That wallet is not supported.");
      return;
    }
    setConnectingName(walletName);
    select(selectedWallet.adapter.name);
  }

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the wallet address.");
    }
  }

  return (
    <>
      {connected && address ? (
        <div className="wallet-connected">
          <span className="network-badge">
            <span />
            Solana {SOLANA_NETWORK}
          </span>
          <code>{shortAddress(address)}</code>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Copy full wallet address"
            onClick={() => void copyAddress()}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
          <Button type="button" variant="gold" disabled={busy} onClick={() => void authenticate()}>
            {busy ? <Loader2 className="animate-spin" /> : <WalletIcon />}
            {busy ? "Authenticating…" : "Sign in"}
          </Button>
          <Button
            type="button"
            variant="quiet"
            onClick={() => void disconnect()}
            aria-label="Disconnect wallet"
          >
            <LogOut />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="gold" onClick={() => setOpen(true)} disabled={connecting}>
          {connecting ? <Loader2 className="animate-spin" /> : <WalletIcon />}
          {connecting ? "Connecting…" : "Connect wallet"}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="wallet-dialog">
          <DialogHeader>
            <DialogTitle>Connect a wallet</DialogTitle>
            <DialogDescription>
              Connect, then sign in with a message verified by Supabase. No transaction is
              requested.
            </DialogDescription>
          </DialogHeader>
          <div className="wallet-network">
            <span className="network-badge">
              <span />
              Solana {SOLANA_NETWORK}
            </span>
          </div>
          <div className="wallet-options">
            {wallets.map(({ adapter, readyState }) => {
              const installed = readyState === WalletReadyState.Installed;
              const selected = wallet?.adapter.name === adapter.name;
              return (
                <div className="wallet-option" key={adapter.name}>
                  <button
                    type="button"
                    className="wallet-option-select"
                    onClick={() => chooseWallet(adapter.name)}
                    disabled={connecting || busy || connectingName !== null}
                  >
                    <img src={adapter.icon} alt="" width="34" height="34" />
                    <span>
                      <strong>{adapter.name}</strong>
                      <small>
                        {selected && connected
                          ? "Connected"
                          : installed
                            ? "Ready to connect"
                            : "Not detected"}
                      </small>
                    </span>
                    {(connecting || connectingName === adapter.name) && selected && (
                      <Loader2 className="animate-spin" />
                    )}
                  </button>
                  {!installed && walletLinks[adapter.name] && (
                    <a href={walletLinks[adapter.name]} target="_blank" rel="noreferrer">
                      Install {adapter.name}
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
          <p className="wallet-notice">
            Never share a recovery phrase or private key. Signing in does not authorize a financial
            transaction.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
