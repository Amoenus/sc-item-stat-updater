# DataCore Provider — Agent Handover

**Purpose:** This document transfers implementation context to a fresh agent session. Read it fully before touching any code.

---

## 1. Goal

Build a **DataCore scraper** that reads item equipment stats (shields, quantum drives, coolers, power plants, etc.) from Star Citizen game files, and writes CSV files that the existing `update-all.ts` pipeline can consume — exactly as `scrape-spviewer.ts` does for SPViewer.

Output CSVs land in `csv/datacore/<version>-live/<type>.datacore.csv`. The existing `bin/update-all.ts --provider datacore` flag picks them up.

---

## 2. Critical Unresolved Problem: Where Is The Data?

**This is the core blocker.** Multiple sessions have failed because the assumed data source was wrong.

### What was tried and failed

**Attempt 1:** Extract item XMLs from `Data.p4k` using `unp4k.exe` with path filters like `scitemvehicle_shield_generator`.
- **Result:** Zero rows. Data.p4k only contains geometry (`.cga`), audio (`.bnk`), and textures for these paths — no entity stat XMLs.

**Attempt 2:** Extract `Game2.dcb` (the DataForge binary database, 291 MB at `LIVE/Data/Game2.dcb`) using `unforge.cli.exe`, then search for equipment XMLs.
- **Result:** `unforge` produced 51,295 XML files in `$env:TEMP\sc-uf-work`. However, **none of them contain shield generator stats, quantum drive stats, cooler stats, etc.** Searching for known entity class names (`shield_behr_*`, `qntm_*`, `cooler_*`) and known field names (`SShieldGeneratorComponentParams`, `MaxShieldHealth`, `ShieldCapacity`) all returned zero matches.
- The `Game2.dcb` contains DataForge records for: AI, audio, communication, hauling definitions, ammo params, mining, contracts, and many UI/game-mode records — but **not equipment entity class definitions**.

### What this means

The actual equipment entity class definitions — the records that contain shield HP, regen rate, quantum drive speed, cooler rate, etc. — are **not in `Game2.dcb`**. The new agent needs to discover where they actually are.

### Leads to investigate

1. **CryXML entity files in Data.p4k:** The equipment entity definitions may actually be `.xml` CryXML files inside `Data.p4k`. The p4k filter approach (Attempt 1) was tested with the wrong path patterns. The correct path might be something like `data/scitemvehicle/shield_generator/shield_behr_s01.xml`. Use `unp4k.exe Data.p4k <filter>` and verify with a broader filter.

