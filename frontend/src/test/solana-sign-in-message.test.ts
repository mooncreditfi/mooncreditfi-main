import { describe, expect, it } from "vitest";
import { createSolanaSignInMessage } from "@/lib/solana-sign-in-message";

describe("Solana sign-in message", () => {
  it("formats SIWS fields in the order wallets expect", () => {
    const message = createSolanaSignInMessage({
      domain: "mooncredit.example",
      uri: "https://mooncredit.example",
      address: "11111111111111111111111111111111",
      statement: "Sign in without authorizing a transaction.",
      chainId: "solana:devnet",
      nonce: "0123456789abcdef0123456789abcdef",
      issuedAt: "2026-11-24T14:00:00.000Z",
    });

    expect(message).toBe(
      [
        "mooncredit.example wants you to sign in with your Solana account:",
        "11111111111111111111111111111111",
        "",
        "Sign in without authorizing a transaction.",
        "",
        "URI: https://mooncredit.example",
        "Version: 1",
        "Chain ID: solana:devnet",
        "Nonce: 0123456789abcdef0123456789abcdef",
        "Issued At: 2026-11-24T14:00:00.000Z",
      ].join("\n"),
    );
  });
});
