
describe("MoonCreditFi", () => {
  it("initializes the platform", async () => {
    const program = pg.program;

    // Derive the platform config PDA
    const [configPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    // Devnet USDC mint
    const usdcMint = new web3.PublicKey(
      "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
    );

    // Initialize the platform
    const tx = await program.methods
      .initializePlatform()
      .accounts({
        config: configPda,
        usdcMint: usdcMint,
        authority: pg.wallet.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Initialization transaction:", tx);

    // Fetch initialized platform configuration
    const config = await program.account.platformConfig.fetch(
      configPda
    );

    console.log("Authority:", config.authority.toString());
    console.log("USDC Mint:", config.usdcMint.toString());

    assert.equal(
      config.authority.toString(),
      pg.wallet.publicKey.toString()
    );

    assert.equal(
      config.usdcMint.toString(),
      usdcMint.toString()
    );
  });
});
