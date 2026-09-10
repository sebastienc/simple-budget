# Changelog

## [1.1.0](https://github.com/sebastienc/simple-budget/compare/v1.0.1...v1.1.0) (2026-09-10)


### Features

* add per-account currency ([c5e946c](https://github.com/sebastienc/simple-budget/commit/c5e946c7f9b25caa8d45d755718dbc47a79bf299))
* add what-if scenario modeling ([ef28306](https://github.com/sebastienc/simple-budget/commit/ef28306a68f5b98bfb0860766f67aaeed29c604b))
* build and release Windows and Linux installers ([fa473de](https://github.com/sebastienc/simple-budget/commit/fa473de486bf635095291284e0a78e7168f36aa0))


### Fixes

* detect cloud-sync folders on Windows and Linux ([d7043d1](https://github.com/sebastienc/simple-budget/commit/d7043d140592df575598152de2dc6d79a8b5df75))
* reject cross-origin requests to the local API ([8854435](https://github.com/sebastienc/simple-budget/commit/8854435f9c996ab4ed3d8e4c88a556bd6303fc7b))


### Packaging

* give the installer a filename without spaces ([278c243](https://github.com/sebastienc/simple-budget/commit/278c243abdd61c98c0766edff0c62781798c3415))

## [1.0.1](https://github.com/sebastienc/simple-budget/compare/v1.0.0...v1.0.1) (2026-09-05)


### Fixes

* stop electron-builder publishing the release itself ([9ff2ffc](https://github.com/sebastienc/simple-budget/commit/9ff2ffc9e8584d0b4cfa0e467936360c3a973af5))

## 1.0.0 (2026-09-05)


### Features

* add a throwaway demo database and a seed script ([0a8e593](https://github.com/sebastienc/simple-budget/commit/0a8e59306d3f64aebcf84906557c27e5733c5f5d))
* add account rename, edit starting balance, and delete ([0aaa548](https://github.com/sebastienc/simple-budget/commit/0aaa548ab9e775e9d9428c256b49f5efc49d4c68))
* add an app icon and matching favicon ([43aa1aa](https://github.com/sebastienc/simple-budget/commit/43aa1aa976a7463b0a5dbbfe8b8ab553455c7475))
* add balance reconciliation history (checkpoints) ([7f34063](https://github.com/sebastienc/simple-budget/commit/7f34063ec0f5bfc78ba78747cd7096243c9c9ff9))
* add combined net-worth view across accounts ([6dc9ec5](https://github.com/sebastienc/simple-budget/commit/6dc9ec5f494bba208ea1cbcf59536c6b46b16b88))
* add one-time payment shortcut to recurring item form ([24cc354](https://github.com/sebastienc/simple-budget/commit/24cc354f8f8235e545f403f49621859a3dcc9c9c))
* add range presets to the chart's date control ([af36c4e](https://github.com/sebastienc/simple-budget/commit/af36c4e293f68dea62cc0997126395643cd04143))
* add search and sort to recurring items list ([45ba6d9](https://github.com/sebastienc/simple-budget/commit/45ba6d9a898f3aed263af87bfb1a6b0af60b32e1))
* add semi-monthly pay frequency to recurring items ([2ae4ba2](https://github.com/sebastienc/simple-budget/commit/2ae4ba21ce37f6678d5a80ea3d9fc52554678526))
* add sinking-fund flag to recurring items ([7307afa](https://github.com/sebastienc/simple-budget/commit/7307afa52070644d89b4d7e91cd3a379e576fdc3))
* automatic backups into a cloud-synced folder ([175c641](https://github.com/sebastienc/simple-budget/commit/175c641dfefcd77cbd235bae159ac73b16827b87))
* choose Light, Dark or System instead of a dark-mode switch ([8c6ff6d](https://github.com/sebastienc/simple-budget/commit/8c6ff6dedd40060fd8fc4cafb6c18f12449dcb57))
* confirm before deleting a recurring item ([085252d](https://github.com/sebastienc/simple-budget/commit/085252da892cfce79806892b07a2787130cc4204))
* erase all data, with a backup taken first ([94fcb47](https://github.com/sebastienc/simple-budget/commit/94fcb474af25dd5a2a703355896dda7ea8bf69b3))
* expand a day in "what's coming" to see its parts ([1ebd1cb](https://github.com/sebastienc/simple-budget/commit/1ebd1cb5c153d45b51af266f307f66972ce8d5b4))
* initial electron version ([5c17d63](https://github.com/sebastienc/simple-budget/commit/5c17d63c71017dbbbfec33524ad750ad7010af7f))
* mark balance-correction days in the projection table ([2b72679](https://github.com/sebastienc/simple-budget/commit/2b726795c035597c6e4dee31d9985b8cb19d3d13))
* name a rolled-up day by its largest item ([e557f45](https://github.com/sebastienc/simple-budget/commit/e557f452c69c21e8e4f3c4ed4f3581b958c72c39))
* report how far the forecast drifted at each correction ([0bc398b](https://github.com/sebastienc/simple-budget/commit/0bc398b433060284c2eb93e79b8cb6760e86100e))
* **ui:** convert the remaining screens to the design system ([8d18346](https://github.com/sebastienc/simple-budget/commit/8d1834642c2383a263f263acf1064f075f48a889))
* **ui:** lead with the answer — app shell, hero and balance chart ([5481039](https://github.com/sebastienc/simple-budget/commit/54810399ad52d1cc29de10d7797535319139a738))
* **ui:** set the lower half as a ledger ([a39a802](https://github.com/sebastienc/simple-budget/commit/a39a802c166fd3aade02d7bbab834f2c009b9552))
* **ui:** show sinking funds as ongoing cost vs. catching up ([42bb3e7](https://github.com/sebastienc/simple-budget/commit/42bb3e7f7163e438f1bd642128708f0de1e527e3))


### Fixes

* amortize sinking funds over the full period, and add unit tests ([2781b38](https://github.com/sebastienc/simple-budget/commit/2781b381abb622bb04fc261376ecd37750bf5512))
* one rule per day in "what's coming", not two ([9d3ceb3](https://github.com/sebastienc/simple-budget/commit/9d3ceb3e2bdae77728812a0bcf9ca0593ad5047b))
* show the interval in a recurring item's schedule ([f9a3561](https://github.com/sebastienc/simple-budget/commit/f9a35619cc4bcdefec4e7729e8eb96ef5d6155c2))
* strengthen the app icon for the size it's actually seen at ([3f6c7a4](https://github.com/sebastienc/simple-budget/commit/3f6c7a4b49f638efaa02300a90aaed1eb24a84fb))


### Packaging

* ship only what the packaged app requires at runtime ([42f01de](https://github.com/sebastienc/simple-budget/commit/42f01de300a3f4f596e8f894a472a5d2af4e683e))


### Internal

* keep unlisted commit types out of the changelog ([04f5133](https://github.com/sebastienc/simple-budget/commit/04f513306befed5ec223148a87844a0635c953bc))
* version with release-please, build the DMG on release ([f377928](https://github.com/sebastienc/simple-budget/commit/f377928711194386cc30f10bbffcef6275717c20))
