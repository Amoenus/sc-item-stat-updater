# INI String Syntax & In-Game Rendering

Star Citizen's `global.ini` stores all localized text as flat key-value pairs. The game engine processes certain escape sequences and markup tags when rendering values as in-game tooltips and UI text. This document covers every syntactical form you will encounter when working with this codebase.

---

## Escape Sequences

The game engine interprets the **literal two-character sequence `\n`** (backslash + letter `n`) as whitespace control. This is **not** an actual newline in the file — the INI values are single physical lines.

| Sequence in file | Renders in-game as |
|---|---|
| `\n` | Line break (new row in the tooltip) |
| `\n\n` | Blank line (visual paragraph / section separator) |

> **Note:** Real (physical) newline characters inside a value are unsupported and are stripped by `sanitizeIniValue()` in [src/lib/format/formatter.js](../src/lib/format/formatter.js).

---

## Markup Tags

A small number of HTML-like tags are recognised by the engine inside localization strings.

| Tag | Effect | Where seen |
|---|---|---|
| `<i>text</i>` | Italic text | Item flavor / lore descriptions |
| `<EM4>text</EM4>` | Colored emphasis (mission UI orange) | Mission briefing strings |
| `~mission(Key\|Fallback)` | Runtime substitution of mission variables | Mission briefing strings |
| `<-=MISSING=->` | Engine placeholder for an absent localization key | Unfilled entries in `global.ini` |

Tags beyond `<i>` are generally found only in mission strings, not in the item-stat descriptions this tool writes.

---

## Annotated Example

Below is a **real entry** from `global.ini`, annotated to show how each piece maps to its in-game appearance.

### Raw INI value

```
item_Mining_Consumable_Brandt_Desc=Item Type: Module\nManufacturer: Musashi Industrial & Starflight Concern\nSize: 1\nCharges: 5\nDuration: 60s\n\n-- Power Modifiers --\nMining Power: +35%\n\n-- Rock Modifiers --\nResistance: +15.5%\nShatter Damage: -30%\n\nStrategically use the Brandt to boost a mining laser's power for sixty seconds…
```

### How it renders in-game (schematic)

```
Item Type: Module
Manufacturer: Musashi Industrial & Starflight Concern
Size: 1
Charges: 5
Duration: 60s
                          ← blank line (\n\n)
-- Power Modifiers --
Mining Power: +35%
                          ← blank line (\n\n)
-- Rock Modifiers --
Resistance: +15.5%
Shatter Damage: -30%
                          ← blank line (\n\n)
Strategically use the Brandt…   (flavor text)
```

---

## How the `stat` Builder Produces This Syntax

The fluent `stat()` builder in [src/lib/format/stat-builder.js](../src/lib/format/stat-builder.js) constructs an array of strings, then joins them.

| Builder call | Contribution to the parts array | Effect in INI value |
|---|---|---|
| `.line('Label', 'Value')` | `"Label: Value"` | Single stat line |
| `.num('Label', 'col')` | `"Label: 1,234"` | Stat line with `fmtNum()` formatting |
| `.raw('Label', 'col', ' m/s')` | `"Label: <csv value> m/s"` | Stat line with raw CSV value |
| `.section('-- Title --')` | `"\\n-- Title --"` | Blank line above + section header |
| `.lineIf / .numIf / .rawIf` | Same as non-`If` variants | Omitted entirely when value is falsy or `'0'` |

After all parts are collected, `build(flavorText)` joins them with `\n` and appends `\n\n<flavorText>` when flavor text is present:

```
parts.join('\\n')        → "…Duration: 60s\\n\\n-- Power Modifiers --\\nMining Power: +35%…"
+ '\\n\\n' + flavorText  → "…\\n\\nStrategically use the Brandt…"
```

The double `\n` before a section header comes from joining a plain stat line (`"Duration: 60s"`) with the section part (`"\\n-- Power Modifiers --"`): `"Duration: 60s" + "\\n" + "\\n-- Power Modifiers --"` = `"Duration: 60s\\n\\n-- Power Modifiers --"`.

---

## Configuration

There is no runtime configuration for these formatting conventions. The choice of:

- Section delimiter style (`-- Name --`)
- Separator character (`\n` / `\n\n`)
- Markup tags

…is determined by the game engine's renderer and the conventions baked into each item config's `buildValue()` function. To change how a specific item type is formatted, edit its config file in `src/items/spviewer/` or `src/items/shared/` and update the `.section()` / `.line()` calls accordingly.
