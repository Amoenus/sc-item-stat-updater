# SPViewer Retirement Remaining-Key Triage

Data set checked: DataCore `4.8.0.11875683-live` generated from packed local 4.8.1.11875683 `Data.p4k`, SPViewer `4.8.1.11875683-live`, `global.ini`.

Result: the remaining non-turret SPViewer-only generated-key blockers are resolved. `npm run audit:spviewer-retirement -- --datacore-dir csv/datacore/4.8.0.11875683-live --spviewer-dir csv/spviewer/4.8.1.11875683-live` now returns `Decision: SPViewer can be retired from active provider selection`.

## DataCore Target-Key Gaps Fixed

- Weapon guns: Sharkmouth scatterguns now target their variant-specific description keys, and Vanduul plasma cannons now derive description keys when DataCore repeats the name key in the description-key field.
- Quantum drives: DataCore `_SCItem` quantum-drive rows now also target legacy non-`_SCItem` aliases and QDRV underscore variants.
- Coolers: COOL underscore variants are treated as equivalent, and current Glacier data also targets its legacy `_SCItem` alias.
- Power plants: POWR underscore variants are treated as equivalent, and current FullForce data also targets its legacy `_SCItem` alias.
- Shields: SHLD underscore variants are treated as equivalent.
- Throwables and personal weapons: Scorch plasma grenade and Novian crossbow are present in current packed DataCore after refreshing `Data/Game2.dcb` from `Data.p4k` into the repo-owned DCB cache.

## Non-Blocking SPViewer-Only Keys

These keys remain SPViewer-only by category after refreshing DataCore from packed `Data.p4k`, but no longer block retirement because they are stale, renamed, or legacy-only relative to current DataCore category rows.

- Weapon guns: KRNG FL-33 and legacy Sledge II Cannon keys exist in SPViewer mappings/global.ini; current DataCore rows emit KRON S3 and `item_DescKLWE_MassDriver_S2`.
- Mining lasers/modifiers: legacy Greycat vehicle laser and generic mining gadget keys exist in SPViewer/global.ini, but do not represent active DataCore item-stat gaps.
- Missile launchers: generic Idris rack key exists in SPViewer mappings/global.ini but not current DataCore missile-launcher rows.
- Shields: INK, Obscura S1, and Targa SPViewer/global.ini keys are legacy names; current DataCore rows emit `item_DescSHLD_SECO_S01_INK`, S2 Obscura, and `item_DescSHLD_YORM_S01_Targa`.

Changed generated values remain diagnostic only; DataCore is the active game-file authority.
