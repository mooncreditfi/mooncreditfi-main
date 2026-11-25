import { BN, Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { moonCreditIdl } from "@/lib/mooncredit-program";

describe("MoonCreditFi Anchor client", () => {
  it("constructs account decoders and pool instructions from the bundled IDL", () => {
    const program = new Program(moonCreditIdl, {
      connection: new Connection("https://api.devnet.solana.com"),
    });

    expect(typeof Reflect.get(program.methods, "createProposal")).toBe("function");
    expect(typeof Reflect.get(program.methods, "rejectProposal")).toBe("function");
    expect(typeof Reflect.get(program.methods, "createPool")).toBe("function");
    expect(typeof Reflect.get(program.methods, "contribute")).toBe("function");
    expect(typeof Reflect.get(program.methods, "transferPlatformAuthority")).toBe("function");
    expect(Reflect.get(program.account, "mudarabahPool")).toBeDefined();
    expect(Reflect.get(program.account, "proposalRejection")).toBeDefined();
    expect(
      moonCreditIdl.instructions
        .find((instruction) => instruction.name === "createPool")
        ?.accounts.map((account) => account.name),
    ).toContain("rejection");
    const platformConfig = moonCreditIdl.accounts.find(
      (account) => account.name === "platformConfig",
    );
    expect(platformConfig?.discriminator).toEqual([160, 78, 128, 0, 248, 83, 230, 160]);
    expect(program.programId.toBase58()).toBe(moonCreditIdl.address);
  });

  it("encodes proposal arguments and requires the expected signer accounts", async () => {
    const program = new Program(moonCreditIdl, {
      connection: new Connection("https://api.devnet.solana.com"),
    });
    const method = Reflect.get(program.methods, "createProposal");
    const builder = Reflect.apply(method, program.methods, [
      Array.from({ length: 32 }, () => 1),
      new BN(1_000_000),
      2_000,
    ]);
    const accounts = Reflect.get(builder, "accounts");
    const configured = Reflect.apply(accounts, builder, [
      {
        entrepreneurProfile: PublicKey.default,
        proposal: PublicKey.default,
        entrepreneur: PublicKey.default,
        systemProgram: SystemProgram.programId,
      },
    ]);
    const instructionBuilder = Reflect.get(configured, "instruction");
    const instruction: unknown = await Reflect.apply(instructionBuilder, configured, []);

    expect(instruction).toBeInstanceOf(TransactionInstruction);
    if (!(instruction instanceof TransactionInstruction)) return;
    expect(instruction.programId.toBase58()).toBe(moonCreditIdl.address);
    expect(instruction.keys.some((key) => key.isSigner)).toBe(true);
    expect(instruction.data.length).toBeGreaterThan(8);
  });

  it("encodes authority transfers with the current authority as signer", async () => {
    const program = new Program(moonCreditIdl, {
      connection: new Connection("https://api.devnet.solana.com"),
    });
    const target = Keypair.generate().publicKey;
    const method = Reflect.get(program.methods, "transferPlatformAuthority");
    const builder = Reflect.apply(method, program.methods, [target]);
    const accounts = Reflect.get(builder, "accounts");
    const configured = Reflect.apply(accounts, builder, [
      {
        config: PublicKey.default,
        authority: PublicKey.default,
      },
    ]);
    const instructionBuilder = Reflect.get(configured, "instruction");
    const instruction: unknown = await Reflect.apply(instructionBuilder, configured, []);

    expect(instruction).toBeInstanceOf(TransactionInstruction);
    if (!(instruction instanceof TransactionInstruction)) return;
    expect(instruction.data.length).toBe(40);
    expect(Buffer.from(instruction.data.subarray(8))).toEqual(target.toBuffer());
    expect(instruction.keys[0].isWritable).toBe(true);
    expect(instruction.keys[1].isSigner).toBe(true);
  });
});
