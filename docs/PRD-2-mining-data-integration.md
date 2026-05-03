# PRD 2: Mining Data Integration (Localization Updaters)

Status: REVISED — aligned to current codebase state after PRD 1 implementation.

---

## Overview

Three new updater configs plug into the existing ItemConfig/updater engine to replace
manually curated mining data in global.ini with values derived from the versioned CSVs
produced by scrape-scmdb.js.

Source CSVs (live under csv/scmdb/<version>/):
  - mining-elements.csv   — per-element stats (Rarity, Scan Sig, Resistance, Instability)
  - mining-journal.csv    — rarity category -> element list mapping
  - mining-locations.csv  — location name -> Ship Mineables / Hand Mineables lists

All three configs are drop files in src/items/missions/ and are auto-discovered by
registry.js as mission-mining-elements, mission-mining-journal, mission-mining-locations.
update-all.js already passes missionCsvDir = csv/scmdb/<latest-version>/ to them.

---

## 1. Commodity Stats Updater

File: src/items/missions/mining-elements.js

### INI target

Keys matching: items_commodities_*_desc
(e.g. items_commodities_agricium_desc, items_commodities_bexalite_desc)

Only mineral/ore entries have matching rows in mining-elements.csv.
Keys with no matching row are left untouched.

### CSV source

csv/scmdb/<version>/mining-elements.csv

Columns:
  Element Name   — display name, e.g. "Agricium (Ore)"
  Rarity         — common / uncommon / rare / epic / legendary (may be empty)
  Ground Scan Signature — integer or empty
  Scan Signature — integer or empty
  Resistance     — float (can be negative)
  Instability    — integer

### Key matching strategy

The updater engine works row-by-row, requires a Localization Key column, or uses
getTargetKeys() to emit the keys a row controls. For mining-elements the Element Name
does NOT directly match an INI key — a lookup is needed.

Approach: descKeyMatch identifies all items_commodities_*_desc keys already in the INI.
getTargetKeys derives the candidate key from Element Name:
  - strip suffix in parens: "Agricium (Ore)" -> "Agricium"
  - lowercase, remove spaces/hyphens: "agricium"
  - emit key: "items_commodities_agricium_desc"
  - if that key exists in the INI, return it; otherwise return [] (skip row)

requiredColumns: ['Element Name', 'Rarity', 'Scan Signature', 'Resistance', 'Instability']

### buildValue behaviour

Preserve the existing flavor text verbatim, then append the stats block:

  <existing flavor text>\\n\\n** Scanner Data **\\nRarity: <Rarity | N/A>\\nScan Signature: <value | N/A>\\nResistance: <value | N/A>\\nInstability: <value | N/A>

Rules:
  - If a stats block (starting with \\n\\n** Scanner Data **) already exists, strip it
    first so re-runs are idempotent.
  - If Ground Scan Signature is non-empty, add a second line:
      Ground Scan Signature: <value>
    placed immediately after "Scan Signature: ..." (ship scan sig line).
  - Rarity capitalized (Title Case). If empty in CSV, show "N/A".
  - Resistance and Instability shown as-is (no unit suffix — game engine handles display).

### Config shape

  csvFile: 'mining-elements.csv'
  label: 'Mining element stats'
  requiredColumns: [...]
  descKeyMatch: (kl) => kl.startsWith('items_commodities_') && kl.endsWith('_desc')
  getTargetKeys(row, deriveDescKey): [derived key or empty]
  buildValue(row, flavorText, oldValue, targetKey): appended stats string

---

## 2. Mining Journal Updater

File: src/items/missions/mining-journal.js

### INI target

Single key: Journal_General_Mining_Compendium_Content

Current format: one long value — intro lore paragraph followed by per-element entries
like "Agricium - Location1, Location2, ..." separated by \\n\\n.

The PRD 1 CSV (mining-journal.csv) provides a rarity-grouped view instead. The journal
will be restructured to a rarity-grouped format matching the existing in-game style.

### CSV source

csv/scmdb/<version>/mining-journal.csv

Columns:
  Rarity Category  — Uncommon / Common / Rare / Epic / Legendary / Unknown
  Element List     — newline-separated list of element names within that category

### Desired output format

Preserve the intro block verbatim (everything up to and including the first \\n\\n after
the opening sentence). Then emit one section per rarity category in this order:
  Legendary, Epic, Rare, Uncommon, Common
Skip the "Unknown" category (those are hand-mineable/ground items without scanner data).

Each section:

  ** <Rarity> **\\n<element1>\\n<element2>\\n...

Sections separated by \\n\\n. Full example snippet:

  To promote the entrepreneurial spirit...\\n\\n** Legendary **\\nQuantainium (Raw)\\nSavrilium (Ore)\\nStileron (Ore)\\n\\n** Epic **\\n...

### Implementation approach

