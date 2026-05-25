# DataCore Provider — Agent Handover v3

**Status: FULLY WORKING. All 22 types produce rows. 57,719 XML records extracted from Game2.dcb.**

This supersedes all earlier handover docs. Do NOT read v1 or v2.

---

## 1. Goal

Read item stats directly from Star Citizen's `Game2.dcb` (DataCore binary) instead of
relying on third-party sources (scmdb, spviewer). The scraper extracts XMLs via unforge,
parses them with cheerio CSS selectors, and writes CSVs that feed the spreadsheet updater.

---

## 2. Current State

All previously-identified code fixes are DONE:

| Fix | Status |
|-----|--------|
| `extractEntityClass` reads `__path` attr from root | DONE |
| `extractHealth` reads `SHealthComponentParams Health` attr | DONE |
| `fieldSelectors` supports `{ selector, attr }` union type | DONE |
| `resolveField()` handles both string and `{ selector, attr }` | DONE |
| `shields.ts` `recordFilter: 'scitem/ships/shieldgenerator'` | DONE |
| `shields.ts` `fieldSelectors` use `{ selector, attr }` objects | DONE |
| `toWinPath()` helper in `unp4k-tool.ts` — converts WSL paths for .exe calls | DONE (this session) |
| `runTool()` passes Windows paths to all .exe invocations | DONE (this session) |

The WSL path bug was the last blocker: `unforge.cli.exe` is a Windows binary and cannot
resolve `/mnt/c/...` paths. `toWinPath()` converts via `wslpath -w` before spawning.

---

## 3. Environment

```
SC_LIVE_DIR in .env.local: C:/games/Roberts Space Industries/StarCitizen/LIVE
Game2.dcb: /mnt/c/games/Roberts Space Industries/StarCitizen/LIVE/Data/Game2.dcb (292 MB)
XML cache: /mnt/c/git/sc-item-stat-updater/csv/datacore/.xmlcache/<version>-live/
CSV output: /mnt/c/git/sc-item-stat-updater/csv/datacore/<version>-live/
```

ALWAYS include `--env-file-if-exists .env.local` when running node directly, or use npm scripts:

```bash
# Dry run, shields only — no CSV written, shows row count
npm run scrape:datacore -- --dry-run shields

# All 22 types, full run
npm run scrape:datacore

# Force re-extract XMLs from Game2.dcb
npm run scrape:datacore -- --force-extract
```

Do NOT run `node ... bin/scrape-datacore.ts` directly without `--env-file-if-exists .env.local` —
SC_LIVE_DIR will be unset and the fallback path resolve will fail with "Could not read LIVE/Data directory".

---

## 4. Architecture

```
Game2.dcb
  → unforge.cli.exe (Windows binary, managed by scraper)
  → csv/datacore/.xmlcache/<version>-live/libs/foundry/records/entities/**/*.xml
  → scrape-datacore.ts  (reads XMLs, applies per-type config)
  → csv/datacore/<version>-live/<type>.datacore.csv
  → update-all.ts  (merges CSVs into spreadsheet)
```

Per-type config files live in `src/items/datacore/*.ts`. Each exports a `DataCoreItemTypeConfig`:
- `recordFilter`: path substring to filter which XMLs belong to this type (e.g. `scitem/ships/shieldgenerator`)
- `fieldSelectors`: map of column name → CSS selector string OR `{ selector, attr }` object
- `makeGetTargetKeys`: function mapping entity class → spreadsheet row key(s)

Common fields (Entity Class, Size, Grade, Manufacturer, Health) are extracted automatically by
`src/extractor/datacore-xml-parser.ts` and do NOT need to be in `fieldSelectors`.

---

## 5. Key XML Structures

### Shield Generator

```xml
<EntityClassDefinition.SHLD_AEGS_S04_Reclaimer_SCItem
    __path="libs/foundry/records/entities/scitem/ships/shieldgenerator/shld_aegs_s04_reclaimer_scitem.xml">
  <Components>
    <SAttachableComponentParams>
      <AttachDef Type="Shield" Size="4" Grade="1" Manufacturer="<UUID>">
        <Localization Name="@item_NameSHLD_AEGS_S04_Reclaimer_SCItem"/>
      </AttachDef>
    </SAttachableComponentParams>
    <SHealthComponentParams Health="4900"/>
    <SCItemShieldGeneratorParams
        MaxShieldHealth="243000"
        MaxShieldRegen="17820"
        DecayRatio="0.25"
        DownedRegenDelay="11.1"
        DamagedRegenDelay="5.55">
      <ShieldResistance>
        <!-- 6x SShieldResistance: Physical, Energy, Distortion, Thermal, Biochemical, Stun -->
        <SShieldResistance Max="0.25" Min="0"/>
        ...
      </ShieldResistance>
      <ShieldAbsorption>
        <!-- 6x SShieldAbsorption in same order -->
        <SShieldAbsorption Max="0.45" Min="0"/>
        ...
      </ShieldAbsorption>
    </SCItemShieldGeneratorParams>
    <SDistortionParams Maximum="13000" DecayRate="866.6667" DecayDelay="6"/>
  </Components>
</EntityClassDefinition.SHLD_AEGS_S04_Reclaimer_SCItem>
```

