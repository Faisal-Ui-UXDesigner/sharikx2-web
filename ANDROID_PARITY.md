# SharikX2 Android parity work

Reference: `../app/src/main/java/com/partner/accountant/` in shareeki-play-store.
Android behavior is the reference. UI availability, rules, server contracts and cross-device results must all be checked before a domain is marked complete.

## 2026-10-06: first implementation increment

Implemented the report screen from Android `ReportPeriod`, `ReportSummaryData`, `ReportDetailsModel`, `ReportDebtRules`, `ReportSummaryView`, `ReportDetailsView` and `SubscriptionRules`.

- Day report; paid range reports; expiry-aware range gating.
- Inclusive date endpoints and reversed endpoint normalization.
- Sales, purchases, miscellaneous, wages, customer/supplier invoice debt and net result.
- Reverse chronological day cards, movement filters and retained expansion state.
- Full pagination for invoice-debt reads; failed reads never masquerade as zero debt.
- Stale response protection when changing dates or leaving the screen.
- Currency activated on owner/viewer entry and reset on logout.
- Return entry restricted to owners, with unavailable sale states hidden.

Verification: 57 local unit tests passed. Synthetic mobile-browser smoke passed for owner/viewer report reads, 45-invoice pagination, currency restoration, reversed/date range arithmetic, movement filtering, escaped text, late responses and mobile layout. Build passed in preview mode (without a public connection key). No live financial project was used.

## 2026-10-06: web-only report source reconciliation

Android and the backend schema are unchanged. The web now reads all paginated server sales and expenses alongside the shared finance snapshot. Explicit sale/expense IDs and acknowledged client request IDs replace linked snapshot records; unlinked manual records are preserved. Pending local records are excluded from confirmed totals. Current server sale amounts are authoritative after returns, with no second subtraction.

New expense requests use Android's `daily_wage` category. Existing `daily_wages` records remain readable, and queued retry payloads are not rewritten. Return quantities now subtract quantities already returned for each sale item; an unpaid credit sale lowers customer debt without requiring a refund account. Movement timestamps use Asia/Hebron dates; invoice debt retains Android's separate ISO-date rule. Any failed source read fails the whole report instead of displaying incomplete totals.

Verification: 66 local unit tests passed. Synthetic Edge mobile-browser smoke passed with stale linked snapshot amounts and server-backed sales/wages/expenses, owner/viewer access, pagination, filtering, late responses, safe text and mobile layout. Build passed using the existing preview configuration. The web accounts screen now consumes the Android financial activity RPC with today/month/all-time periods and confirmed movement rows; the partners screen now reads current and former partner snapshots with shares and settlement values. Shared period, movement-label and partner-normalization rules live in `financial.js` instead of the app bootstrap. No live financial writes or Android changes were made. Service-worker cache is v17.

## Report data gate (still open)

Android `MainActivity.renderReports` calculates the report summary from its local `revenues`, `entries` and `expenses` arrays. `get_sharikx2_finance_state_v1` supplies the shared snapshot of those arrays to the web. The web deliberately uses the same arithmetic and does not substitute invoice purchase totals or cost-of-goods formulas.

Android `recordCashierRevenue` records a cashier sale in local state and invokes `save()`. That method writes SharedPreferences; it does not itself call `save_sharikx2_finance_state_v1`. The web now reconstructs linked operations from existing server rows. Manual movements that were never uploaded cannot be inferred from the server. A real Android-to-web fixture comparison remains necessary before the report domain is parity-complete; this work does not change Android persistence.

Debt figures intentionally match Android `ReportDebtRules`: remaining debt on invoices whose `created_at` ISO date falls within the period; excluded sale states are pending/cancelled, and excluded purchase states are draft/cancelled/returned. These figures are not the entire project's debt and do not subtract a returned sale amount a second time.

## Inventory read stage

The inventory screen now uses a pure model in `inventory.js`, a separate view in `inventory-ui.js`, and a validated mutation module in `inventory-mutation.js`. It loads all active server products, searches name/barcode, filters categories, preserves project-wide valuation totals while filtering, and opens product details with paginated purchase history scoped through the parent purchase project. Owners can add and edit product identity and pricing fields, and can delete an empty product by deactivating it (`active=false`) while retaining purchase history; products with remaining stock are protected. Stock quantity remains changed only by purchase and sale operations. A Map indexes products by ID.

Purchase units and pieces use the Android InventoryCloudMapper conversion: quantity and low-stock thresholds are divided by pieces per purchase unit; purchase and sale unit prices are multiplied by that factor for display. Legacy purchase-unit inputs produce the same valuation as server piece inputs.

Verification: 72 unit tests passed, plus a dedicated synthetic Edge inventory browser check for search, categories, totals, unit conversion, purchase history, owner product creation, protected non-empty deletion, empty-product archival, currency, escaped text and mobile width. The report browser regression also remains part of stage checks. Category settings, scanner, popularity and inventory audit remain open. This completes the inventory lifecycle stage, not the entire inventory domain.

## Remaining domain gates

| Domain | Current gap |
| --- | --- |
| Reports | Live Android/server fixture comparison, unavailable local-only manual records, full financial accounts page, monthly export and approval |
| Partners | Partner edits/distributions, contributions, withdrawals, debts and sharing actions |
| Inventory | Scanner, popularity, full inventory audit, summary quantities and live cross-device verification |
| Cashier | Scanner, saved carts, return quantities/refund rules/recovery, live multi-device regression |
| Customer/supplier accounts | Complete movement details/pagination, invoice returns/cancellation, archives and receipts |
| Accounts | Approval workflow, account movement filters/full statements and partner distribution details |
| Settings/entry | Protection/recovery/device controls, FAQ, subscription/payment flows, live visual/settings verification |
| Offline/PWA | Durable sale/expense queues, secure snapshots, reconnection behavior, icons and iPhone checks |

This increment is not certification of full Android parity or readiness for production.

## 2026-10-07: inventory code-quality and repeatable verification stage

- Extracted pure editor-value conversion and archive authorization rules; editing round-trips purchase units without changing stock or project identity.
- Protected submissions against duplicate events; save failures retain form values and permit retry. Completion callbacks are separate from mutation errors, and stale screen contexts cannot submit or refresh a different project.
- Removed blocking archive-error alerts in favor of inline accessible messages. Escape removes details/editor dialogs, and late purchase-history responses do not update removed screens.
- Empty-product archival uses a conditional REST update (`quantity_pieces=eq.0`, `active=eq.true`) so a concurrent stock change cannot be archived based solely on the displayed quantity. An empty returned representation is a conflict, not success. No database schema changes were made.
- Delegated product-list clicks through one listener instead of rebuilding handlers after every search/filter.
- Shared loopback preview-server implementation; each browser test obtains its own OS-assigned port and closes its server. Tests block external requests and never use a live project.
- Added `npm run check` for syntax, all unit tests and the inventory/report browser regressions. Browser checks currently use the existing local Playwright runtime and Microsoft Edge on Windows.

Verified: 76 unit tests, both isolated browser checks, syntax checks, preview build and `git diff --check` passed. Public connection configuration is empty; deployed REST behavior, Android/web cross-device snapshots and full visual parity remain unverified. Service-worker cache is v21.

## 2026-10-07: product persistence contracts and model efficiency stage

