## Platform data foundations and deployment

The migration `supabase/migrations/20261126000100_platform_records.sql` adds owner-scoped business profiles, draft/submitted funding proposals, private document metadata and a private Supabase Storage bucket, entrepreneur-submitted reports, persistent notifications/preferences, a confirmed transaction event ledger, and backend-only audit storage. Apply it to the connected Supabase project before using these features.

The application now exposes one `AuthProvider` at the route root. It restores the persisted Supabase session, listens to auth state changes, and supplies a shared `useAuth()` hook. Existing Supabase Web3 sign-in remains the authentication method; wallet connection alone still does not authenticate a user. Enable the Solana Web3 provider and set allowed redirect URLs in the Supabase dashboard.

### Important integration boundaries

- The migration creates storage and database security policies, but a server/indexer worker is still required to write reviewed proposal states, notifications, audit events, and indexed transaction rows using a server-only service role. Never place the service-role key in `VITE_*` variables.
- `indexed_transactions` is an event ledger schema, not an indexer by itself. A worker must scan the configured MoonCreditFi program, confirm transaction success at the chosen commitment, decode the deployed IDL, and upsert on `(signature, event_index)` before the UI can report complete transaction history.
- The current deployed program stores an opaque 32-byte business identifier. Linking it to a private business record requires a documented, deterministic encoding and review workflow; this migration does not claim that connection is already live.
- Document files are private and capped at 10 MiB for PDF/JPEG/PNG. Administrator access and malware scanning require a trusted server-side reviewer/scanning service; there is deliberately no public bucket or owner-editable verification status.
- Business reports are entrepreneur-submitted statements. They are not verified financial statements or chain-verified settlement results.

Apply via the Supabase CLI from `frontend/` after checking the project target:

```sh
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Run the frontend checks from `frontend/`:

```sh
npm test
npm run lint
npm run build
```
