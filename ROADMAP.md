# Roadmap

Tracks missing features and known gaps. Solo project on `main` for now — check items off in the same commit that fixes them.

## Basic features

- [x] Edit / delete an account (rename, move the starting-balance anchor, delete with cascading recurring items)
- [x] Confirm before deleting a recurring item
- [x] Balance reconciliation history — "Balance corrections" panel records multiple "as of <date>, balance is $X" checkpoints over time, layered additively on top of the starting balance; the projection snaps to the most recent checkpoint at-or-before each day.
- [x] Combined / net-worth view across multiple accounts ("All accounts" tab, sums each account's own projection; excludes accounts without a starting balance set)
- [x] Sort / search recurring items (search by name, sort by name/amount/frequency)

## Cleanup

- [x] Remove or repurpose the hamburger menu (top-left, "New…/Open…/Save/Save as…/Print…") — leftover template scaffolding, not wired to anything
- [ ] Review the French copy in `src/i18n/fr/translation.json`. Most of it was written by Claude and wants a native Québécois eye, particularly the financial phrasing added during the redesign: `ShortByOn` ("Découvert de…"), `SinkingFundCatchUp` ("pour rattraper"), `SinkingFundOngoing` ("en continu"), `SinkingFund` ("Fonds de prévoyance"), `SuggestedMonthlySetAside` ("Mise de côté mensuelle suggérée"), `DoesNotRecover`, and the forecast-accuracy wording added since: `ForecastRunsHighPerMonth` ("trop optimiste"), `ForecastRunsLowPerMonth` ("trop prudente"), `ForecastRanHigh`/`ForecastRanLow` ("projection trop haute/basse") and `ForecastExact`. Nothing is broken — the keys resolve and fit their containers — it's the register and terminology that need confirming.

## Migration

- [ ] Enter the real accounts and recurring items. The October 2024 spreadsheet was mapped onto the app's model and seeded into a demo database to check the fit — it reproduced the $359.94/month property-tax set-aside exactly, so the model is faithful. Mapping rules worth reusing when entering the real thing:
  - Two lines with the **same amount on two days of the month** (groceries on the 5th and 23rd, cleaning on the 5th and 25th) are **one semi-monthly item**, not two monthly ones. Two lines with *different* amounts on two days genuinely are two items.
  - Property tax is **four yearly items, not two** — municipal in March and June, school in July and October — each flagged as a sinking fund. Amortized, they total the same monthly figure the spreadsheet used.
  - Zero-valued spreadsheet rows are skipped rather than entered as 0.00.
  - **Which account each item belongs to.** Pay lands in the chequing account, which covers personal spending and sends a monthly transfer to the joint account. Everything to do with the properties — mortgage, condo fees and all four tax installments — leaves the **joint** account, funded by that transfer plus the partner's Interac. The spreadsheet's "separate pot" for taxes was the joint account, not a savings bucket, so the tax items belong there and not on chequing.
  - Not in the 2024 file at all, so they need entering from scratch: the **joint account**, and the school + city taxes for the **parking space** and the **cabin** (only the condo's are in the spreadsheet). Condo fees in the file are the lumped condo + parking figure and may want splitting.
  - Every amount in the file is from 2024. Current balances are quickest read straight off RBC's accounts page; there is no exportable list of pre-authorized debits, so cadences come from the spreadsheet and amounts from a statement.

## From the original spreadsheet

- [x] Property-tax sinking-fund tracker — recurring items can be flagged "sinking fund". The app amortizes each one over its own recurrence period (a yearly bill ÷ 12, quarterly ÷ 3) to give a stable monthly cost, and the hero shows that alongside a catch-up figure — what it would take starting today, given nothing has been set aside yet. The gap between the two is the "you're behind" signal. Purely informational: the projection still debits the full lump sum on its actual due date.

## Dropped

- Subscription/recurring-charge verification checklist — in the original spreadsheet this was a list of which websites had a credit card on file, to make card-expiry renewals easier. Not a cash-flow concern, and out of scope for this app now that credit card balances are just paid off a few times a month via recurring items.
