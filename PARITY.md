# Android parity gate

All entries below remain incomplete until validated against Android and server behavior.

- Project creation, restoration, owner credentials, view-only sharing, subscription state and free limits. Web now has a three-step creation flow and opening capital distribution using SharikX2 RPCs; live end-to-end verification is still required before calling this parity-complete.
- Inventory metadata, categories, low-stock thresholds, purchase history, fractional cost formatting.
- Cashier scanner, manual cart, quantity and per-sale price edits, customer details and debt validation.
- Atomic/idempotent sale confirmation, account receipts, partial/full returns and single net-sales deduction.
- Customer debt timeline, collections, returned items, archives and contact action. Web collection supports partial/full payment with idempotent retry after migration 37.
- Supplier timeline, split-account payments, receipts, purchase invoices and unpaid balance confirmation. A protected web purchase form now supports supplier/product selection, fractional costs, multiple account payments, remaining supplier debt, and idempotent retry; it still needs deployed browser and accounting regression coverage.
- Expenses: original payment account, editing reversals, deletion, camera/file attachments.
- Capital contributions, opening distribution, liquidity, monthly profit approval and exports. Account transfers are implemented through the tested web wrapper, with server locking and idempotent retry.
- Currency, FAQ, subscription comparison, accessibility, RTL, light/dark themes.
- Notification behavior: iOS PWA limitations must be explicitly evaluated; do not claim Android background behavior is identical.
- Security: server-side ownership/view-only enforcement, no legacy table access, no sensitive cache, no secret browser keys.

Implemented domains (not full parity): mobile-referenced header, cashier action grid with the Android image assets, icon bottom navigation, Cairo font, welcome/login/project-creation screens; read-only accounts/debt/inventory/sales views; sale details; owner-only expense creation/edit/delete using tested RPCs; latest expense records/details; manual paid/debt-sale cart/confirmation with safe retry; existing customer selection and nested customer creation. Partners and reports remain explicitly incomplete in the web UI. Expense account/amount validation and save path were smoke-tested in a synthetic browser fixture. New onboarding, sale/customer UI, attachment flows, and accounting writes still require deployed end-to-end verification.
