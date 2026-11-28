# MoonCreditFi workspace implementation checklist

## Phase 1 — Repository and integration audit
- [x] Inspect the existing frontend, auth, Supabase schema/RLS, and Solana IDL and instruction flows.
- [x] Confirm live Supabase currently contains only `mooncredit_profiles` and `readiness_assessments`; the planned platform migration tables are not deployed.
- [x] Map source of truth: authenticated profile/readiness in Supabase; pool, proposal, position, and settlement state from Solana Devnet.
- [ ] Directly verify deployed Devnet program/mint accounts when a configured RPC endpoint is available. Local `.env.development.local` does not contain the Vite RPC variables.

## Phase 2 — Workspace foundation and global navigation
- [ ] Improve shared workspace shell, navigation, account menu, responsive mobile navigation, breadcrumbs, notifications entry point, and loading/error/empty patterns.
- [ ] Apply the existing additive Supabase platform migration only after confirming its exact live target and RLS/grants; re-check the resulting schema before data-access code.
- [ ] Keep unavailable backend capabilities explicit; do not invent history, trust scores, or review states.

## Phase 3 — Investor pools
- [ ] Improve live pool discovery, search/filter/sort, pool details, risk/terms, confirmed contribution flow, and portfolio/settlement visibility.
- [ ] Verify every reported contribution against confirmed chain state.

## Phase 4 — Entrepreneur funding workflow
- [ ] Complete business profile, document intake, proposal drafts/submission/revisions, reports, and pool management.
- [ ] Keep proposal review fields and verification state server-controlled; do not bypass contract approval requirements.

## Phase 5 — Readiness and opportunities
- [ ] Make readiness useful from verified/current inputs; never present an unsupported credit or readiness score.
- [ ] Use only approved/published business and on-chain pool data for opportunity discovery/details.

## Phase 6 — Remaining workspaces
- [ ] Investor and entrepreneur dashboards use live account data and clearly label unavailable indexed history.
- [ ] Complete investments, business profile, notifications, settings, and admin workflows with real authorization and data.

## Phase 7 — Verification and delivery
- [ ] Test auth, wallet, proposal submission/review, opportunity-to-pool navigation, contribution confirmation, settlements, RLS, and responsive/accessibility states.
- [ ] Run focused tests, lint, and production build; record any external integration or contract limitations accurately.