- Added a pure `product-contract.js` module for single-row mutation responses and conflict recovery comparisons. POST/PATCH no longer report success for empty, malformed, multiple-row or wrong-ID responses; archival also requires an explicitly deactivated returned row.
- Each creation editor retains one client-generated product UUID across retries. A 409 is recoverable only when a project-scoped lookup returns that exact active product with matching submitted fields, allowing the existing numeric storage scales. Another barcode, changed fields, another project or an archived product is a conflict, never an overwrite. The attempt payload is captured before awaiting the network. Closing and reopening the editor creates a new attempt; durable cross-reload recovery is not implemented.
- Search/category filtering no longer normalizes financial fields. Inventory aggregation uses a private accumulator; totals are recomputed on data changes instead of every keystroke. The source rows remain unchanged, and missing/invalid purchase-history dates sort after valid dates with stable ties.
- Added PWA asset/dependency checks to catch omitted modules. Included the new contract in preview builds and shell cache v22; public connection configuration remains excluded from caching.

Verification: 88 unit tests and isolated inventory/report browser regressions, JavaScript syntax, preview build and diff whitespace checks. Creation-loss/retry coverage uses synthetic data; deployed numeric rounding, REST conflict recovery and Android cross-device parity still need an approved live fixture. Android and database schemas are unchanged.

## 2026-10-07: session lifecycle and paginated-read quality stage

- A logout detaches the old refresh promise; completion of that promise cannot install credentials or clear a newer generation's refresh. Concurrent callers within one generation still share a refresh, and network failures remain retryable with the existing refresh identity.
- Authenticated requests validate the session generation before dispatch and after receiving a result. Old-generation results are rejected, not displayed or returned as current data. Already-dispatched writes may still commit on the server; this is not transaction cancellation and does not introduce automatic write retries.
- Stored sessions are validated and restored with only token/expiry fields. Malformed auth responses and non-positive/non-finite lifetimes are rejected before storage. Unavailable browser storage remains supported.
- Shared `pagination.js` now supplies the page-size contract, row validation and full-page collection for project lists and product purchase history. Reads capture their filters before awaiting, stop on logout, reject malformed pages and repeated IDs, and never return partial results after a failure. Purchase-history selection includes item IDs for duplicate detection.
- Offset pagination remains the existing backend contract: duplicate detection does not provide a transactional snapshot or detect every concurrent deletion/reordering. No server schema or Android changes were made. Shell cache is v23 and includes the new module.

Verified: 101 unit tests, isolated inventory and report browser checks (including a held report response released after logout), JavaScript syntax, preview build, built/source module comparison and diff whitespace checks. No live project requests or writes were made; deployed behavior and full Android parity remain unverified.

## 2026-10-07: inventory history parity stage

- Added the Android-compatible **سجل الجرد** tab to the web inventory screen. It reads `inventoryHistory` and `inventory` from the existing finance-state snapshot; no schema or Android changes were made.
- Modern history records (`historyVersion: 2`) are grouped by item and Palestine-local recorded date exactly as Android groups them. The first `before` and latest `after` states are retained, with an edit count and badges for name, unit, quantity, purchase-price and sale-price changes.
- Legacy records are displayed using Android’s compatibility behavior: delete records become real deletion entries; other records are resolved from the next matching history state or current inventory, and unresolved records remain explicitly marked as legacy rather than being guessed.
- History cards show addition/deletion/current values, quantity-unit conversion, expected profit impact and safe escaped names. Invalid/null records and malformed snapshots fail visibly or are skipped according to Android’s behavior; live purchase-invoice history remains a separate detail view.
- Added stale-tab protection, retry UI, mobile screenshots and a note that unsynchronized device-local changes cannot be inferred by the web.

Verification: 111 unit tests, inventory/report/accounts browser regressions, JavaScript syntax, PWA dependency checks, preview build and source/dist comparisons passed. The new stage uses synthetic state only; synchronization of Android-local inventory history and full visual comparison on a real device remain unverified. Service-worker cache is v25.

## 2026-10-07: inventory category settings parity stage

- Added the Android default category set, custom-category memory, case-insensitive hidden-category rules, required-category reveal behavior and the `أخرى`/placeholder options.
- Added Android-compatible Arabic display aliases, rename validation, reserved-name checks and newest-category ordering as pure, testable rules.
- Owners can add, hide/show and rename categories from the inventory screen. Settings are saved into the existing finance-state snapshot through the existing web RPC; viewers can only use the resulting visible filters.
- Hidden products remain stored and continue to appear in the all-products view, matching the Android settings note. All labels and category names are escaped before insertion.

Verification: 115 unit tests, isolated inventory/report/accounts browser regressions, syntax checks, PWA dependency checks, preview build and diff whitespace checks passed. The category stage uses synthetic finance snapshots; deployed cross-device settings propagation and full visual comparison on a real Android device remain unverified. Service-worker cache is v26.

## 2026-10-07: cashier product picker parity stage

- Added Android-style category tabs to the web cashier product picker, including Arabic ordering and the `أخرى` category.
- Product search now applies the selected category and searches both product names and barcodes without changing the original product rows.
- Added a scanner-friendly barcode field: a hardware/camera wedge scanner can submit a barcode with Enter and add the matching available product directly to the cart. Unknown and out-of-stock barcodes produce an inline error.
- Kept the existing stock limits, duplicate-line handling, sale retry journal and owner-only mutation checks unchanged.

Verification: 116 unit tests, all isolated inventory/report/accounts browser regressions, JavaScript syntax, PWA dependency checks and preview build passed. Barcode input is covered at the pure filtering level; native camera permission/decoding and live cross-device cashier behavior remain unverified. Android and database schemas were not changed.

## 2026-10-07: inventory popularity and valuation presentation stage

- Added the Android 60-day popularity projection as a read-only web model. It uses completed/created sale timestamps in the Palestine timezone, excludes pending/cancelled/draft sales, ignores duplicate sale IDs and counts each product at most once per sale/day.
- Inventory cards now show the `رائج` badge at the same Android threshold (>51 qualifying sale-days), while unavailable popularity data leaves the inventory screen usable and neutral.
- Existing quantity conversion, purchase value, sale value and expected-profit equations remain unchanged and are still calculated from private normalized values without mutating source rows.

Verification: 118 unit tests, isolated inventory/report/accounts browser regressions, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Popularity uses synthetic sale rows in tests; live sales projection, cross-device timing and full visual comparison remain unverified. Service-worker cache is v27.

## 2026-10-07: inventory pinning parity stage

- Added owner-only pin/unpin controls to inventory cards. Pinned products are sorted first, with the most recently pinned product first; unpinned products retain newest-product ordering.
- Viewers can see which products are pinned but cannot change the state. Product rows and server product columns remain untouched.
- Pin state and pin timestamps are preserved in the existing finance-state snapshot with immutable pure helpers and visible rollback on save failure.

Verification: 120 unit tests, isolated inventory/report/accounts browser regressions, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Pin propagation uses synthetic finance snapshots; live multi-device ordering and full visual comparison remain unverified. Service-worker cache is v28.

## 2026-10-07: inventory list paging and context stage

- Matched Android’s initial inventory page size of 20 items and added a localized “عرض المزيد من الأصناف” action for additional items.
- Search and category changes reset the visible limit, while pin ordering remains stable before slicing the visible page. The list preserves the scroll position when more items are appended.
- Added a pure visible-row projection so source arrays are never mutated and invalid limits fail closed.

Verification: 121 unit tests, isolated inventory/report/accounts browser regressions, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Large-list behavior is covered by pure tests; live cross-device pagination and full visual comparison remain unverified.

## 2026-10-07: inventory statistics presentation stage

- The inventory summary card is now interactive like Android. It opens a safe dialog showing purchase value, expected sale value and expected profit using the same normalized totals.
- Added keyboard activation (`Enter`/`Space`), Escape/cancel cleanup and escaped, locale-formatted values. The summary remains read-only and filtering never changes the project-wide totals.

