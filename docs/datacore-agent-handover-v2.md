# DataCore Provider — Agent Handover v2

**Status: All data-source questions RESOLVED. Implementation fixes needed.**

This replaces `datacore-agent-handover.md`. Do NOT read the old file — its "Critical
Unresolved Problem" section is now solved. Read this one fully before touching code.

---

## 1. Goal

Fix the DataCore scraper so it produces populated CSV files.
The pipeline, architecture, and all 22 type config files already exist.
Only the wrong guesses in those configs and two parser functions need correcting.

---

## 2. The Data IS In Game2.dcb — Fully Extracted

Previous agents were confused. The facts:

- `unforge.cli.exe` was already run on `Game2.dcb`
- Output is cached at `%TEMP%\sc-uf-work\` (51,295+ XML files)
- Shield generator XMLs CONFIRMED at:
  `%TEMP%\sc-uf-work\libs\foundry\records\entities\scitem\ships\shieldgenerator\`
- Cooler XMLs CONFIRMED at:
  `%TEMP%\sc-uf-work\libs\foundry\records\entities\scitem\ships\cooler\`
- Quantum drive items: likely at `scitem\ships\quantumdrive\` — verify with PowerShell

The scraper's xmlCacheDir is `csv/datacore/.xmlcache/<version>-live/`.
On first run it extracts its own cache from Game2.dcb via unforge. That's fine — it will
produce an equivalent tree. The path patterns below are confirmed from the TEMP cache.

---

## 3. Confirmed XML Structures

### 3a. Shield Generator (shld_aegs_s04_reclaimer_scitem.xml)

```xml
<EntityClassDefinition.SHLD_AEGS_S04_Reclaimer_SCItem
    __path="libs/foundry/records/entities/scitem/ships/shieldgenerator/shld_aegs_s04_reclaimer_scitem.xml">
  <Components>
    <SAttachableComponentParams>
      <AttachDef Type="Shield" SubType="UNDEFINED" Size="4" Grade="1"
                 Manufacturer="6ed772d7-..." ...>
        <Localization Name="@item_NameSHLD_AEGS_S04_Reclaimer_SCItem" .../>
      </AttachDef>
    </SAttachableComponentParams>

    <!-- Health is here, NOT in SDamageableParams -->
    <SHealthComponentParams Health="4900" .../>

    <!-- All shield stats are ATTRIBUTES on this element (not nested children) -->
    <SCItemShieldGeneratorParams
        MaxShieldHealth="243000"
        MaxShieldRegen="17820"
        DecayRatio="0.25"
        DownedRegenDelay="11.1"
        DamagedRegenDelay="5.55"
        ElectricalChargeDamageResistance="0">
      <ShieldResistance>
        <!-- Order: Physical, Energy, Distortion, Thermal, Biochemical, Stun -->
        <SShieldResistance Max="0.25"  Min="0"/>     <!-- Physical -->
        <SShieldResistance Max="-0.23" Min="-0.68"/> <!-- Energy -->
        <SShieldResistance Max="0.95"  Min="0.75"/>  <!-- Distortion -->
        ...
      </ShieldResistance>
      <ShieldAbsorption>
        <SShieldAbsorption Max="0.45" Min="0"/>   <!-- Physical -->
        <SShieldAbsorption Max="1"    Min="1"/>   <!-- Energy -->
        <SShieldAbsorption Max="1"    Min="1"/>   <!-- Distortion -->
        ...
      </ShieldAbsorption>
    </SCItemShieldGeneratorParams>

    <SDistortionParams Maximum="13000" DecayRate="866.6667" DecayDelay="6" .../>
  </Components>
</EntityClassDefinition.SHLD_AEGS_S04_Reclaimer_SCItem>
```

### 3b. Cooler (cool_acom_s01_iceplunge_scitem.xml)

```xml
<EntityClassDefinition.COOL_ACOM_S01_IcePlunge_SCItem
    __path="libs/foundry/records/entities/scitem/ships/cooler/cool_acom_s01_iceplunge_scitem.xml">
  <Components>
    <SAttachableComponentParams>
      <AttachDef Type="Cooler" SubType="UNDEFINED" Size="1" Grade="3"
                 Manufacturer="UUID" ...>
        <Localization Name="@item_NameCOOL_ACOM_S01_IcePlunge" .../>
      </AttachDef>
    </SAttachableComponentParams>

    <SHealthComponentParams Health="69" .../>

    <!-- Cooling rate is NOT a direct component — it's the Coolant generation rate -->
    <ItemResourceComponentParams ...>
      <states>
        <ItemResourceState name="Online">
          <deltas>
            <ItemResourceDeltaConversion ...>
              <generation resource="Coolant">
                <resourceAmountPerSecond>
                  <!-- standardResourceUnits IS the cooling rate (34 SRU/s) -->
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

