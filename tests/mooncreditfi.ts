
import { strict as assert } from "assert";
import * as anchor from "@coral-xyz/anchor";

describe("mooncreditfi", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  it("connects to the configured Anchor provider", async () => {
    assert.ok(provider.connection);
    assert.ok(provider.wallet.publicKey);

    console.log("Wallet:", provider.wallet.publicKey.toString());
    console.log("RPC:", provider.connection.rpcEndpoint);
  });
});