Verification: 121 unit tests, isolated inventory/report/accounts browser regressions including the statistics dialog, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Live visual comparison remains unverified.

## 2026-10-07: inventory editor category contract stage

- The product editor now uses the configured category list instead of an unrestricted text field. Display aliases are shown while the stable category key is submitted unchanged.
- Hidden categories are excluded for new products but are temporarily revealed when editing an existing product that uses one, matching Android’s required-category behavior.
- Corrected the finance-state category-name contract to read and write Android’s `{key, name}` alias array format, while safely accepting the older web object format during migration.
- Added duplicate/reserved-name validation coverage and verified that unrelated finance-state fields remain intact during settings saves.

Verification: 122 unit tests, isolated inventory/report/accounts browser regressions including category-editor behavior, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Live cross-device alias migration and full visual comparison remain unverified.

## 2026-10-07: barcode scanning parity stage

- Added a browser barcode scanner dialog using `BarcodeDetector` and the rear camera when supported. Product formats match Android’s configured EAN/UPC/Code and ITF set.
- Added manual barcode fallback for browsers without camera support or when permission/decoding fails. Scanner streams are stopped on close/cancel, and duplicate detections are throttled to Android’s one-second acceptance window.
- The cashier scanner adds the matching available product directly to the cart; the inventory editor scanner fills the barcode field without changing any other values.
- Camera access is entirely opt-in from an owner action; viewers retain no mutation or scanner controls.

Verification: 123 unit tests, isolated inventory/report/accounts browser regressions, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Native camera permission and decoder behavior still require validation on a real HTTPS device/browser; Android and database schemas were not changed. Service-worker cache is v29.

## 2026-10-07: inventory detail status parity stage

- Inventory details now show the Android-style current purchase cost, expected sale price, purchase value, expected sale value, expected profit and low-stock threshold together with purchase history.
- Details show the 60-day sale count once the read-only popularity projection is available, display zero for known no-sale products and explain when that projection is not available yet.
- All values remain presentation-only; no stock quantity, financial row or source object is mutated.

Verification: 123 unit tests, isolated inventory/report/accounts browser regressions, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Live visual comparison remains unverified.

## 2026-10-07: customer and supplier movement history stage

- Customer and supplier detail dialogs now use the shared full-page pagination collector instead of a single first-page read, so long movement histories are not silently truncated.
- Movement details include date, amount and status when available, retain Android’s separate customer/supplier labels, and preserve project/party filters on every page.
- Added cancellation cleanup and screen-generation checks so a late movement response cannot render into a closed dialog or a different project screen.
- Search is now Arabic case-insensitive and handles missing phone values safely.

Verification: 123 unit tests, isolated inventory/report/accounts browser regressions, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Live customer/supplier fixtures and full visual comparison remain unverified.

## 2026-10-07: debt snapshot contract stage

- Added a validated debt model for customer and supplier snapshots. Missing arrays, invalid amounts, duplicate identities and malformed totals now fail visibly instead of becoming zero or partial balances.
- Preserved decimal debt values and Android’s settled threshold (`<= 0.009`) for active/archive separation and collection-button visibility.
- Supplier rows follow Android’s newest-created ordering; Arabic search preserves source order, leading-zero phones and missing phone labels.
- Added synthetic browser coverage for active/archive tabs, threshold behavior, malformed retry and viewer mutation restrictions.

Verification: 127 unit tests, isolated inventory/report/accounts browser regressions, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Live debt snapshots and full visual comparison remain unverified. Service-worker cache is v30.

## 2026-10-07: debt movement projection stage

- Extracted customer/supplier movement projection into a pure `debt-details.js` model. It produces Android labels, combines invoices/sales with payments, handles missing dates safely and sorts newest first.
- The UI now consumes the shared projection while retaining escaped labels, status rendering, pagination and stale-dialog protection.
- Added unit coverage for customer/supplier labels, date ordering, missing arrays and zero-safe amounts.

Verification: 129 unit tests, isolated inventory/report/accounts browser regressions, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Live debt fixtures and full visual comparison remain unverified. Service-worker cache is v31.

## 2026-10-07: supplier management parity stage

- Added owner-only supplier editing with Android-compatible validation: a trimmed name with at least two characters and an optional ten-digit phone number.
- Supplier updates are scoped by both project and supplier identity, and the returned row is checked before the UI accepts the mutation.
- Added owner-only supplier archiving through `active=false`, preserving historical invoices and payments instead of deleting the supplier.
- Viewer accounts do not receive edit or archive controls; active/archive debt tabs continue to use the validated debt snapshot model.
- Added unit coverage for supplier payload normalization and validation.

Verification: 131 unit tests, isolated inventory/report/accounts browser regressions, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Live supplier fixtures and full visual comparison remain unverified. Service-worker cache is v32.

## 2026-10-07: debt entry actions parity stage

- Added an owner-only `إضافة زبون` action directly to the customer-debt screen, reusing the existing idempotent customer creation flow and preserving the Android ten-digit phone contract.
- Restored the owner-only `تسجيل فاتورة شراء` action directly to the supplier-debt screen; the previous render order inserted it before replacing the screen markup, so it was never visible.
- Viewer screens remain read-only and expose neither action.
- Added browser regression coverage for both owner actions and viewer restrictions.

Verification: 131 unit tests, isolated inventory/report/accounts browser regressions, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Live customer/supplier fixtures and full visual comparison remain unverified. Service-worker cache is v32.

## 2026-10-07: partner editing parity stage

- Added owner-only editing for current partner name and profit share on the partners screen, matching Android's editable partner setup fields while keeping capital and unrelated finance-state fields unchanged.
- Partner updates preserve the full Android finance-state shape and use the existing revision-checked `save_sharikx2_finance_state_v1` RPC to prevent stale overwrites.
- Names, percentages and aggregate share limits are validated before any write; viewer accounts remain read-only.
- Added unit coverage for normalization, immutable state updates, identity selection and the 100% aggregate limit, plus browser coverage for owner/viewer controls.

Verification: 135 unit tests, isolated inventory/report/accounts browser regressions, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Live partner fixtures and full visual comparison remain unverified. Service-worker cache is v33.

## 2026-10-07: customer contact editing parity stage

- Added owner-only editing of customer name and phone from the customer-debt screen, matching Android's customer detail flow.
- The update is scoped by project and customer identity, requires a trimmed name and exactly ten phone digits, and accepts only a confirmed single-row REST representation.
- Archived debt rows and viewer accounts remain read-only; movement and payment history are preserved because the mutation changes contact fields only.
- Added unit and browser regression coverage for normalization, validation and owner/viewer control visibility.

Verification: 137 unit tests, isolated inventory/report/accounts browser regressions, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Live customer fixtures and full visual comparison remain unverified. Service-worker cache is v34.

## 2026-10-07: supplier credit visibility parity stage

- Supplier detail dialogs now load the project-scoped positive supplier credits already produced by purchase returns.
- The UI shows the available unused credit separately from the current supplier debt and explains that it is applied to a later purchase, preserving Android's non-cash-credit meaning.
- Credit rows are normalized through a pure model that rejects malformed collections and ignores zero/invalid balances instead of displaying fabricated totals.
- Added unit coverage for credit filtering and aggregation; no refund mutation was added because the current web migration exposes the credit read contract but not the Android refund RPC schema.

Verification: 139 unit tests, isolated inventory/report/accounts browser regressions, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Live supplier-credit fixtures and full visual comparison remain unverified. Service-worker cache is v35.