## 4. Required Code Changes

### Fix 1: extractEntityClass (src/extractor/datacore-xml-parser.ts)

Current code looks for `__id` attribute — that attribute does NOT exist in real XMLs.
The entity class is encoded in the ROOT ELEMENT TAG NAME and in the `__path` attribute.

Best approach: read `__path` from the root, take the filename, strip `_scitem.xml`:

```typescript
export function extractEntityClass($: CheerioDoc): string {
  // Root tag is like EntityClassDefinition.SHLD_AEGS_S04_Reclaimer_SCItem
  // __path is like libs/foundry/records/entities/scitem/ships/shieldgenerator/shld_aegs_s04_reclaimer_scitem.xml
  const root = $(':root').first();
  const pathAttr = root.attr('__path') ?? '';
  if (pathAttr) {
    const basename = pathAttr.split('/').pop() ?? '';
    // Strip _scitem.xml → shld_aegs_s04_reclaimer
    return basename.replace(/_scitem\.xml$/i, '').replace(/\.xml$/i, '');
  }
  // Fallback: parse tag name after the dot
  const tagName = (root[0] as any)?.name ?? '';
  const dot = tagName.indexOf('.');
  return dot !== -1 ? tagName.slice(dot + 1) : tagName;
}
```

### Fix 2: extractHealth (src/extractor/datacore-xml-parser.ts)

Current: `SDamageableParams Health` — WRONG element name.
Correct: `SHealthComponentParams` with `Health` as an attribute.

```typescript
export function extractHealth($: CheerioDoc): string {
  return $('SHealthComponentParams').first().attr('Health') ?? '';
}
```

### Fix 3: extractAttachDef — Manufacturer (src/extractor/datacore-xml-parser.ts)

Manufacturer is stored as a UUID in the `Manufacturer` attribute of `AttachDef`.
The human-readable name is in the `Localization Name` attribute as an INI key
(e.g. `@item_NameCOOL_ACOM_S01_IcePlunge`). We can't resolve UUID→name without a
lookup table. For now extract Manufacturer UUID as-is, or parse it from the
Localization Name (strip prefix/suffix). The SPViewer CSVs already have manufacturer
names — the DataCore CSV can leave this as the UUID and the updater pipeline can
resolve it later, OR extract it from the INI key:

```typescript
// In extractAttachDef, replace manufacturer extraction with:
const locName = def.find('Localization').first().attr('Name') ?? '';
// locName = "@item_NameCOOL_ACOM_S01_IcePlunge"  → parse manufacturer from entity class
// Simpler: leave as UUID for now, add a TODO
const mfr = def.attr('Manufacturer') ?? '';
```

The existing pipeline likely resolves manufacturer from the entity class name prefix
(e.g. `cool_acom_*` → ACOM). Check how `scrape-spviewer.ts` handles manufacturer —
if it's fine to leave UUID, do so. If not, derive from entity class prefix.

### Fix 4: recordFilter values (src/items/datacore/*.ts)

All 22 type configs have wrong `recordFilter` values. Correct path substrings
(based on confirmed real unforge output):

| File | Old recordFilter | Correct recordFilter |
|---|---|---|
| shields.ts | `scitemvehicle_shield_generator` | `scitem/ships/shieldgenerator` |
| coolers.ts | `scitemvehicle_cooler` | `scitem/ships/cooler` |
| quantum-drives.ts | `scitemvehicle_qntmdrive` | `scitem/ships/quantumdrive` (VERIFY) |
| powerplants.ts | (guessed) | `scitem/ships/powerplant` (VERIFY) |
| jump-drives.ts | (guessed) | `scitem/ships/jumpdrive` (VERIFY) |

**Action:** Before updating all 22, run a PowerShell script to list every unique
subdirectory under `%TEMP%\sc-uf-work\libs\foundry\records\entities\scitem\` to get
the real folder names. Use this PS1:

```powershell
$base = "$env:TEMP\sc-uf-work\libs\foundry\records\entities\scitem"
Get-ChildItem $base -Recurse -Directory | Select-Object -ExpandProperty FullName |
  ForEach-Object { $_.Replace($base, '') } | Sort-Object | Get-Unique