2. **SC community data sources:** The [Star Citizen data repository](https://github.com/StarCitizenTools/star-citizen-data) or [sc-data](https://github.com/StarCitizenTools/sc-data) may have already-extracted entity XMLs showing the correct paths and XML structure. Check what path conventions they use.

3. **StarCitizen Wiki / Erkul.games / sc-trade.tools:** These sites parse entity stats live. Their open-source parsers would reveal exact file paths and XML field names.

4. **Multiple DCB files:** There may be more than one `.dcb` file (e.g., a separate `items.dcb` or `entities.dcb`). Check `LIVE/Data/` for all `.dcb` files.

5. **Game2.dcb reference resolution:** The `haulingentityclass_shieldgenerator_s01.xml` from Game2.dcb contains only `<Reference value="UUID">` entries pointing to other records by GUID. The actual shield entity class records may be in a separate database that holds the referenced records. The monolithic `Game2.xml` (which unforge also creates) may contain the full resolved records — worth examining its top-level structure for `EntityClassDefinition` entries.

---

## 3. What Has Been Implemented

All code is in place; only the data-source discovery and `recordFilter` values need fixing.

### New files created

| File | Purpose |
|---|---|
| `bin/scrape-datacore.ts` | Main scraper entry point |
| `src/extractor/datacore-xml-parser.ts` | XML parsing helpers (cheerio xmlMode) |
| `src/items/datacore/types.ts` | `DataCoreItemTypeConfig` interface + `makeGetTargetKeys` factory |
| `src/items/datacore/shields.ts` | Shield type config + ItemConfig |
| `src/items/datacore/coolers.ts` | (+ 20 more type files, one per item category) |
| `src/schema/datacore.schemas.ts` | Zod schemas for DataCore CSV rows |

### Modified files

| File | Change |
|---|---|
| `src/items/registry.ts` | Added `loadDatacoreConfigs()`, `datacoreDir` |
| `src/io/local/unp4k-tool.ts` | Shared tool mgmt for unp4k/unforge (download, find, run) |
| `src/io/local/path-conventions.ts` | Added `resolveDatacoreCsvPath()` |
| `bin/update-all.ts` | Added `--provider spviewer\|datacore` flag |
| `package.json` | Added `scrape:datacore` npm script |
| `.gitignore` | Added `csv/datacore/.xmlcache/` |

### All 22 DataCore type config files

Located in `src/items/datacore/`. Each exports:
- `DATACORE_TYPE_CONFIG: DataCoreItemTypeConfig` — for the scraper
- `default: ItemConfig` — for the updater pipeline

Types covered: `shields`, `coolers`, `powerplants`, `quantum-drives`, `jump-drives`, `radars`, `missiles`, `missile-launchers`, `weapon-guns`, `weapon-personal`, `weapon-defensive`, `weapon-attachments`, `turrets`, `mining-lasers`, `mining-modifiers`, `salvage-modifiers`, `tractor-beams`, `bombs`, `emps`, `throwables`, `self-destruct`, `qeds`

---

## 4. How the Scraper Is Designed to Work

`bin/scrape-datacore.ts` implements this flow:

```
1. Find *.dcb file in LIVE/Data/
2. Ensure unforge.cli.exe is installed (downloads unp4k suite from GitHub)
3. Check version-specific XML cache: csv/datacore/.xmlcache/<version>-live/
4. If cache is empty (or --force-extract):
     a. Copy Game2.dcb to cache dir
     b. Run: unforge.cli.exe <cacheDir>   ← directory mode
     c. Delete the .dcb copy and monolithic Game2.xml from cacheDir
     d. Remaining files are individual entity record XMLs
5. For each type: filter cached XMLs where path contains typeConfig.recordFilter
6. Parse matching XMLs with cheerio (xmlMode), extract stats via CSS selectors
7. Write CSV to csv/datacore/<version>-live/<type>.datacore.csv
```

---

## 5. What the `DataCoreItemTypeConfig` Interface Expects

```typescript
interface DataCoreItemTypeConfig {
  recordFilter: string;       // substring matched against unforged XML file path
  entityClassPrefix: string;  // prefix stripped from entity class name for INI key
  nameKeyInfix: string;       // INI key infix (e.g. 'SHLD_' → item_NameSHLD_...)
  fieldSelectors: Record<string, string>; // CSS selectors for type-specific fields
}
```

Example from `shields.ts` (all selectors are **unverified guesses**):
```typescript
{
  recordFilter: 'scitemvehicle_shield_generator',  // ← WRONG, needs real path
  entityClassPrefix: 'shield_',
  nameKeyInfix: 'SHLD_',
  fieldSelectors: {
    'HP Pool': 'SShieldGeneratorComponentParams ShieldGeneratorParams MaxShieldHealth',
    'Regen Rate': 'SShieldGeneratorComponentParams ShieldGeneratorParams MaxShieldRegen',
    // ... etc
  }
}
```

Both `recordFilter` values AND `fieldSelectors` CSS paths are guesses that need to be replaced once the real data source and XML structure are known.

---

## 6. The unp4k Tool Suite

- **Source:** https://github.com/dolkensp/unp4k/releases
- **Download:** `unp4k-suite-win-x64-<tag>.zip` (the suite, not the single-tool zip)
- **Binaries inside zip:** `publish/unp4k.exe`, `publish/unforge.cli.exe`, `publish/unp4k.fs.exe`
- **Install path:** `LIVE/unp4k/` (managed by `src/io/local/unp4k-tool.ts`)

### Key behaviors

```
unp4k.exe <Data.p4k> <pathFilter>
  → Extracts matching files from the archive to CWD, preserving internal paths
  → pathFilter is a substring match against internal archive paths

unforge.cli.exe <directory>
  → Converts all CryXML and .dcb files found recursively
  → .dcb files produce: <name>.xml (monolithic) + individual records at component paths
  → CryXML files are converted in-place

unforge.cli.exe <file.dcb>
  → Converts just that one file → writes <file>.xml beside it
  → For DCB: also extracts individual records (same as directory mode for that file)
```

`src/io/local/unp4k-tool.ts` exports: `ensureToolsInstalled()`, `readGameVersion()`, `resolveLiveDir()`, `runTool()`, `findFile()`

### `readGameVersion()`

Reads `LIVE/build_manifest.id` (JSON), extracts `Branch` (e.g. `sc-alpha-4.8.0-hotfix`) via regex `(\d+\.\d+\.\d+)` + `RequestedP4ChangeNum`, returns e.g. `4.8.0.11875683`.

### `resolveLiveDir(binDirname)`

Uses `SC_LIVE_DIR` env var if set. Otherwise walks 4 levels up from `bin/` looking for `Data.p4k`. Set `SC_LIVE_DIR` in `.env.local` for local dev.

---

## 7. Existing Provider Architecture (SPViewer) for Reference

The SPViewer provider already works end-to-end. Use it as the reference:

```
bin/scrape-spviewer.ts    → scrapes HTML from spviewer.com, writes csv/spviewer/<version>/
bin/update-all.ts         → reads CSVs, updates global.ini
src/items/spviewer/       → type configs (ItemConfig + spviewer mappings)
src/extractor/spviewer-html-parser.ts → HTML parsing
```

The DataCore provider should mirror this pattern. The updater pipeline (`update-all.ts`) is already wired up; only the scraper + correct data source is missing.

---

## 8. Recommended Next Steps for the New Agent

1. **Discover where equipment entity definitions actually live.** The most reliable approach:
   - Run `unp4k.exe LIVE/Data.p4k "shield_generator"` and examine what files come out (look at extensions and content, not just names)
   - Check if `Data.p4k` contains paths like `data/libs/foundry/records/entities/scitemvehicle/shield_generator/` or similar
   - Alternatively, look at the monolithic `Game2.xml` — run `unforge.cli.exe LIVE/Data/Game2.dcb` (single-file mode), then search the resulting `Game2.xml` for known entity class names like `shield_behr_s01`

2. **Examine one real entity XML** to understand the actual XML structure and field names. The `fieldSelectors` in all 22 type configs need to be rewritten based on real structure.

3. **Update all 22 `recordFilter` values** in `src/items/datacore/*.ts` once the real paths are known.

4. **Update `fieldSelectors`** in all 22 type configs with real CSS selectors matching actual XML element/attribute names.

5. **Potentially redesign the scraper** if the data source turns out to be Data.p4k CryXML files (reintroduce `unp4k.exe` extraction step) rather than Game2.dcb individual records.

---

## 9. Environment Setup

```bash
# Required .env.local (create at repo root)
SC_LIVE_DIR=C:\games\Roberts Space Industries\StarCitizen\LIVE

# Run the scraper
npm run scrape:datacore

# Run the updater with DataCore CSVs
npx tsx bin/update-all.ts --provider datacore
```

Game version detected automatically from `LIVE/build_manifest.id`.

---

## 10. Key Paths Summary

```
LIVE/Data/Game2.dcb              ← DataForge database (291 MB)
LIVE/Data/Data.p4k               ← Main game archive
LIVE/unp4k/                      ← Tool install dir (managed automatically)

csv/datacore/.xmlcache/<ver>/    ← Extracted XML cache (gitignored)
csv/datacore/<ver>-live/         ← Final CSVs (committed)

src/items/datacore/              ← 22 type config files
src/extractor/datacore-xml-parser.ts
src/io/local/unp4k-tool.ts
bin/scrape-datacore.ts
```