## 2026-10-07: supplier old-debt entry and recovery stage

- Added owner-only old-debt entry inside supplier details using Android's existing `record_sharikx2_supplier_old_debt_v1` contract. The operation does not create purchases or modify stock.
- Validates project/supplier identity, nonempty description and positive two-decimal amount; checks the returned debt identity and amount before clearing the pending journal.
- Persist-before-send journal retains an immutable payload and request UUID across lost responses, retries and dialog reopening. Corrupt journals block replacement writes; unavailable storage prevents dispatch.
- Extracted debt detail rendering into `debt-details-ui.js` and added paginated, project/party-scoped old-debt history with escaped descriptions and stale-screen protection.
- Added dedicated isolated browser coverage for duplicate submits, timeout/reopen recovery, storage failure, corrupt journals, owner/viewer restrictions and history; main-app browser regression also exercises supplier history entry.
- Uses the existing Android SQL contract read from migration 30; no SQL, live database or Android files were changed. Reviewed Supabase function documentation and security checklist; deployed RPC availability and real accounting results remain unverified.

Verification: 142 unit tests and four isolated browser regressions, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks. Service-worker cache is v36. Optional receipt attachment remains a separate open gate.

## 2026-10-07: customer detail timeline and action stage

- Customer history now reads nested sale items with full pagination and existing project/customer filters, and displays Android invoice numbers, item quantities/totals and payment notes in newest-first order.
- Added a pure customer timeline projection without changing invoice values, source objects or the current debt snapshot.
- Owner detail dialogs expose customer editing and the existing collection flow for balances above 0.009; viewers receive no mutation actions.
- Customer editing guards duplicate submissions and outgoing screen contexts; late saves cannot refresh a different screen. Failed detail reads have an explicit retry action.
- Added isolated browser coverage for nested read scope, escaped names/notes, owner/viewer visibility, settled balances, duplicate/stale edits, failed-read recovery and late responses after closing.
- Supabase documentation review confirmed the nested REST read pattern; no SDK, schema, authorization policy or live project changes were made.

Verification: 145 unit tests and five isolated browser regressions, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Service-worker cache is v37. Live Android/web fixture comparison and customer-prefilled debt-sale entry remain open.

## 2026-10-07: customer-prefilled debt sale and safe recovery stage

- Customer details now expose Android's owner-only "إضافة مبيعة بالدين" action, including settled customers. The sale starts with the selected customer and debt payment mode; invalid customer identity/name/phone remains an actionable error on the details screen.
- Customer selection merges paginated results by identity without duplicating the prefilled option. Shared name/phone validation matches Android's two-character name and exact ten-digit phone requirements.
- Existing pending sales take priority over a newly selected customer. Recovery preserves the original payload, customer, cart and request UUID; corrupt journals block replacement submissions.
- Debt sales and their recovery work with no financial accounts. Restoring account radio selections no longer changes radio values. Outgoing screen contexts block submission and suppress late success refreshes; Escape removes the dialog.
- Corrected CSS display rules overriding the HTML hidden state, so account choices are actually hidden in debt mode. Removed obsolete cashier capability notices.
- Added an isolated browser regression covering the complete details-to-sale entry, owner/viewer restrictions, settled customers, validation, duplicate customer loading/submits, lost-response reopening, immutable retries, no-account sales, corrupt drafts, stale submission and mobile overflow.
- Reviewed Supabase function documentation/changelog and retained the existing confirmation RPC. No Android, SQL, authorization policy or live project changes were made.

Verification: 148 unit tests and six isolated browser regressions, JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks passed. Service-worker cache is v38. This closes the customer-prefilled entry gate locally; live Android/web fixture comparison and deployed RPC/accounting verification remain open.

## 2026-10-07: customer collection and supplier payment recovery stage

- Replaced duplicated collection/payment lifecycle code with shared `debt-payment-ui.js` and pure `debt-payment.js` rules, retaining the existing public entry points and separate RPC contracts.
- Matched Android `DebtPaymentRules`' 0.009 boundaries: positive payments, current-debt limit, supplier source balance checks and distinct source accounts. Customer receipts accept a zero-balance receiving account. Added full-debt selection, total and remaining-debt previews.
- Added supplier-details payment entry, hidden for viewers, settled balances and inactive suppliers. Both list and detail entry paths carry screen-revision guards.
- Read persisted requests before opening a fresh editor. Reopening restores original amounts, sources, note and UUID; retry does not validate against post-payment balances/debt or require another summary read. Fields stay locked while the outcome is uncertain.
- Corrupt or wrong-scope journals block replacement writes. Unavailable storage prevents initial dispatch. Duplicate dialogs/submits, closing while busy, detached reads and stale success refreshes are guarded. Failed account reads expose retry.
- A successful RPC response must contain a payment identity and matching amount before journal removal. Malformed responses retain the request and permit a fresh RPC verification with the same UUID. Completion callbacks are outside payment error handling.
- Supabase function docs/changelog and local web RPC definitions were reviewed; no SQL, Android, authorization policy, SDK or live financial project changes were made. Retaining immutable client requests is not a certification of deployed backend idempotency or cross-device accounting.

Verification: 154 unit tests and seven isolated browser regressions passed, including both payment domains, supplier detail entry, multi-account sources, overpayment/balance limits, zero receiving balance, lost-response reopening, malformed-response recovery, corrupt/unavailable storage, duplicate/busy/stale guards, read retry, viewer protection and mobile width. Syntax/PWA dependencies, preview build and diff whitespace checks passed. Service-worker cache is v39. Supplier receipt attachments/review layout and live Android/web accounting fixtures remain open.

## 2026-10-07: supplier payment review and explicit confirmation stage

- Matched Android's separate supplier-payment confirmation step: supplier identity, debt before payment, amount, remaining debt, account allocation and receipt status. The web also displays each source's remaining balance and the optional note.
- Added a pure immutable review projection in `debt-payment.js` and a separate review view in `supplier-payment-review.js`. Source objects, labels, debt and note are captured without modifying editor/account snapshots.
- Opening review writes no journal and sends no payment. Explicit confirmation alone persists and dispatches the captured payload; duplicate form submits cannot skip review, and duplicate confirmation cannot repeat dispatch.
- Back/Escape returns to the existing editor without losing inputs. Stale confirmations close without submitting. Existing uncertain payments continue using their persisted payload/UUID directly rather than being rebuilt by review.
- Supplier notes are trimmed for new reviewed payments, matching Android. Existing pending journal payloads remain unchanged.
- Reviewed Android's receipt upload/reference linking and local storage setup using the Supabase skill. The `payment-receipts` bucket is private; deployed read/write/link permissions and durable file recovery have not been verified. Receipt upload remains deliberately unimplemented in this stage, not presented as functional.
- No Android, SQL, storage policy, SDK or live financial project changes were made.

Verification: 157 unit tests and eight isolated browser regressions, syntax/PWA dependencies, preview build and diff whitespace checks passed. New browser coverage verifies no dispatch/persistence during review, back/Escape retention, immutable reviewed submission, duplicate confirmation, escaped text, stale contexts and mobile width. Service-worker cache is v40. Supplier receipt upload and live Android/web accounting and visual comparisons remain open.

## 2026-10-07: sale return quantities and immutable recovery stage