```

Then map each folder to the corresponding type config file and update `recordFilter`.

### Fix 5: fieldSelectors for shields (src/items/datacore/shields.ts)

Shield stats are attributes on `SCItemShieldGeneratorParams`, NOT nested elements.
The CSS selectors using descendant syntax won't work for attributes.

The `xmlVal()` helper reads `.attr('value')` or `.text()`. It does NOT read arbitrary
attribute names. Add a helper or use `xmlAttr` for these:

```typescript
// In shields.ts fieldSelectors, change to use attribute extraction.
// Either extend DataCoreItemTypeConfig to support attribute selectors, OR
// override extraction in scrape-datacore.ts for shields specifically, OR
// add a new helper: xmlAttrOf($, 'SCItemShieldGeneratorParams', 'MaxShieldHealth')
```

Recommended: extend `DataCoreItemTypeConfig.fieldSelectors` to support an object
value `{ selector: string, attr: string }` in addition to a plain string:

```typescript
fieldSelectors: {
  'HP Pool':        { selector: 'SCItemShieldGeneratorParams', attr: 'MaxShieldHealth' },
  'Regen Rate':     { selector: 'SCItemShieldGeneratorParams', attr: 'MaxShieldRegen' },
  'Damaged Delay':  { selector: 'SCItemShieldGeneratorParams', attr: 'DamagedRegenDelay' },
  'Downed Delay':   { selector: 'SCItemShieldGeneratorParams', attr: 'DownedRegenDelay' },
}
```

And update `scrape-datacore.ts` where it calls `xmlVal($, selector)` to check if
`selector` is a string or `{ selector, attr }` and call `xmlAttr` accordingly.

### Fix 6: fieldSelectors for coolers (src/items/datacore/coolers.ts)

Cooling rate is `SStandardResourceUnit standardResourceUnits` inside the Coolant
generation block. Use a descendant selector with attr:

```typescript
fieldSelectors: {
  'Cooling Rate': {
    selector: 'ItemResourceComponentParams ItemResourceState ItemResourceDeltaConversion generation[resource="Coolant"] SStandardResourceUnit',
    attr: 'standardResourceUnits',
  },
}
```

---

## 5. Recommended Implementation Order

1. Run the PS1 from Fix 4 to get ALL real folder names → update all 22 `recordFilter` values
2. Fix `extractEntityClass` and `extractHealth` in `datacore-xml-parser.ts`
3. Extend `DataCoreItemTypeConfig.fieldSelectors` to support `{ selector, attr }` union
4. Update `scrape-datacore.ts` to handle the new selector type
5. Fix `fieldSelectors` in shields.ts and coolers.ts with real attribute names
6. Run `npm run scrape:datacore -- --dry-run shields` and verify rows > 0
7. Check output CSV has sane values (HP Pool ~243000 for the Reclaimer shield etc.)
8. Fix remaining type configs once you can confirm the pattern works

---

## 6. Environment & Run Commands

```
SC_LIVE_DIR in .env.local: C:\Games\Roberts Space Industries\StarCitizen\LIVE

# Dry run, shields only — should show rows parsed
npm run scrape:datacore -- --dry-run shields

# Full run
npm run scrape:datacore

# If you need to recheck the XML cache structure, inspect:
%TEMP%\sc-uf-work\libs\foundry\records\entities\scitem\
```

PowerShell scripts must be placed in `C:\Temp\` — WSL `/tmp/` paths cause exit 124.
Run via: `powershell.exe -ExecutionPolicy Bypass -File 'C:\Temp\script.ps1'`

---

## 7. Key File Paths

```
/mnt/c/git/sc-item-stat-updater/
  bin/scrape-datacore.ts              ← main scraper
  src/extractor/datacore-xml-parser.ts ← fix extractEntityClass, extractHealth here
  src/items/datacore/types.ts          ← extend fieldSelectors type here
  src/items/datacore/shields.ts        ← fix recordFilter + fieldSelectors
  src/items/datacore/coolers.ts        ← fix recordFilter + fieldSelectors
  src/items/datacore/*.ts              ← fix recordFilter in all 22

Game data:
  C:\Games\Roberts Space Industries\StarCitizen\LIVE\Data\Game2.dcb
  %TEMP%\sc-uf-work\  ← already-extracted XML cache (reference only)
```

---

## 8. What NOT To Do

- Do NOT look for entity XMLs inside Data.p4k — they are NOT there
- Do NOT re-run unforge manually on Game2.dcb — the scraper handles caching itself
- Do NOT read the old `datacore-agent-handover.md` — it describes a problem that no longer exists
- Do NOT trust the old `recordFilter` values in any of the 22 type configs — all wrong
