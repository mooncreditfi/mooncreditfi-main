# MoonCreditFi

MoonCreditFi is a Solana application for Mudarabah-style business funding. The repository contains an Anchor program and a React/TanStack frontend. The current pool workflow is configured for Solana Devnet.

## What works today

- Sign in with a Solana wallet throughout the workspace using a signed sign-in message and Supabase Auth.
- Browse live pool and proposal accounts read from the MoonCreditFi Devnet program.
- Submit an entrepreneur funding proposal with a USDC target and profit-share basis points.
- Create a pool from an approved proposal.
- Contribute Devnet USDC to an open pool. If needed, the page creates the contributor's associated token account in the contribution transaction.
- Review on-chain transaction links in Solana Explorer.

Every transaction must be explicitly signed by the connected wallet. A sign-in signature authenticates a session only; it does not authorize a blockchain transaction.

### Approval and roles

Entrepreneur and investor roles are selected in the user's profile. Signing in does not grant a role or approve a funding request. A funding proposal must be approved by the program's platform authority before its entrepreneur can create a pool. Proposal approval is an administrator action, not an automatic sign-in or pool-page action.

## Devnet configuration

| Setting | Value |
| --- | --- |
| Network | Solana Devnet |
| Program ID | `6LVAYFDRrTHSiHZqMWr4tybZNRi755HsoHgeku985pYx` |
| Configured USDC mint | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| Token program | Classic SPL Token Program |

The program ID and mint are configured in [platform-capabilities.ts](frontend/src/lib/platform-capabilities.ts); the Anchor client uses [mooncredit-program.ts](frontend/src/lib/mooncredit-program.ts) and the bundled [mooncreditfi.json](frontend/src/idl/mooncreditfi.json) IDL.

`Anchor.toml` defaults its provider to Localnet. Use an explicit Devnet cluster flag when deploying or using the CLI against Devnet. The frontend pool page targets Devnet.

## Requirements

- Node.js and npm for the frontend.
- Rust, Cargo, Solana CLI, and Anchor CLI 0.30.1 for the program.
- A supported Solana wallet (Phantom or Solflare) set to Devnet.
- A Supabase project configured for Solana wallet sign-in.

## Run the frontend

Configure these environment variables for the frontend (for example in `frontend/.env.local`). Do not commit credentials or private keys:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
```

Install dependencies and start the development server:

```bash
cd frontend
npm ci
npm run dev
```

The pool workspace is available at `/pools`. Other useful frontend commands:

```bash
npm test
npm run lint
npm run build
```

## Build and test the Anchor program

From the repository root:

```bash
anchor build
anchor test
```

The Anchor test provider is Localnet by default. To deploy to Devnet, first confirm the program keypair, authority wallet, and configuration, then explicitly select the cluster:

```bash
solana config set --url devnet
solana address
solana balance
solana airdrop 2
anchor deploy --provider.cluster devnet
```

Use only a development wallet. Never share or commit a wallet seed phrase, private key, or `target/deploy/mooncreditfi-keypair.json`.

## Contract and verification notes

The program includes platform initialization, entrepreneur registration, proposal submission and authority approval, pool creation, USDC contributions, funding activation and disbursement, settlement approval, investor claims, entrepreneur profit claims, cancellation, and pre-disbursement refunds. The current frontend exposes proposal submission, approved-pool creation, and contributions; other contract instructions may not have a frontend flow.

The frontend checks the on-chain platform configuration and mint before loading the pool workflow. The bundled IDL is in Anchor 0.30 format. The Devnet program/configuration and mint have been checked, but verify the complete deployed instruction/account ABI against the deployed program before relying on transactions.

## Safety limitations

This project is development software, not an audited or production-ready financial protocol. Do not use real funds. Devnet tokens have no real value, and successful transactions do not establish that a business or investment is legitimate.

The contract does not verify identity, business documents, actual profit, fraud, or Sharia compliance. Settlement evidence, legal agreements, business verification, dispute handling, and sanctions/AML processes require separate off-chain controls. The program currently uses a single platform authority; do not use it to manage real funds without a security review, governance controls, and a documented operational process.

Additional protocol limitations include rounding dust, floor-rounded investor claims, no time-based funding expiry or emergency pause, and no Token-2022 support. Review the Rust program and tests before changing these assumptions or deploying.