- Compared Android `SaleReturnRules`, `SaleRefundRules`, return entry and existing RPC definitions. Removed incorrect integer flooring: sold-minus-returned availability and +/- saturation retain fractional remaining quantities. Payloads now reject missing identities, duplicate items and invalid/non-positive quantities without mutating input lines.
- Added pure item/totals projections, snapshot selection/account validation and current-sale-after-return preview. Malformed item prices, quantities, total or prior-return data fail explicitly.
- Reworked return dialog lifecycle with duplicate-dialog/submit, owner/viewer, busy-close, Escape, detached-read and stale-screen guards. Failed summary reads expose retry; completion callbacks are separate from mutation error handling.
- Persisted requests are restored before loading accounts. Recovery retains original items, refund account, trimmed reason and request UUID, even when current sale status/quantities already reflect the return. Corrupt or wrong-scope journals block replacement writes; unavailable storage prevents initial dispatch.
- New journals record the expected server-rounded refund amount. Initial (`refund_total`) and replay (`total`) RPC responses must confirm return identity and amount before clearing the journal. Malformed replies retain the same UUID for renewed verification; legacy journals remain readable without added metadata.
- Fresh pending/draft/cancelled/returned sales cannot initiate returns. Sale details retain an owner recovery entry when a scoped journal exists, including after the sale becomes fully returned.
- Recovery uses stored refund totals and labels the saved quantities as pending-request quantities; it does not infer current availability or subtract an already committed refund again. Unpaid credit returns need no refund account and preserve Android's debt-reduction behavior.
- Used the Supabase skill to review function documentation/changelog and existing contracts. No SQL, authorization policy, SDK, Android or live project changes were made. Deployed wrapper idempotency and actual stock/account/debt movements still need a live fixture.

Verification: 164 unit tests and nine isolated browser regressions passed, including paid/debt returns, fractional limits, totals, immutable lost-response reopening, both RPC response shapes, malformed responses, storage/corrupt journal failures, duplicate/busy/stale/closed guards, read retry, viewer restrictions, safe text and mobile width. Syntax/PWA dependencies, preview build and diff whitespace checks passed. Service-worker cache is v41. Live cross-device accounting, full visual comparison and receipt attachment remain open.

## 2026-10-07: purchase entry, complete catalogs and safe recovery stage

- Extracted pure purchase contracts, totals, snapshot/journal validation and response checks into `purchase-model.js`, preserving imports through `purchase.js`. Required identities, quantities/costs, unique payment accounts, balances and overpayment are validated before persistence/dispatch; floating-point sum noise is not treated as real overpayment.
- Purchase entry now uses complete project-scoped active product/supplier reads instead of the first page. Failed loads expose retry, and detached/outgoing screens do not render late results.
- Input changes update totals only; structural item/payment edits redraw their own section, so typing no longer recreates inputs or loses focus. New payment rows choose unused accounts.
- Matched Android's extra confirmation when invoice debt exceeds 0.009. Review/cancel/back writes no pending journal; explicit confirmation sends the captured payload. Fully paid invoices dispatch without the debt-confirmation step.
- Restores the original supplier, product quantities/costs, payment sources, note, invoice field and UUID before any catalog or balance read. Pending fields stay locked; retries never validate against balances/credits that may already include the purchase. Optional display metadata retains names, while legacy payload-only journals remain supported.
- Corrupt/wrong-project journals block replacement writes. Unavailable storage prevents dispatch. Duplicate dialogs/submits/confirmation, busy-close, Escape, stale submits and stale completion callbacks are guarded.
- Supplier credit reads use a revision token so an earlier supplier's response cannot replace the selected supplier's credit. Credit-read failures are visible, not a silently assumed zero. Displayed debt is labeled before credits; final applied credit remains server-authoritative.
- RPC responses must identify a purchase and confirm expected server-rounded total and paid amount with plausible nonnegative debt. Credit reductions are permitted. Malformed results retain the same UUID for renewed verification, and callbacks stay outside mutation error handling.
- Reviewed Android purchase entry, `PurchasePaymentRules`, existing `confirm_sharikx2_purchase_v3` and Supabase function documentation/changelog. No SQL, Android, authorization policy, SDK or live financial project changes were made.

Verification: 170 unit tests and ten isolated browser regressions, syntax/PWA dependency checks, preview build and diff whitespace checks passed. Purchase browser coverage includes 40-row catalogs, stable typing, supplier-credit response races/errors, insufficient funds, debt confirmation/back/Escape, immutable lost-response reopening, malformed replies, corrupt/unavailable storage, busy/stale/closed guards, viewer restrictions, safe text and mobile width. Service-worker cache is v42. This closes the local purchase recovery stage, not the entire purchase domain; invoice attachments, unsent draft persistence, full unit/visual parity and live stock/account/credit results remain open.

## 2026-10-07: project currency parity and confirmed settings stage

- Matched all 16 choices, order, Arabic labels and symbols in Android `MainActivity.showCurrencyDialog`, including Lebanese pounds and Android's Iraqi dinar symbol. Shared immutable currency definitions now drive settings and money display instead of separate incomplete lists.
- Currency changes affect display symbols only, never numeric amounts or balances. Safe unknown three-letter codes and older LYD/SYP displays remain readable; unsupported codes cannot be newly selected for saving. Unknown existing values remain visibly selected rather than silently replaced.
- Extracted settings lifecycle into `currency-ui.js`. Owners can save; viewers see a read-only symbol. Captured project identity, duplicate-submit/busy guards and screen revision checks prevent late replies from altering another active project's currency.
- Existing REST saves now validate the requested code and require exactly one matching project identity and currency in the response. Conditional PATCH filters use the captured previous currency to reject an intervening currency change instead of overwriting it. A retained panel advances its expected value only after confirmed success.
- Failed or malformed responses preserve the previous confirmed currency and selected input for retry. Empty/conflicting responses require reloading project data; no unconfirmed result is reported as saved. Completion callbacks remain outside save error handling.
- Used the Supabase skill to review current changelog, authorization guidance and the existing text currency column/REST contract. No Android, SQL, authorization policy, SDK or live project changes were made. Browser tests use synthetic local responses, not deployed permission or cross-device certification.

Verification: 177 unit tests and eleven isolated browser regressions, JavaScript syntax/PWA dependency checks, preview build and diff whitespace checks passed. Currency coverage includes all choices/symbols, unchanged numeric amounts, duplicate saves, failure/malformed retries, confirmed panel restoration, repeated conditional saves, stale project responses, viewer restrictions, unknown values and mobile width. Service-worker cache is v43. Build remains preview-only without public Supabase configuration. Live Android/web currency fixtures, deployed authorization and full visual parity remain open alongside the earlier domain gaps.

## 2026-10-07: Android appearance and local settings stage

- Added an explicit settings entry to the app menu, with Android's appearance card and both accessible light/dark choices. Existing currency settings are also available here, retaining owner-only save controls and viewer read-only display.
- Added immutable palettes matching every RGB token in Android `AppThemePalette`: background, panels, alternate surfaces, text, muted text, green, gold, red, borders, fields, primary/on-primary and profit. Android's default remains dark even when the OS prefers light.
- Removed fixed dark component colors from shared styles. Fields/selects, navigation, badges, skeletons, dialogs, alerts, expense/debt amounts, choices and primary buttons now consume shared tokens. Decorative colored bitmap assets and their Android visual layout are not certified pixel-equivalent.
- Separated preference/controller rules (`theme.js`), the shared startup instance (`theme-bootstrap.js`) and appearance controls (`theme-ui.js`). The head and application imports share one instance. Startup restores only a namespaced device-local preference; no project/session/financial data is stored in this preference.
- Appearance switching updates tokens, native color-scheme and browser theme-color without rebuilding screen DOM. Form values, open dialogs, input identity/focus/selection remain intact. Choice survives logout and page reload when storage is available; invalid preferences fall back to dark.
- Storage getter/read/write failures do not prevent startup or switching. When persistence is unavailable, the interface honestly says the current choice cannot be saved for reopening. Stale or detached settings controls cannot change appearance.
- This is browser-local appearance, not Android SharedPreferences synchronization or a new cloud setting. No Android, SQL, backend authorization, live project data or financial mutation code was changed.

