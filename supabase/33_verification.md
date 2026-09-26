# Expense edit/delete gate

Migration 33 is deployed and verified through authenticated REST on 2026-09-26. Expense reassignment, retry deduplication, stale-snapshot rejection, viewer denial, and deletion restoration passed. Web edit/delete controls are enabled for owners; ENABLE_EXPENSE_MUTATIONS=false can disable them.

Required checks on a disposable project:
- Changing account returns the original debit and posts the new amount to the target account exactly once.
- Same-account editing makes the old amount available when validating the new amount.
- Two sessions edit one expense from the same snapshot: first succeeds, second gets STALE_EXPENSE.
- Duplicate update/delete request ID returns its previous result.
- Deletion restores account balance; expense and debit disappear together.
- Viewer is rejected before reading receipt or mutating the expense.
- Mixed original Android and new web updates still lock the same expense row; snapshot protects web from stale saves.

Receipt attachment and its conflict handling are not included in this migration.
