import { fireEvent, render, screen } from "@testing-library/react";
import { WalletConnectButtonClient } from "@/components/wallet/wallet-connect.client";
import { describe, expect, it, vi } from "vitest";

const walletMocks = vi.hoisted(() => ({
  address: "Ge2UZkH7nEixWuM8YU7WSa4SjHYuKyEjrk5yRYfwVCAb",
  select: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@solana/wallet-adapter-react", async () => {
  const { PublicKey } = await import("@solana/web3.js");
  return {
    useConnection: () => ({ connection: {} }),
    useWallet: () => ({
      wallets: [],
      wallet: null,
      publicKey: new PublicKey(walletMocks.address),
      connected: true,
      connecting: false,
      select: walletMocks.select,
      connect: walletMocks.connect,
      disconnect: walletMocks.disconnect,
      signMessage: vi.fn(),
    }),
  };
});

describe("WalletConnectButtonClient", () => {
  it("opens wallet details with the full address after a connected wallet is tapped", () => {
    render(<WalletConnectButtonClient />);

    fireEvent.click(screen.getByRole("button", { name: "Open wallet details" }));

    expect(screen.getByText(walletMocks.address)).toBeInTheDocument();
  });
});
