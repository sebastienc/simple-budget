# Roadmap

Tracks missing features and known gaps. Solo project on `main` for now — check items off in the same commit that fixes them.

## Basic features

- [x] Edit / delete an account (rename, move the starting-balance anchor, delete with cascading recurring items)
- [x] Confirm before deleting a recurring item
- [x] Balance reconciliation history — "Balance corrections" panel records multiple "as of <date>, balance is $X" checkpoints over time, layered additively on top of the starting balance; the projection snaps to the most recent checkpoint at-or-before each day.
- [x] Combined / net-worth view across multiple accounts ("All accounts" tab, sums each account's own projection; excludes accounts without a starting balance set)
- [x] Sort / search recurring items (search by name, sort by name/amount/frequency)

## Backups

- [x] Automatic snapshots into a cloud-synced folder — point the app at a folder Google Drive (or Dropbox, or iCloud) already syncs and it writes a `sqlite.backup()` snapshot there on quit and once a day, keeping the last N *per machine*. Detects the mounted cloud folders on the Mac so nobody has to type `~/Library/CloudStorage/GoogleDrive-…/My Drive` from memory, since the app deliberately has no native folder picker. Never the live database: in WAL mode that's three files that must agree, and letting a sync client copy them out from under SQLite is how synced databases get corrupted.
- [x] Restore from a listed snapshot — the deliberate hand-off between two machines. The app never merges; restoring is always "this snapshot wins", and it takes a safety copy of the current database first, on the same reasoning as the wipe.
- [ ] Upload snapshots through the Google Drive API instead of relying on Drive for Desktop. Worth doing if the folder approach proves fragile — it would let the app *confirm* an upload happened rather than hope the sync client got to it, and drop the requirement that Drive be installed and running. Notes for whoever picks it up: use the `drive.file` scope (access limited to files the app itself created, and non-sensitive, so no OAuth verification review); the loopback redirect fits the existing local server, `http://127.0.0.1:5680/api/google/callback`; store the refresh token with Electron `safeStorage`, which is fine since it only ever lives in main. Two traps — the OAuth client secret would sit in a public repo (Google treats Desktop-client secrets as non-secret under PKCE, but it still wants a decision), and **refresh tokens expire after 7 days while the consent screen is in "testing"**, so it has to be published to production or the user re-authorizes every week.

## Cleanup

- [x] Remove or repurpose the hamburger menu (top-left, "New…/Open…/Save/Save as…/Print…") — leftover template scaffolding, not wired to anything
- [ ] Confirm before losing an open form on account switch — `RecurringItemsPanel`'s add/edit `mode` and `BalanceCheckpointsPanel`'s `isAdding` are local state that doesn't reset when the `accountId` prop changes, so switching accounts mid-edit leaves the form open: editing an existing item goes stale (the id usually doesn't exist in the new account, so the form silently disappears with no save), and the "add" form stays open and, if submitted, creates the item against whichever account is now selected — not the one the form was opened for. Wants a `window.confirm()`-style discard prompt (matching how destructive actions already confirm elsewhere) before the switch proceeds, gated on the form actually having unsaved input; a same-issue check is worth doing wherever else account-scoped local state doesn't key off `accountId` (e.g. `Home.tsx`'s `isEditingAccount`).
- [ ] Review the French copy in `src/i18n/fr/translation.json`. Most of it was written by Claude and wants a native Québécois eye, particularly the financial phrasing added during the redesign: `ShortByOn` ("Découvert de…"), `SinkingFundCatchUp` ("pour rattraper"), `SinkingFundOngoing` ("en continu"), `SinkingFund` ("Fonds de prévoyance"), `SuggestedMonthlySetAside` ("Mise de côté mensuelle suggérée"), `DoesNotRecover`, and the forecast-accuracy wording added since: `ForecastRunsHighPerMonth` ("trop optimiste"), `ForecastRunsLowPerMonth` ("trop prudente"), `ForecastRanHigh`/`ForecastRanLow` ("projection trop haute/basse") and `ForecastExact`. Nothing is broken — the keys resolve and fit their containers — it's the register and terminology that need confirming.

## From the original spreadsheet

- [x] Property-tax sinking-fund tracker — recurring items can be flagged "sinking fund". The app amortizes each one over its own recurrence period (a yearly bill ÷ 12, quarterly ÷ 3) to give a stable monthly cost, and the hero shows that alongside a catch-up figure — what it would take starting today, given nothing has been set aside yet. The gap between the two is the "you're behind" signal. Purely informational: the projection still debits the full lump sum on its actual due date.

## From competitor research

Comparing against PocketSmith and similar cash-flow-forecasting apps (see conversation for the fuller list) turned up a few gaps worth closing; most of what they offer beyond this (bank sync as the default, mobile, sharing) cuts against this app's local-only, single-device design and isn't worth chasing.

- [x] What-if scenario modeling — a "What if" panel adds hypothetical recurring items (reusing the real recurring-item form) that are never persisted; the projection they'd produce is overlaid as a dashed line on the real one, so the gap is visible directly rather than switching between two views. Single-account only — not on the combined "All accounts" view.
- [x] Per-account currency — each account has a currency (CAD/USD/EUR/GBP), set at creation and editable afterward (safe, since cents never encoded currency — it's purely a display label). The "All accounts" net-worth view groups by currency rather than converting: one hero/chart/list per currency, never summed together, so no exchange rate is needed.
- [ ] Data entry automation for recurring items — worth exploring, but deliberately avoiding connecting to the user's bank/credit card portal (screen-scraping or Plaid-style aggregators) if at all possible, since that's a large trust and security surface for a local-only app. Needs more thought before scoping; no clear approach yet.

## From real usage

- [ ] Recurring transfers between accounts — moving money from one account to another on a schedule (e.g. an automatic monthly transfer into a savings account), rather than modeling it as an expense on one account with no corresponding income on the other. The projection engine computes each account independently and never looks across accounts, so the clean fit is a transfer creating two linked ordinary recurring items behind the scenes (a debit on the source, a credit on the destination, sharing a group id) — no changes needed to the core recurrence/projection math, just a paired create/edit/delete and a form that takes two accounts instead of one.
- [ ] Shared-expense splitting by income ratio — for expenses split with a partner according to a ratio of incomes, something to show "your share / their share" next to the item so the right amount doesn't need figuring out by hand. Likely shape: a "shared" flag + ratio on a recurring item, mirroring how `sinkingFund` already works today — informational only, the item still debits the account in full as now. A fuller running "who owes whom" ledger is a bigger step, not yet decided if it's worth it.

## Dropped

- Subscription/recurring-charge verification checklist — in the original spreadsheet this was a list of which websites had a credit card on file, to make card-expiry renewals easier. Not a cash-flow concern, and out of scope for this app now that credit card balances are just paid off a few times a month via recurring items.