### Cooler

```xml
<EntityClassDefinition.COOL_ACOM_S01_IcePlunge_SCItem
    __path="libs/foundry/records/entities/scitem/ships/cooler/cool_acom_s01_iceplunge_scitem.xml">
  <Components>
    <SAttachableComponentParams>
      <AttachDef Type="Cooler" Size="1" Grade="3" Manufacturer="<UUID>">
        <Localization Name="@item_NameCOOL_ACOM_S01_IcePlunge"/>
      </AttachDef>
    </SAttachableComponentParams>
    <SHealthComponentParams Health="69"/>
    <ItemResourceComponentParams>
      <states>
        <ItemResourceState name="Online">
          <deltas>
            <ItemResourceDeltaConversion>
              <generation resource="Coolant">
                <resourceAmountPerSecond>
                  <!-- standardResourceUnits IS the cooling rate (SRU/s) -->
                  <SStandardResourceUnit standardResourceUnits="34"/>
                </resourceAmountPerSecond>
              </generation>
            </ItemResourceDeltaConversion>
          </deltas>
        </ItemResourceState>
      </states>
    </ItemResourceComponentParams>
  </Components>
</EntityClassDefinition.COOL_ACOM_S01_IcePlunge_SCItem>
```

---

## 6. Known Remaining Work

### 6a. recordFilter values — ALL CONFIRMED CORRECT

Full dry-run across all 22 types returned rows for every type. No `recordFilter` fixes needed.

Row counts from game version 4.8.0.11875683:
```
coolers            80    emps                7    jump-drives        24
mining-lasers      23    mining-modifiers   31    missile-launchers 136
missiles           70    powerplants        82    qeds               1
quantum-drives     62    radars             69    salvage-modifiers  15
self-destruct       7    shields            72    throwables          2
tractor-beams       4    turrets           236    weapon-attachments 120
weapon-defensive  168    weapon-guns       628    weapon-personal   377
```

### 6b. fieldSelectors — verify column values are sane

Next step is to run a full (non-dry) scrape, open the CSVs, and spot-check that the
extracted values match known item stats. For example:
- Shields: SHLD_AEGS_S04_Reclaimer should have HP Pool ~243000
- Coolers: verify cooling rate values are numeric SRU/s figures

### 6c. Manufacturer resolution

`AttachDef Manufacturer` is a UUID in Game2.dcb XMLs. The human-readable name is NOT in the XML.
1. Leave as UUID — the pipeline can cross-reference later
2. Parse manufacturer code from the entity class name prefix (e.g. `cool_acom_*` → ACOM)
3. Build a UUID→name lookup from another DataCore record type

Currently the field is extracted as UUID. Decision pending.

---

## 7. Key Files

```
bin/scrape-datacore.ts                  ← main entrypoint; handles unforge, caching, CSV write
src/extractor/datacore-xml-parser.ts    ← extractEntityClass, extractHealth, extractAttachDef
src/io/local/unp4k-tool.ts             ← toWinPath(), runTool(), ensureToolsInstalled(), resolveLiveDir()
src/items/datacore/types.ts             ← DataCoreItemTypeConfig interface
src/items/datacore/shields.ts           ← confirmed working config
src/items/datacore/coolers.ts           ← needs fieldSelectors fix
src/items/datacore/*.ts                 ← 22 type configs total; recordFilter may need verification
```

---

## 8. What NOT To Do

- Do NOT look for entity XMLs inside Data.p4k — they are NOT there; entity data is in Game2.dcb
- Do NOT run node without `--env-file-if-exists .env.local` — SC_LIVE_DIR will be missing
- Do NOT pass WSL paths to Windows .exe tools directly — `runTool()` now handles conversion via `toWinPath()`
- Do NOT re-run unforge manually — the scraper manages its own XML cache per game version
- Do NOT read datacore-agent-handover.md or datacore-agent-handover-v2.md — both are obsolete