The ItemConfig interface is designed for multi-row CSV -> multi-key updates.
The journal is a single-key, full-rewrite job driven by the entire CSV at once.
Two options:

  Option A (recommended): Custom single-use function in the config file.
    Export a named buildJournalValue(rows, oldValue) function alongside the default
    ItemConfig export. update-all.js (or a dedicated bin/update-mining-journal.js)
    calls it directly, reads the INI key, replaces it, and writes the file.

  Option B: Shoehorn into ItemConfig by emitting one synthetic row with
    Localization Key = Journal_General_Mining_Compendium_Content and pre-building
    the full value in parseJson/parseCSV equivalent.

  Option A is cleaner and does not force the engine to handle a CSV-of-one-row pattern.
  The journal updater should be invoked explicitly in update-all.js after the
  standard runUpdater() calls.

### Idempotency

The intro lore block must be detected by scanning for the first occurrence of \\n\\n**
(start of the first rarity section). Everything before that anchor is the intro.
On re-run, strip from that anchor onward and rebuild.

---

## 3. Location Description Updater

File: src/items/missions/mining-locations.js

### INI target

Planet and moon description keys. These end in _desc or _Desc (mixed case observed).
Examples from the INI: Pyro1_desc, Pyro2_desc, ArcCorp_desc, AsteroidCluster_Pyro_Desc

Current value structure (\\n-escaped in INI, shown expanded):

  P=<Flavor text paragraph(s)>

  Potential Ship Mineables:
  Iron
  Copper
  ...

  Potential Ground Vehicle Mineables:
  Beradon

  Potential Hand Mineables:
  Aphorite
  Dolivine
  ...

  Potential Harvestables:
  Decari Pod
  ...

  Potential Creatures:
  Quasigrazer

Not all sections are present on every location. Order must be preserved.

### CSV source

csv/scmdb/<version>/mining-locations.csv

Columns:
  Location Name    — human display name, e.g. "Aaron Halo", "Pyro I"
  Ship Mineables   — newline-separated list (may be empty)
  Hand Mineables   — newline-separated list (may be empty)

Note: the CSV has NO Ground Vehicle Mineables column. That section must be preserved
from the existing INI value unchanged if present.

### Key matching strategy

CSV Location Name -> INI key is a fuzzy/manual mapping, not a direct transform.
Examples: "Pyro I" -> Pyro1_desc, "Aaron Halo" -> AaronHalo_desc (hypothetical).

Approach: embed a static locationKeyMap in the config (or a companion JSON) that maps
each Location Name string to its exact INI key(s). This map is built once by inspection
and updated as new locations are added.

Alternative (lower maintenance): descKeyMatch identifies all *_desc/*_Desc keys in the
INI. For each such key, the config attempts to resolve which CSV row applies by reverse-
matching: normalise both the INI key (strip _desc suffix, expand digits to roman, etc.)
and the Location Name to a comparable slug, then match. This is fragile for irregular
names. Prefer the static map with a fallback warning for unmatched CSV rows.

requiredColumns: ['Location Name', 'Ship Mineables', 'Hand Mineables']

### buildValue behaviour

Given the old INI value and a CSV row:

1. Extract flavor text: everything before the first "Potential " section heading.
2. Parse all existing "Potential X:" sections into a dict keyed by section name.
3. Replace the 'Potential Ship Mineables' entry with the CSV Ship Mineables list.
   If Ship Mineables is empty in the CSV, remove the section entirely.
4. Replace the 'Potential Hand Mineables' entry with the CSV Hand Mineables list.
   If Hand Mineables is empty in the CSV, remove the section entirely.
5. Preserve 'Potential Ground Vehicle Mineables', 'Potential Harvestables',
   'Potential Creatures' exactly as found in the old value (content and order).
6. Re-assemble in canonical section order:
     Potential Ship Mineables -> Ground Vehicle Mineables -> Hand Mineables ->
     Harvestables -> Creatures
   Only include sections that have content.
7. Rejoin with \\n\\n between sections; each section is "Potential X:\\n<item>\\n<item>..."

If the old value has no "Potential " sections (no mining data yet), append the new
sections after the flavor text.

### Idempotency

Because Ship and Hand sections are fully replaced, re-runs are safe. Ground Vehicle,
Harvestables, Creatures are pass-through from old value, so they cannot be corrupted.

---

## Types and Infrastructure Changes

### No changes to types.js required for updaters 1 and 3

ItemConfig already supports getTargetKeys for key derivation. The location updater
returns a target key per row derived from the location key map.

### update-all.js additions

After the existing runUpdater() loop, add explicit calls for:
  - Mining journal rebuild (Option A custom function from mining-journal.js)

The three new mission configs are auto-discovered by registry.js and run as part of
the existing mission config loop with missionCsvDir as their csvDir.

---

## File Summary

  src/items/missions/mining-elements.js   — NEW: commodity stats appender
  src/items/missions/mining-journal.js    — NEW: journal rarity-section rebuilder
  src/items/missions/mining-locations.js  — NEW: location ship/hand mineable replacer

No changes required to:
  src/lib/updater.js
  src/lib/types.js
  src/items/registry.js
  bin/update-all.js  (minor addition: call journal rebuild function post-loop)

---

## Out of Scope

- Ground Vehicle Mineables data (not in any scraped CSV; preserved from existing INI)
- Commodity name updates (handled by src/items/spviewer/commodities.js already)
- Adding new location keys that don't yet exist in the INI
