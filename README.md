# MoonCreditFi — Solana Anchor contracts

Initial development scaffold for MoonCreditFi's Mudarabah funding workflow.

## Stack
- Solana / Anchor 0.30.1
- Rust
- SPL Token (classic Token Program)
- Six-decimal configured stablecoin mint
- Devnet provider configuration

## Important safety boundary

This is a **development scaffold, not an audited or production-ready financial protocol**.
Do not use real funds. It has not been compiled or tested in your local environment.

The first implementation supports:
- platform initialization with one configured six-decimal mint
- entrepreneur profile registration
- proposal creation and reviewer approval
- one pool per proposal, with multiple investor positions
- PDA-controlled pool vault
- contributions, funding activation and capital disbursement
- entrepreneur-reported settlement deposit and reviewer approval
- pro-rata investor claims and entrepreneur profit claim
- cancellation and investor refunds before capital disbursement

The contract does not verify business documents, identity, actual profit, fraud, or Sharia compliance.
Settlement approval is a governance/reviewer action and must be backed by an off-chain evidence and dispute process.

## 1. Prerequisites

Use Ubuntu in WSL2 on Windows. Install compatible versions of:
- Rust and Cargo
- Solana CLI
- Anchor CLI 0.30.1 (use AVM if available)
- Node.js and Yarn

Check:
```bash
rustc --version
cargo --version
solana --version
anchor --version
node --version
yarn --version
```

## 2. Install JavaScript dependencies

From this directory:
```bash
yarn install
```

## 3. Build and synchronize the program ID

```bash
anchor build
anchor keys sync
anchor build
```

After `anchor keys sync`, check that the program ID in `declare_id!` and `Anchor.toml` match:
```bash
anchor keys list
```

Keep `target/deploy/mooncreditfi-keypair.json` private. Do not commit it or share it.

## 4. Configure Devnet

```bash
solana config set --url devnet
solana address
solana balance
```

Fund your development wallet with Devnet SOL:
```bash
solana airdrop 2
```

Do not use your main wallet seed phrase or private key for development.

## 5. Build and test

```bash
anchor build
anchor test
```

The included TypeScript test only checks provider connectivity. It is not a security test suite. Implement the integration and adversarial tests listed above before deployment.

## 6. Devnet USDC mint

The commonly used Circle Devnet USDC mint is:
`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

Verify this address against current Circle/Solana documentation before initializing the platform. Do not accept a mint address supplied by an arbitrary frontend user. The platform config pins the mint at initialization.

## 7. Deploy only after local tests

```bash
anchor deploy --provider.cluster devnet
```

For local validator testing, `anchor test` uses the Localnet provider setting. For Devnet deployment, the command above explicitly overrides the cluster.\n\nThen verify the deployed program ID and inspect transactions on Solana Explorer with the Devnet cluster selected.

## Financial and security limitations to resolve before mainnet

1. The configured authority currently approves proposals, settlements, and cancellations. Replace this single signer with a properly integrated multisig governance flow before real funds.
2. Settlement evidence, business verification, legal agreements, Sharia review, dispute handling, and sanctions/AML processes are off-chain responsibilities.
3. Rounding dust can remain in the vault. Add a formally specified dust/refund policy and exhaustive tests before mainnet.
4. There is no time-based funding expiry, milestone disbursement, emergency pause, authority rotation, or account closure in this first scaffold.
5. The code uses the classic SPL Token Program. Token-2022 is not supported.
6. Investor claim calculations use floor rounding. Test all edge cases and ensure the final accounting policy is disclosed.
7. A wallet signature proves control of a wallet, not the real-world identity of its owner.

## Program ID placeholder

The initial program ID is generated for this scaffold. Run `anchor build` and `anchor keys sync` to create/synchronize the actual local program keypair and ID before deployment.