Verification: 185 unit tests and twelve isolated browser regressions passed, alongside JavaScript syntax, PWA dependency checks, preview build and diff whitespace checks. Theme coverage checks exact immutable Android palettes, fallback behavior, owner/viewer settings entry, keyboard access, retained currency selection/form identity, open dialog/input focus and selection, reload/logout persistence, malformed and inaccessible storage including real startup, native color-scheme, field/navigation colors, stale/detached controls and mobile width. Service-worker cache is v44; new modules are in both the preview build and cached shell. Build remains preview-only without public connection configuration. Full Android-device visual comparison, platform status-bar rendering and broader settings protection/subscription flows remain open.

## 2026-10-07: complete cashier catalog and scanner lifecycle stage

- Compared Android `CashierProductLoading` and barcode generation guards. Web sale entry now loads every active project product using the existing validated paginated reader, rather than searching only manually loaded pages. Failure of any page exposes retry and no partial picker or sale form.
- Added `sale-catalog.js` with immutable product snapshots and private identity/barcode Maps. Later-page categories, search and exact trimmed barcodes are available immediately. Duplicate identities/barcodes, inactive/wrong-project rows and invalid stock/pricing fail explicitly.
- Manual and camera barcode entry share one add path. Unknown/out-of-stock barcodes show explicit errors; insufficient repeated additions retain the entered barcode and do not erase the stock warning. Stale screens, pending/busy operations and blocked journals cannot add products.
- All app sale entry paths now carry screen revision guards. Product-editor camera callbacks also require a current attached editor that is not saving.
- Scanner prevents duplicate dialogs and supports manual Enter. Escape, native close, detachment, hidden documents and stale detection contexts release tracks and timers. Media arriving after close is immediately stopped. Detector construction/playback failure stops acquired media while retaining manual fallback; delayed detection cannot invoke an outdated callback.
- Reviewed the Supabase changelog and range documentation through the Supabase skill, retaining project-scoped reads and existing authorization contracts. No schema, policies, Android files, SDK or live data were changed. Complete offset pagination is not a transactionally consistent stock snapshot; confirmation remains backend-authoritative.

Verification: added five catalog unit tests and two isolated browser groups for 45-product paginated reads, failed-page retry, later-page categories/search/barcodes, stock guards, stale/closed loads, manual fallback, duplicate scanner prevention, late media acquisition, Escape/detachment, delayed detection and detector failure cleanup. Scanner browser tests simulate media/detection; physical camera permission/device support remains unverified. Cache v45 includes the catalog module. Pending-sale recovery still requires catalog/summary loading in the existing flow; saved unsent carts, measured-unit steps, discounts and full live/visual cashier parity remain open.

Final stage checks: 190 unit tests and fourteen isolated browser regression groups passed after correcting the scanner fixture's media simulation. Syntax/PWA dependencies, preview build and diff whitespace checks passed. No live project was modified; deployment configuration remains preview-only.

## 2026-10-07: measured sale quantities and step controls stage

- Compared Android `MeasuredSaleRules` and `CashierDraft` quantity creation, editing, increments and decrements. Added pure immutable quantity operations in `sale-quantity.js`, using integer thousandths for repeated arithmetic rather than accumulating floating-point errors.
- Recognizes Android's kilogram/gram/liter/milliliter Arabic and Latin aliases. Measured stock below one starts with the available amount and uses it as the initial step. Non-measured products with less than one unit cannot be initially added, matching Android's one-unit initial addition.
- Sale lines now show units, increment/decrement controls and measured quick selections: quarter/half/one for large measures; 250/500/1000 for grams/milliliters. Presets beyond available stock are disabled. Setting a measured quantity updates its repeated-add step; piece lines retain a one-unit step. Decrement to zero removes the line.
- Direct typing updates totals without reconstructing inputs. Invalid/empty/out-of-stock input has native and inline validation, and an explicitly dispatched form event cannot submit the last valid quantity while the current input is invalid. Quantity helpers round to three decimal places like Android and retain source objects.
- New pending journal cart metadata includes the unit and quantity step. Reopening keeps fields locked and retries the original payload and request UUID, never regenerating quantities from the current stock. Legacy measured rows with a unit but no explicit step derive the step from their saved quantity; older rows without a unit retain legacy piece display.
- Prices, invoice discounts, monetary rounding and the existing RPC contract were deliberately unchanged. This does not close the separate fractional-price/line-total/discount gaps. No Android, database schema, authorization policy or live project changes were made.

Verification: 197 unit tests and fifteen isolated browser groups passed, including measured alias/preset rules, rounding, repeated fractional increments, piece behavior, stock limits, removal, direct editing, invalid programmatic submit, immutable pending recovery, stale controls and mobile width. Syntax/PWA dependencies, preview build and diff whitespace checks passed. Cache v46 and preview build include the new quantity module. Full device visual/live stock parity, saved unsent carts, pending recovery independent of catalog reads, fractional pricing and invoice discounts remain open.

## 2026-10-07: fractional unit pricing and promotional line totals stage

- Compared Android `SalePricingRules` and `CashierDraft` pricing operations with the existing local confirmation SQL. Unit prices now accept four decimal places rather than incorrectly requiring integers. Submitted prices are normalized with decimal HALF_UP rounding without changing inventory prices or input source objects.
- Added pure `sale-pricing.js` decimal arithmetic using BigInt intermediates. Unit prices round at four places; line amounts and Android subtotal round at two places. Promotional line totals derive a four-place unit price (for example, 3 for 10 becomes 3.3333 and a rounded line amount of 10).
- Each sale row includes a promotional line-total input. Quantity/price edits update the line amount, while editing the promotional amount updates the unit price. Inputs stay attached while typing, below-cost warnings remain visible, and invalid/empty fields cannot dispatch a stale valid value. Zero unit prices remain allowed; setting a promotional total requires a positive value.
- Existing pending journals retain captured fractional prices and original payload/request identity across reopening and retry. Promotional amounts are displayed from the persisted price and quantity, never regenerated as a new sale operation.
- Identified a remaining parity boundary: Android rounds the accumulated unrounded line products, whereas local `confirm_sharikx2_sale_v2` sums per-line rounded amounts. The pure model keeps both projections, and the sale displays a labeled server estimate whenever these differ. This is not a deployed-contract verification; neither SQL nor Android was changed. Invoice discounts remain unimplemented until this difference is resolved with live fixtures.

Verification: 203 unit tests and sixteen isolated browser groups passed, including decimal HALF_UP boundaries, promotional division, source immutability, invalid values, fractional payload prices, stable UI synchronization, cost warnings, empty/zero prices, immutable lost-response recovery and explicit rounding differences. Syntax/PWA dependency checks, preview build and diff whitespace checks passed. Cache v47 includes the pricing module. Live confirmation rounding/decimal-column deployment, discounts, unsent drafts, full device visual parity and the earlier recovery gates remain open; no live financial data was modified.

## 2026-10-07: sale recovery independent of reads and verified completion stage

