import { BN, Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  type AccountMeta,
} from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { checkProposalInstructionCompatibility, moonCreditIdl } from "@/lib/mooncredit-program";

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
    expect(typeof Reflect.get(program.methods, "rejectSettlement")).toBe("function");
    expect(typeof Reflect.get(program.methods, "cancelExpiredPool")).toBe("function");
    expect(typeof Reflect.get(program.methods, "depositRecovery")).toBe("function");
    expect(typeof Reflect.get(program.methods, "finalizeDefault")).toBe("function");
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
      new BN(90 * 24 * 60 * 60),
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
    expect(instruction.data).toHaveLength(58);
    expect(Buffer.from(instruction.data.subarray(50))).toEqual(
      new BN(90 * 24 * 60 * 60).toArrayLike(Buffer, "le", 8),
    );
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
    expect(instruction.keys[0]?.isWritable).toBe(true);
    expect(instruction.keys[1]?.isSigner).toBe(true);
  });

  it("detects a deployed proposal IDL with outdated decision instructions", () => {
    expect(checkProposalInstructionCompatibility(moonCreditIdl.instructions)).toEqual({
      ready: true,
    });

    const compatibility = checkProposalInstructionCompatibility([
      {
        name: "approveProposal",
        accounts: [{ name: "config" }, { name: "proposal" }, { name: "authority" }],
      },
    ]);

    expect(compatibility.ready).toBe(false);
    if (!compatibility.ready) {
      expect(compatibility.reason).toContain("approveProposal has an outdated account layout");
      expect(compatibility.reason).toContain("rejectProposal is missing");
    }
  });

  it("builds approval and rejection with the authority in the signer slot", async () => {
    const program = new Program(moonCreditIdl, {
      connection: new Connection("https://api.devnet.solana.com"),
    });
    const accounts = {
      config: Keypair.generate().publicKey,
      proposal: Keypair.generate().publicKey,
      rejection: Keypair.generate().publicKey,
      authority: Keypair.generate().publicKey,
      systemProgram: SystemProgram.programId,
    };

    async function buildInstruction(name: string) {
      const method = Reflect.get(program.methods, name) as (...args: unknown[]) => unknown;
      const builder = Reflect.apply(method, program.methods, []) as object;
      const accountsMethod = Reflect.get(builder, "accounts") as (...args: unknown[]) => unknown;
      const withAccounts = Reflect.apply(accountsMethod, builder, [accounts]) as object;
      return Reflect.apply(
        Reflect.get(withAccounts, "instruction"),
        withAccounts,
        [],
      ) as Promise<TransactionInstruction>;
    }

    const approval = await buildInstruction("approveProposal");
    expect(approval.keys.map((key: AccountMeta) => key.pubkey)).toEqual([
      accounts.config,
      accounts.proposal,
      accounts.rejection,
      accounts.authority,
    ]);
    expect(approval.keys[3]?.isSigner).toBe(true);

    const rejection = await buildInstruction("rejectProposal");
    expect(rejection.keys.map((key: AccountMeta) => key.pubkey)).toEqual([
      accounts.config,
      accounts.proposal,
      accounts.rejection,
      accounts.authority,
      accounts.systemProgram,
    ]);
    expect(rejection.keys[3]?.isSigner).toBe(true);
    expect(rejection.keys[3]?.isWritable).toBe(true);
  });
});
