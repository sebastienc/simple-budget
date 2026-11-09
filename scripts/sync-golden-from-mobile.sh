#!/usr/bin/env bash
# Copies the mobile app's sync golden files into this repo and records where they came from.
#
#   scripts/sync-golden-from-mobile.sh            # from origin/main of ../simple-budget-mobile (after a fetch)
#   scripts/sync-golden-from-mobile.sh <ref>      # from another ref, e.g. a mobile PR branch while iterating
#
# Unlike test/golden/projection.json (generated here, checked by the mobile app), these three files are the
# other way round: they are written BY HAND in the mobile repo, from ADR-0008 and ADR-0009 there, and both apps
# must pass them exactly. Never edit them here. If a case looks wrong, fix it in the mobile repo and change both
# apps together. They are read with `git show`, not from the working tree, so what lands here is exactly what is
# committed at <ref>. SOURCE records the commit; cite `main` SHAs (a rebase-merge rewrites branch SHAs).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mobile="${SIMPLE_BUDGET_MOBILE:-$here/../simple-budget-mobile}"
ref="${1:-origin/main}"
dest="$here/test/golden/sync"
files=(sync-merge.json sync-plan.json sync-file.json)

[ -d "$mobile/.git" ] || { echo "mobile repo not found at $mobile (set SIMPLE_BUDGET_MOBILE)" >&2; exit 1; }
[ "$ref" != "origin/main" ] || git -C "$mobile" fetch --quiet origin main

sha="$(git -C "$mobile" rev-parse --verify "$ref^{commit}")"
mkdir -p "$dest"
{
  echo "repository: sebastienc/simple-budget-mobile"
  echo "ref: $ref"
  echo "commit: $sha"
  echo "refresh: scripts/sync-golden-from-mobile.sh"
} > "$dest/SOURCE"
for file in "${files[@]}"; do
  git -C "$mobile" show "$ref:app/src/test/resources/golden/$file" > "$dest/$file"
  echo "file: app/src/test/resources/golden/$file" >> "$dest/SOURCE"
  echo "sha256 $file: $(shasum -a 256 "$dest/$file" | cut -d' ' -f1)" >> "$dest/SOURCE"
done

echo "Synced the sync golden files from $ref ($sha)"
