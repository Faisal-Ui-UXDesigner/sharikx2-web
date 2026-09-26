# Verification record — 2026-09-26

## Supabase (actual SQL Editor execution)

Read-only inspection confirmed deployed functions:
- restore_sharikx2_owner_project_v2: verified-session table present, no owner_id transfer.
- confirm_sharikx2_sale_web_v1 / confirm_sharikx2_expense_web_v1: security definer, empty search path, advisory request locks and changed-payload rejection present.
- Existing sale v2 and expense v3 are still present.

An isolated smoke test used a new random SharikX2 project inside a rolled-back PL/pgSQL subtransaction. It did not update any existing project. The SQL Editor returned seven PASS rows:
1. Same expense request returns one expense.
2. Changed payload for the same request is rejected.
3. Insufficient account balance is rejected.
4. Same sale request returns one sale and one stock deduction.
5. Insufficient stock is rejected.
6. Failed operations leave no operation receipts.
7. Disposable project rows were rolled back.

Identity sequences can advance during rolled-back inserts; this can cause harmless gaps in sale numbers. No test balances or projects remain.

This does not prove concurrent two-session behavior, RLS enforcement under authenticated REST, live Android/website coexistence, or edit conflict handling. These remain required before enabling financial write UI.

UI evidence: SQL Editor query fe8fe1d6-9b9e-419d-8f50-d9b21ffc330b returned seven PASS rows. The associated local repeatable smoke script is supabase/32_operation_smoke_test.sql (equivalent fixture; same assertions).

## Authenticated REST concurrency test — 2026-09-26

Executed scripts/test-concurrency.mjs against the configured Supabase project, using three new anonymous auth identities and a fresh random disposable SharikX2 project. No existing project IDs or passwords were used. All seven checks passed:

1. Original and restored owner auth identities retained server read/write access simultaneously.
2. Two simultaneous expense submissions with one request ID returned the same expense.
3. Two simultaneous attempts to spend 60 from a remaining 90 balance allowed one; the other failed with INSUFFICIENT_ACCOUNT_BALANCE.
4. Two simultaneous sales of the last piece allowed one; the other failed with OUT_OF_STOCK.
5. A separate authenticated viewer could read the paid fixture but could neither execute an expense nor update its inventory.
6. Financial summary reconciled to liquidity 40 and inventory cost 0.
7. The exact newly created disposable project was deleted through the verified phone/password deletion RPC.

Evidence: integration-results.json. The test left three anonymous auth identities without any project memberships; it did not delete auth.users because that would require broader admin access and could invoke unrelated legacy lifecycle behavior. No financial test project remains.

This verifies REST-level concurrency and RLS, not the Android/iPhone UI flows, stale edit detection, supplier payment retries, receipt attachment behavior, or simultaneous use of older Android RPCs. These remain open parity gates.

## Expense UI smoke test — synthetic API

Browser test at /tests/expense-preview.html (excluded from dist):
- Selecting cash 100 with amount 25 showed remaining 75.
- Selecting wallet 0 with amount 25 rejected confirmation with an insufficient-balance message.
- Switching to cash allowed the mock save and closed the sheet.
- Reviewed the navy/gold bottom sheet with internally scrolling content; no real expense was created by these UI tests.

Local suite: 20 tests pass. Owner-only entry is also enforced at module entry and independently by the tested server RPC.

## Expense mutation REST tests

The integration harness was extended after migration 33. All 11 integration checks passed, including:
- Concurrent identical reassignment moved expense 10 from cash to a bank expense 20 once. Cash was restored to 50; bank became 80 from 100.
- A different request using the original snapshot failed with STALE_EXPENSE.
- Authenticated viewer mutation failed.
- Concurrent identical deletion returned the original result twice, removed one expense, and restored bank to 100.
- Fresh disposable test project cleanup succeeded.

No production project or Android code was modified. This run created three additional anonymous auth identities without retained project memberships. UI edit/delete controls can now target the verified migration; iPhone/browser end-to-end coverage remains pending.

## Account transfer REST tests

Migration 34 was applied to the new-table Supabase project and the fresh-fixture harness passed four additional checks: duplicate transfer receipt, immutable request payload, viewer denial, and concurrent source-balance protection. The temporary fixture was deleted after the run. The web UI remains feature-flagged off in the checked-in preview config until a deployment build supplies `ENABLE_TRANSFERS=true`.

The purchase form was checked against the deployed purchase safety function on the same disposable fixture: duplicate invoice/payment produced one result, changed payload reuse was rejected, and inventory increased once.