- Reads and validates the pending sale journal before loading products/accounts. Valid pending requests open immediately without either read; corrupt, wrong-project or inconsistent journals block replacement writes without reading current catalogs. Fresh sale entry still requires complete validated reads.
- Added pure `sale-recovery.js`: request UUID, project identity, payment mode/identities, unique ordered product identities, positive quantities and matching cart/payload prices are checked. Restoration clones the captured journal and does not compare pending quantities against current or captured remaining stock, which may already reflect the sale.
- Restored forms show the saved receiving account identity and server-rounded expected request total, including a captured legacy discount. Fields remain locked, initial customer selection cannot replace the persisted customer, and retries retain the original payload/UUID.
- RPC completion now requires a sale identity and a finite total matching the captured request's per-line rounded expected amount. Validation occurs inside the operation's RPC adapter, so malformed successful responses are not cached as completed: retry performs a fresh verification using the same request.
- Any failed dispatched operation retains its journal and locked fields, including HTTP errors. The client no longer silently abandons a request or enables a replacement based only on HTTP status. Resolving a permanently rejected request still requires checking the operation/accounting record; no automatic discard UI was introduced.
- Unavailable storage blocks new dispatch. Journal removal follows verified completion only, and success callbacks execute outside mutation error handling. Duplicate/busy/stale guards remain active; synthetic cart-removal events cannot edit a pending request.
- Reviewed existing local web wrapper receipt replay and underlying sale result shape (`id`, `total`). No Android, SQL, policies, SDK, server endpoint or live financial project was changed. Response matching and immutable client retry do not certify deployed idempotency.

Verification coverage: six new unit tests and one isolated browser group for no-read recovery, malformed response retention/fresh retry, payload/cart mismatches, falsy/corrupt journals, duplicate/busy guards, unavailable storage and stale completion. Cache v48 and preview build include the recovery module. Unsent cart persistence, discounts, deployed rounding/idempotency and live/visual Android parity remain open.

Final stage verification: 209 unit tests and seventeen isolated browser regression groups passed, alongside JavaScript syntax/PWA dependency checks, preview build and diff whitespace checks. Public deployment configuration remains unset; all financial test responses were synthetic and no live project was modified.

## 2026-10-07: multiple unsent sale carts and safe lifecycle stage

- Compared Android `PendingSaleDraftRules`, `PendingSalesView` and save-on-back/new/list actions. Added a separate versioned project-scoped unsent draft collection, keeping draft rules in `sale-drafts.js` and list presentation/deletion confirmation in `sale-drafts-ui.js`.
- Owners can save the current cart, start another cart, list/resume drafts or confirm deletion. Saving an existing identity updates its original position rather than duplicating it. Back/Escape saves a nonempty valid unsent cart; saving/new/list actions send no financial RPC and do not change stock.
- Drafts retain fractional prices, measured units/steps, customer/payment choices and independent cart snapshots. Resume keeps chosen prices and refreshes available stock/cost from the current catalog. Missing or insufficient products remain visible with a warning and cannot be confirmed at the saved quantity; they are never silently omitted.
- Draft storage uses the existing tab's session storage, not cloud synchronization or Android SharedPreferences. Drafts survive same-tab page reload but are not guaranteed after closing the tab/browser. The interface states this limitation. This is not encrypted offline storage or unrestricted offline sale confirmation.
- The immutable dispatched-sale journal takes priority over draft controls. Draft identity travels with new journals, editable/list controls disappear after dispatch, and the matching draft is removed only after a verified completion. Network/malformed response failures keep both the original draft and dispatched request; reopening never turns the dispatched request into a new editable operation.
- Corrupt lists block overwrites; missing/blocked storage exposes an error instead of claiming a save. Failed save-on-back keeps the editor open and offers explicit two-step closure without saving changes. Draft deletion also requires confirmation. Deleting the active saved draft resets the editor so closing does not recreate it. Stale controls cannot save/start/resume/delete.
- Legacy dispatched journals without a draft identity need no unsent-list cleanup. Completion callbacks remain separate from mutation errors; failure to clean local draft storage retains the verified dispatched journal for safe cleanup retry rather than allowing a replacement write.
- No Android, SQL, authorization policy, SDK or live financial project changes were made. Local drafts do not reserve stock and server confirmation remains authoritative.

Verification coverage: eight new draft unit tests and one isolated browser group for repeated save/new/back, multiple carts, session reload, selected price retention, current-stock guarding, unchanged pending retry, matching-draft completion cleanup, confirmed active deletion, stale controls, corrupt/unsupported storage and mobile width. Build/cache v49 includes both draft modules. Durable device-wide storage, secure offline snapshots, invoice discounts, deployed accounting/idempotency and complete visual parity remain open.

Final stage verification: 217 unit tests and eighteen isolated browser groups, JavaScript syntax/PWA dependency checks, preview build and diff whitespace checks passed. Connection configuration remains preview-only; all financial responses were synthetic and no live project was modified.

## 2026-10-08: partner-share rebalance and verified editor lifecycle stage

- Compared Android `rebalancePartnerShares`, `PartnerShareRounding`, `FinancialNumberRules.tenthPercent`, `activePartners` and computed `reinvestmentShare`. Editing a partner share now proportionally redistributes the remaining active-partner allocation rather than changing only one row. Zero-weight other partners receive equal shares; stable largest-remainder rounding preserves the target total in tenths. A sole partner cannot silently move allocation to the project.
- Added pure `partner-shares.js` rules with identity/share validation, immutable partner projections and exact revision/result checks. Names change only on the selected partner; capital, inactive records and all unrelated state fields remain intact. The target partner total follows Android's rounding of the project remainder first, including older non-tenth shares.
- Corrected partner display: inactive entries are excluded from current totals, retention is computed from active shares instead of a stale `reinvestmentShare` field, and a missing retention cap uses Android's 1000 default. The retention panel stays visible when switching current/former tabs.
- Extracted the partners page from app bootstrap into `partners-ui.js`, with delegated edit actions, safe text rendering, owner/viewer restrictions, tab state attributes, read retry, malformed read checks and screen context guards.
- Reworked the name/share editor: explicit owner/project validation, captured source snapshot and revision, allocation preview without writes, duplicate editor/submit guards, busy-close/Escape protection and locked captured changes after dispatch. Save replies must confirm exactly the next revision.
- After a failed or malformed dispatched save, the verification action reads finance state only. It confirms the full captured state at exactly the next revision; a concurrent/different state is a conflict, not a second write or overwrite. Completion callbacks remain outside mutation error handling. Closing the uncertain editor does not retain a durable local verification journal; reopening must first load current state.
- Used the Supabase skill to review current function documentation/changelog and existing local save/read contracts. Existing authorization and optimistic revision checks are unchanged. The legacy save RPC can post capital differences if backend capital state is inconsistent; unchanged client capital fields are not certification of deployed accounting consistency. No SQL, policies, Android, SDK or live project changes were made.

Verification coverage: nine new unit tests and one isolated partner browser group for proportional/equal allocation, deterministic tenths, sole-partner rules, immutable source/capital, inactive handling, computed retention, owner/viewer access, preview, duplicate/busy guards, read-only lost-response verification, malformed acknowledgement, revision conflict, read retry, escaped text and stale controls. Former partners now read Android's inactive rows from `partners`, with identity-deduplicated fallback support for legacy `formerPartners` arrays. The older report browser fixture now includes the revision returned by the existing finance-state contract. Cache v50 and preview build include the new modules. Capital editing, partner removal/settlement, withdrawals/contributions, sharing, retention-setting edits and full live/visual parity remain open.

Final stage verification: 226 unit tests and nineteen isolated browser groups, JavaScript syntax/PWA dependencies, preview build and diff whitespace checks passed. Financial save/read responses were synthetic; no live project was modified and connection configuration remains preview-only.

## 2026-10-08: retained-profit settings and shared confirmed-save stage

