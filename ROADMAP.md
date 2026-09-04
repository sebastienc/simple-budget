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
- [ ] Review the French copy in `src/i18n/fr/translation.json`. Most of it was written by Claude and wants a native Québécois eye, particularly the financial phrasing added during the redesign: `ShortByOn` ("Découvert de…"), `SinkingFundCatchUp` ("pour rattraper"), `SinkingFundOngoing` ("en continu"), `SinkingFund` ("Fonds de prévoyance"), `SuggestedMonthlySetAside` ("Mise de côté mensuelle suggérée") and `DoesNotRecover`. Nothing is broken — the keys resolve and fit their containers — it's the register and terminology that need confirming.

## From the original spreadsheet

- [x] Property-tax sinking-fund tracker — recurring items can be flagged "sinking fund". The app amortizes each one over its own recurrence period (a yearly bill ÷ 12, quarterly ÷ 3) to give a stable monthly cost, and the hero shows that alongside a catch-up figure — what it would take starting today, given nothing has been set aside yet. The gap between the two is the "you're behind" signal. Purely informational: the projection still debits the full lump sum on its actual due date.

## Dropped

- Subscription/recurring-charge verification checklist — in the original spreadsheet this was a list of which websites had a credit card on file, to make card-expiry renewals easier. Not a cash-flow concern, and out of scope for this app now that credit card balances are just paid off a few times a month via recurring items.
