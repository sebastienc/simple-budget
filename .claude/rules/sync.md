---
paths:
  - "electron/main/sync/**"
  - "test/golden/sync/**"
---

# Sync with the mobile app (shared folder)

The design lives in the mobile repo (`simple-budget-mobile`): ADR-0008 (the model: per-row last-writer-wins by `uuid`, tombstones kept forever) and ADR-0009 (one file per device, `simple-budget-sync-<deviceId>.json`, in a folder a sync client shares). Read them before changing anything here; this repo implements the same protocol and must behave exactly like the mobile app.

- **`electron/main/sync/` is pure**: stamps, the merge, the planner (which files to merge, offer or leave) and the file codec. No database, no files, no clock (callers pass `now`). The database, the folder and the schedule are separate modules built on top.
- **The contract with the mobile app is the three golden files in `test/golden/sync/`** (`sync-merge.json`, `sync-plan.json`, `sync-file.json`). They are written by hand in the mobile repo and copied here by `scripts/sync-golden-from-mobile.sh`, which records the mobile commit in `test/golden/sync/SOURCE`. This is the opposite direction from `test/golden/projection.json`: **never edit them here**, and never copy them by hand. A case that looks wrong is fixed in the mobile repo, in both apps together, and the script re-run.
- **Stamps** are text in the form Java's `Instant.toString()` writes (`2026-11-05T10:00:00Z`, a fraction only when there is one). Compare them as instants (`compareStamps`), never as text.
- **Numbers in a file are safe integers** (cents below 2^53). A file with a bigger one is skipped, not rounded.
- **A file is merged whole or not at all.** Anything wrong with it skips the whole file for this round (see `SkipReason`).
- **Files here run through Node's type stripping or vitest only**: no enums or parameter properties (`erasableSyntaxOnly`).
- **Every row has a `uuid` and an `updated_at`, and deletions are recorded** (migration 007): `deleted_rows(table_name, uuid, deleted_at)` holds a tombstone for every row ever deleted, kept for good and never pruned, with the same names as the mobile app's table. The write rules are in `backend.md`; `updated_at` and `deleted_at` are stamps (`2026-11-05T10:00:00Z`), and a deleted account leaves a tombstone for each item and correction it takes with it, all at one stamp.
