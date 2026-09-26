# Operation safety verification gate

SQL 31 is deployed (verified in SQL Editor); sequential smoke and authenticated REST concurrency/RLS assertions passed on 2026-09-26. See VERIFICATION.md. Existing Android callers continue using old RPC signatures and do NOT gain request-id deduplication from these new wrappers. Do not claim full cross-client protection until Android parity is separately authorized and tested.

Required disposable-project tests:
- Two simultaneous calls with identical request ID/payload return the same entity and produce one movement set.
- Same request ID with different payload or operation type fails.
- Failed stock/balance validation leaves no operation receipt or partial movement.
- Two sessions sell the last piece: exactly one succeeds.
- Two sessions spend a shared balance: the second checks the committed remaining balance.
- Web baskets with reversed product order do not deadlock each other. Existing Android ordering still requires a separate server review.
- Lost response followed by retry returns the original result without a second expense/sale.
- Viewer tokens fail before receipt lookup or business execution.
- Deleted/edited entities must not be recreated by retrying an old request ID; receipts preserve the original outcome.

Pending safeguards: supplier payment/collection/return idempotency, conflict versions for expense edits, realtime freshness, request journal recovery after closing the tab, and live concurrent integration tests. No financial write UI is enabled yet.
