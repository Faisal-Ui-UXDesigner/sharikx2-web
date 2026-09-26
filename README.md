# SharikX2 Web — foundation

Standalone web project. Android files and Supabase schemas have not been modified.

Current scope: responsive Arabic shell, owner/viewer entry adapters, read-only initial lists, skeleton loading, isolated new-table API gateway, shell-only PWA caching, and offline unit tests. This is NOT feature-complete or production-ready.

Read-only expansion: account summary uses documented server fields; debt tabs use the server debt snapshot with zero-balance archives; products and sales paginate in groups of 20; sale details include items and return records. Search is explicitly limited to loaded records for paginated lists. Currency remains ILS until the settings domain is ported.

Owner integration: migration 30 replaces the single-device owner restoration behavior with verified owner-session grants. The user reports applying it; actual deployed definitions and two-device behavior still require verification. Do not run automated login tests on a live project. Web stores only auth tokens in per-tab sessionStorage, never the project password; logout clears those local tokens.

Operation safety: migration 31 adds optional idempotent web wrappers for sales and expenses; migration 34 adds the same receipt and locking wrapper for account transfers. Deployed definitions and authenticated REST concurrency/RLS tests passed (see VERIFICATION.md). `operations.js` keeps one immutable request ID/payload across concurrent clicks and retries. Expense entry and account transfers are implemented for owners, including current balance, decimal amounts, pending-operation journal recovery, loading state, and safe retries. Browser smoke validation used a synthetic API, not a live financial project. All other financial write workflows are pending. Existing Android signatures are unchanged and do not automatically gain these new request IDs.

Expense records: the cashier uses a unified chronological activity feed for the latest sales and expenses, with 20-at-a-time loading, details sheets, and original payment account. Attachments, project currency, and refresh after other-device updates still need implementation.

Expense edit/delete UI is implemented and enabled for owners following successful migration 33 REST tests. Set ENABLE_EXPENSE_MUTATIONS=false to disable it. Snapshot conflict detection and idempotent mutations wrap the existing balance-safe server functions. Attachments remain unimplemented. The web is not ready for production publication.

Manual sales: product picker with pagination, cart removal, quantity and integer-price overrides (sale only), below-cost warning, live total immediately above confirmation, and receiving-account selection. A zero-balance account can receive funds. Submission uses the tested sale wrapper and session journal for safe retry. Existing customer selection and debt mode are implemented; debt requires a name and ten-digit phone. A nested customer creation sheet returns to the intact cart and selects the saved customer. Customer creation retries retain the same UUID and check conflicting inserts instead of creating duplicates. Camera scanning, refunds UI, and browser/iPhone end-to-end tests remain pending. Customer/debt UI and creation retry behavior have unit coverage but still require deployed integration and browser validation.

Integration harness: `node scripts/test-concurrency.mjs` requires a public SUPABASE_ANON_KEY and makes real temporary test requests. It creates three anonymous auth identities, creates only a fresh disposable project, and cleans up that exact project. Run only intentionally against an approved Supabase environment; never use a service-role key. Outputs a credential-free integration-results.json report.

Run `npm test` and `npm run build`. Supply `SUPABASE_ANON_KEY` (public anon key only) at build time for connection testing. Never supply service-role credentials. Serve `dist` over HTTPS for PWA features.

Before deployment: validate actual RPC response shapes and RLS with a dedicated test project, implement every domain in PARITY.md, verify iPhone Safari behavior and attachments, add install icons, and complete accounting regression tests. `render.yaml` defines a static Render service with auto-deploy; set only the public anon key in Render. GitHub and Render deployment have not yet been performed.
