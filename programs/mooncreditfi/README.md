# MoonCreditFi Anchor Program

This crate implements MoonCreditFi's Mudarabah-style funding lifecycle as a Solana Anchor program. It records proposals, USDC contributions, funding and settlement states, and investor claims on-chain.

> **Development software:** This program is not audited or production-ready. Use Devnet or a local validator only; never use real funds.

## Configuration

| Setting | Value |
| --- | --- |
| Anchor | 0.30.1 |
| Program ID (Devnet) | `6LVAYFDRrTHSiHZqMWr4tybZNRi755HsoHgeku985pYx` |
| Configured Devnet USDC mint | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| Token interface | Classic SPL Token (`TransferChecked`) |
| Mint precision | 6 decimals |

The program ID is declared in `src/lib.rs` and configured under `[programs.devnet]` in the repository's `Anchor.toml`. The Anchor provider defaults to Localnet, so explicitly select Devnet for Devnet CLI operations.

The first `initialize_platform` call creates the singleton configuration PDA and pins the authority and six-decimal mint. The instruction does not restrict who initializes it: whichever signer initializes the PDA first becomes the authority and chooses the mint. Initialize from the intended authority before exposing the deployment. The current platform authority can transfer authority with `transfer_platform_authority`; the new authority address should be verified before signing because the transfer takes effect immediately.

## Funding lifecycle

1. **Initialize the platform** — the authority creates the config account and selects the six-decimal mint.
2. **Register an entrepreneur** — a wallet creates its entrepreneur profile PDA.
3. **Submit a proposal** — the registered entrepreneur supplies a 32-byte `business_id`, funding goal in token base units, and entrepreneur profit share in basis points. The proposal starts unapproved.
4. **Approve the proposal** — only the configured platform authority can approve it.
5. **Create a pool** — the approved proposal's entrepreneur creates one pool and its pool-controlled USDC vault.
6. **Contribute** — investors transfer USDC into the vault. Contributions must be positive, the pool must be open, and total contributions cannot exceed the funding goal. Each investor has one position per pool.
7. **Activate and disburse** — once the funding goal is reached, the entrepreneur activates the pool. Disbursement then requires both the entrepreneur and platform authority; the pool PDA transfers the contributed capital to the entrepreneur's token account.
8. **Settle** — the entrepreneur deposits the reported return into the vault and submits a settlement record. The platform authority approves the settlement before claims are enabled.
9. **Claim** — investors claim their calculated distribution. After every investor has claimed, the entrepreneur can claim the agreed share of profit.

The platform authority can cancel pools while they are `Open` or `Funded`. Investors can then claim refunds equal to their recorded contributions. Cancellation is not available after capital has been disbursed.

## Instructions

| Instruction | Authorization and behavior |
| --- | --- |
| `initialize_platform` | Any initializing authority signer creates the one-time config; requires a six-decimal mint. |
| `transfer_platform_authority` | The current platform authority immediately transfers authority to a non-default, different public key. |
| `register_entrepreneur` | The entrepreneur signer creates their profile. |
| `create_proposal` | A registered entrepreneur creates a proposal; profit share must be 0–10,000 bps. |
| `approve_proposal` | The configured platform authority approves a proposal once. |
| `create_pool` | The approved proposal's entrepreneur creates its pool and token vault. |
| `contribute` | An investor transfers a positive amount not exceeding the remaining funding goal. |
| `activate_pool` | The pool's entrepreneur activates a pool that has reached its funding goal. |
| `disburse_capital` | The authority and entrepreneur jointly authorize transfer of the pool's raised capital. |
| `submit_settlement` | The entrepreneur deposits the reported return and submits a settlement for review. |
| `approve_settlement` | The configured platform authority approves the pending settlement. |
| `claim_distribution` | An investor claims once from a settled pool. |
| `claim_entrepreneur_profit` | The entrepreneur claims once after all investor claims complete. |
| `cancel_pool` | The configured platform authority cancels an open or funded pool. |
| `claim_refund` | An investor claims their contribution after cancellation. |

All token movements use the classic SPL Token Program and `TransferChecked`. The program validates the configured mint, token-account ownership, pool vault, PDA seeds, and applicable pool state through Anchor account constraints and instruction checks.

## Accounts and PDA seeds

| Account | Seeds | Purpose |
| --- | --- | --- |
| `PlatformConfig` | `["config"]` | Stores the authority, configured mint, and PDA bump. |
| `EntrepreneurProfile` | `["entrepreneur", entrepreneur]` | Records a wallet's entrepreneur registration. |
| `BusinessProposal` | `["proposal", entrepreneur, business_id]` | Stores the target, proposed profit share, and approval flag. |
| `MudarabahPool` | `["pool", proposal]` | Tracks the goal, contributions, returns, status, claims, and entrepreneur. |
| Vault token account | `["vault", pool]` | Holds the pool's configured SPL token; its authority is the pool PDA. |
| `InvestorPosition` | `["position", pool, investor]` | Tracks one investor's contribution and claim state. |
| `SettlementRecord` | `["settlement", pool]` | Stores the entrepreneur-reported returned amount and authority approval. |

## Distribution and rounding

- If the settled return is below total contributions, the returned amount is distributed among investors in proportion to their contributions. This allocates the loss pro rata; the contract does not determine why the loss occurred.
- If the return exceeds contributions, investors receive their principal plus their proportional share of profit after the entrepreneur's configured profit share is reserved.
- Calculations use integer arithmetic and floor rounding. Small rounding remainders can remain in the vault; this program has no dust sweep instruction.
- The entrepreneur profit claim is gated on all investor positions being claimed. An investor who never claims can therefore prevent the entrepreneur claim.

## Build and test

Run commands from the repository root:

```bash
anchor build
anchor test
```

`Anchor.toml` uses Localnet as the default provider. The Anchor test initializes the platform on the test validator; it is not a Devnet deployment. Review the tests and add broader authorization, state-transition, arithmetic-boundary, and token-account cases before relying on the program.

To deploy to Devnet, verify the program keypair, authority wallet, cluster, and mint first:

```bash
solana config set --url devnet
solana address
solana balance
solana airdrop 2
anchor deploy --provider.cluster devnet
```

Never commit or share the deployment keypair, a wallet private key, or a seed phrase.

## Security and scope limitations

- The platform uses a single authority key for proposal approval, settlement approval, disbursement authorization, and cancellation. Authority transfer requires the current authority's signature; no multisig is implemented.
- `business_id` is an opaque 32-byte identifier. The contract stores no business description, evidence, identity verification, or legal agreement.
- Settlement values are supplied by the entrepreneur and approved by the authority. The contract cannot verify business performance, actual profit or loss, fraud, negligence, or Sharia compliance.
- No funding expiry, emergency pause, dispute process, Token-2022 support, or dust-recovery mechanism is implemented.
- A wallet signature proves control of an address, not the real-world identity or trustworthiness of its owner.

The frontend currently exposes proposal submission, creation of an approved pool, and USDC contributions. Other instructions may require a separate client flow. Confirm the full IDL and account/instruction ABI against the target deployment before submitting transactions.