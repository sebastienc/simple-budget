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

## Deferred (from the original spreadsheet, lower priority than the above)

- [ ] Subscription/recurring-charge verification checklist
- [ ] One-off project cost tracker (e.g. a renovation)
- [ ] Installment-payment tracker
- [x] Property-tax sinking-fund tracker — recurring items can be flagged "sinking fund"; the app computes a suggested monthly set-aside (amount ÷ months between previous/next occurrence) and shows a summed total across flagged items so a lump-sum bill (e.g. school/municipal tax) can be split and pre-funded ahead of its due date. Purely informational — the projection still debits the full lump sum on its actual due date.
