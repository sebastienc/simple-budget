# Roadmap

Tracks missing features and known gaps. Solo project on `main` for now — check items off in the same commit that fixes them.

## Basic features

- [x] Edit / delete an account (rename, move the starting-balance anchor, delete with cascading recurring items)
- [ ] Confirm before deleting a recurring item (currently instant, no undo)
- [ ] Balance reconciliation history — record multiple "as of <date>, balance is $X" checkpoints over time (not just move the one anchor), so past corrections stay visible/auditable. Needs a new checkpoints table and a revised projection algorithm (pick the most recent checkpoint at-or-before each day); bigger than a CRUD add-on.
- [ ] Combined / net-worth view across multiple accounts (each account projects independently today)
- [ ] Sort / search recurring items (fine at small scale, will matter later)

## Cleanup

- [x] Remove or repurpose the hamburger menu (top-left, "New…/Open…/Save/Save as…/Print…") — leftover template scaffolding, not wired to anything

## Deferred (from the original spreadsheet, lower priority than the above)

- [ ] Subscription/recurring-charge verification checklist
- [ ] One-off project cost tracker (e.g. a renovation)
- [ ] Installment-payment tracker
- [ ] Property-tax sinking-fund tracker