- Compared Android `applyReinvestmentShare` and the retained-project settings dialog. Owners can now edit the percentage left to the project and its upper cap from the partners page. Viewers have read-only access; no-current-partner projects cannot initiate allocation edits.
- Added pure `retention.js`: the change in total partner allocation is spread equally, not proportionally, across active partners. The last raw share preserves the requested total; existing Android-compatible largest-remainder rounding produces tenths. An adjustment that makes any share lower than the Android tolerance rejects the whole change without partial mutation.
- Added a separate retained-profit editor with current/default values, allocation preview, explicit zero-cap support, negative/blank/nonfinite validation, owner/project/context checks, duplicate editor/submit guards and busy-close/Escape protection. Preview changes no stored state and sends no financial request.
- Extracted active-partner share validation for reuse. Retention edits preserve names, capital, inactive/settled records and unrelated snapshot fields; only partner allocations and `reinvestmentCap` change. Computed project retention remains derived from the active partner total, not a legacy stored percentage.
- Added `finance-state-save.js` and reused it in both retained-profit and partner editors. One revision-scoped captured edit is sent once; malformed or lost replies leave its fields locked. Retry reads the full state at exactly the next revision and never dispatches a replacement. Concurrent callers share the same in-flight attempt. Validation errors before dispatch remain editable, and callbacks remain outside save error handling.
- Used the Supabase skill to review current changelog/function documentation and the existing owner-authorized revision save/read contracts. No Android, SQL, policy, SDK or live data changes were made. The legacy full-state RPC's potential capital-difference posting still needs a live accounting fixture even when client capital is unchanged.

Verification coverage: twelve new pure-model/save-lifecycle tests and one isolated browser group for defaults, equal changes, negative-share rejection, stable tenths, zero cap, immutable source/capital, preview without writes, duplicate/busy guards, read-only lost-response verification, preserved full state, viewer/stale restrictions and mobile width. The previous partner browser group also passes with the shared save helper. Cache v51 and preview build include all three new modules. Durable uncertain-edit journals, capital/settlement/withdrawal workflows and full live/visual parity remain open.

Final stage verification: 238 unit tests and twenty isolated browser groups, JavaScript syntax/PWA dependencies, preview build and diff whitespace checks passed. Connection configuration remains preview-only; no live project was modified and all financial test responses were synthetic.

## 2026-10-08: explicit paid-sale review and immutable confirmation stage

- Compared Android's cashier confirmation and payment-dialog routing. Added a separate final review for fresh paid sales displaying items, measured quantities, fractional prices, receiving account, optional customer and totals. Existing direct debt-sale confirmation and pending-request recovery remain unchanged. This is a final review gate, not certification of complete visual or payment-dialog parity.
- Separated immutable review data in `sale-review.js` from dialog presentation in `sale-review-ui.js`. The captured payload/cart are cloned and deeply frozen; source edits cannot change the reviewed request. Account/customer identity, item order, quantities, stock and prices are validated before review.
- Review displays both Android's aggregate-rounded subtotal and the existing server contract's expected per-line-rounded total, with an explicit explanation when they differ. No discount or backend rounding contract was changed.
- Opening review, returning to edit and Escape dispatch no financial request and create no pending-operation journal. Only explicit confirmation creates the request identity and persists the captured operation before dispatch. Return retains the cart, edited prices and payment selection.
- Duplicate form events cannot open multiple reviews; duplicate confirmation cannot dispatch twice. Parent controls remain locked during review. Stale or detached screens cannot confirm, and child dialogs are cleaned up when the parent is removed. Display text is escaped.
- Uncertain operations still retry the original captured payload/request identity without opening a fresh review. Verified completion and draft cleanup follow the existing recovery contract.
- Used the Supabase skill to review current documentation and the existing confirmation contract. No Android, SQL, policy, SDK or live financial data changes were made; deployed idempotency and accounting consistency remain unverified.

Verification coverage: six new unit tests and one isolated browser group for immutable review data, identity/stock validation, rounding differences, review without writes/journaling, Back/Escape retention, duplicate review/confirmation, safe text, captured payment/quantities, original recovery and stale/detached cleanup. Existing paid-sale browser fixtures now explicitly confirm the review; the direct debt path also passes unchanged. Cache v52 and the preview build include both modules. Durable journals, invoice discounts, complete payment/customer UI parity and full live/visual Android comparison remain open.

Final stage verification: 244 unit tests and twenty-one isolated browser regression groups, JavaScript syntax/PWA dependency checks, preview build and diff whitespace checks passed. Connection configuration remains preview-only; all financial test responses were synthetic and no live project was modified.

## 2026-10-08: complete cashier customer catalog and recoverable customer creation stage

- Compared Android `CashierCustomerRules`, `CashierPaymentFormRules` and nested customer creation in `CashierPaymentView`. Customer creation now requires a trimmed name of at least two characters and an exact ten-digit phone, preserving leading zeroes. Typed optional paid-customer fields and Android's formatted-phone normalization are not ported by this stage.
- Added separate `customer-catalog.js`, `customer-contract.js` and `sale-customers.js` modules for indexed immutable data, validation/persistence contracts and cashier selection UI. Customer records are indexed with a Map; search covers names and phone numbers across all loaded pages.
- The load action reads all active customer pages before exposing the new catalog. A failed/repeated/malformed page exposes an error and no partial result; retry starts at offset zero. Filtering retains the selected customer's option even when it does not match, and text is rendered safely without injecting markup. Initial debt-customer and saved-cart choices remain intact.
- Reworked owner customer creation with duplicate-window/submit guards, native form validation, busy-close/Escape protection and parent cart locking. Returning from creation retains quantities, prices, account and selected customer; successful creation selects the verified new customer. Old or removed screens cannot send new requests or receive completion callbacks.
- A versioned project-scoped customer creation journal captures the UUID and immutable name/phone before dispatch. Failed or malformed replies retain the original request across dialog closure and same-tab reload; retry reuses that identity. Corrupt, foreign or incompatible journals block replacement. Missing storage prevents dispatch. This is per-tab session storage, not encrypted, durable device-wide or cloud-synchronized storage.
- POST acknowledgements must return exactly the captured customer/project/name/phone with zero opening debt and no inactive flag. A 409 lookup is scoped to the original project and UUID, not merely a matching phone. Empty/wrong/multiple acknowledgements are not success. Journal cleanup follows verified completion and never removes a newer or corrupt request. Permanently conflicting requests need explicit reconciliation; no automatic discard/replacement was introduced.
- Used the Supabase skill to review current changelog and Data API authorization documentation. The existing owner-authorized REST endpoint and RLS remain authoritative. No Android, SQL, policy, SDK or live project data changes were made; all creation and financial replies in tests were synthetic.

Verification coverage: thirteen new unit tests and one isolated browser group for full 45-customer pagination/search, failure/retry without partial options, identity validation, immutable scoped POST/409 contracts, journal validation/cleanup, preserved cart/selection, duplicate/busy/viewer/stale guards, malformed/lost-response reopen recovery, corrupt/missing storage and detached-parent cleanup. Cache v53 and preview build include all three modules. Full paid-customer payment-dialog UI parity, deployed creation conflicts/RLS, device-wide recovery and complete visual/accounting comparison remain open.

Final stage verification: 257 unit tests and twenty-two isolated browser regression groups, JavaScript syntax/PWA dependency checks, preview build and diff whitespace checks passed. Connection configuration remains preview-only; no live project was modified. Upload destination remains to be clarified because the linked GitHub repository also has Render auto-deploy configuration; no commit, push or production deployment was performed in this stage.
