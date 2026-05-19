/**
 * Text-formatting tags used in Star Citizen's global.ini localization strings,
 * inferred from analysis of global.ini (no public spec exists).
 *
 * Use these constants instead of hardcoding tag strings so that tag names are
 * consistent across the codebase and discoverable via IDE tooling.
 *
 * ---
 *
 * ## ~substitution() template expressions — reference inventory
 *
 * global.ini strings also contain runtime substitution expressions resolved by
 * the game engine. Updaters do not generate or modify them directly; they are
 * documented here as an inventory for reference.
 *
 * ### ~mission(Variable) — mission data (most common)
 *
 * Injects a value from the active mission instance at runtime.
 *
 * **Bare variables** (examples):
 * - `~mission(target)`            — target NPC name
 * - `~mission(Location)`          — location entity name
 * - `~mission(Ship)`              — ship name
 * - `~mission(Client)`            — client name
 * - `~mission(amount)`            — numeric amount
 * - `~mission(reward)`            — credit reward
 *
 * **Pipe `|` modifier** — selects a sub-property or output format:
 * - `~mission(Location|Address)`  — full formatted location string (e.g. "Hurston, Lorville")
 * - `~mission(Target|First)`      — first name only
 * - `~mission(Target|Last)`       — last name only
 * - `~mission(Target|Short)`      — abbreviated form
 * - `~mission(Target|Capitalized)` — force capitalised form
 * - `~mission(Target|NickOrFirst)` — nickname if available, else first name
 * - `~mission(Item|SerialNumber)` — serial number sub-property
 * - `~mission(GoldTime|t.)`       — time formatted (e.g. "1:23.4")
 * - `~mission(GoldTime|t.+)`      — time formatted with milliseconds
 * - `~mission(Contractor|BountyDescription)` — nested localization string from a contractor object
 * - `~mission(Address|ListAll)`   — lists all addresses
 * - `~mission(Item|1)`            — first item in an indexed list
 *
 * `~missions()` (plural) is the same mechanism used for multi-mission/shared
 * objective contexts. `~misssion()` (triple-s) is a typo present in the source
 * data, functionally equivalent.
 *
 * ### Other substitution types
 *
 * | Expression                              | Injected value                                  |
 * |-----------------------------------------|-------------------------------------------------|
 * | `~playername()`                         | Player's own handle/name                        |
 * | `~padnumber()`                          | Assigned landing pad number                     |
 * | `~bedroom()`                            | Player's assigned hab/room number               |
 * | `~action(context|binding)`              | Formatted keybinding hint (e.g. `[F]`)          |
 * | `~icon(Name|W|H)`                       | Inline icon image (e.g. `~icon(Flare|22|22)`)   |
 * | `~image(file.png|W|H)`                  | Inline image by filename                        |
 * | `~law(field)`                           | Legal system data (e.g. `~law(committedCrimes)`) |
 * | `~quantumLink(PlayerName)`              | Quantum travel link info for a player           |
 * | `~playerTrade(TraderName)`              | Player trade session data                       |
 * | `~serviceBeacon(InitiatorName)`         | Service beacon originator name                  |
 * | `~shopInteractionData(price)`           | Shop/kiosk data (price, stock, etc.)            |
 * | `~ItemModifierMethod(value)`            | Item stat modifier value (attachment tooltips)  |
 * | `~MiningModifierMethod(instability)`    | Mining modifier stat                            |
 * | `~AttachableModifierMethod(charges)`    | Attachable item modifier stat                   |
 * | `~RefineryMethod(error)`               | Refinery process data                           |
 * | `~rentalNotification(RentedItemName)`   | Rental notification data                        |
 */

/** A formatting tag that can wrap content or expose its raw strings for RegExp construction. */
export interface IniTagDescriptor {
  /** Opening tag string, e.g. `<EM4>`. Safe to interpolate directly into a `new RegExp(...)` template. */
  readonly open: string;
  /** Closing tag string, e.g. `</EM4>`. Safe to interpolate directly into a `new RegExp(...)` template. */
  readonly close: string;
  /** Returns `<TAG>content</TAG>`. */
  readonly wrap: (content: string) => string;
}

function makeTag(name: string): IniTagDescriptor {
  const open = `<${name}>`;
  const close = `</${name}>`;
  return { open, close, wrap: (content: string) => `${open}${content}${close}` };
}

/**
 * Text-formatting tags used in global.ini localization strings.
 *
 * Inferred from analysis of global.ini — no public spec exists.
 *
 * | Tag      | Visual role                                                      |
 * |----------|------------------------------------------------------------------|
 * | `EM1–5`  | Emphasis tiers; exact colours are defined per UI stylesheet      |
 * | `EM4`    | Most common — accent colour used for mission-critical info       |
 * | `EM3`    | Used for illegal/warning prefixes (e.g. `[!]`)                   |
 * | `bold`   | Bold text (`<b>`)                                                |
 * | `italic` | Italic text (`<i>`)                                              |
 */
export const IniTag = {
  /** Emphasis tier 1. Specific style depends on the active UI stylesheet. */
  EM1: makeTag('EM1'),
  /** Emphasis tier 2. Specific style depends on the active UI stylesheet. */
  EM2: makeTag('EM2'),
  /** Emphasis tier 3. Used for illegal/warning prefixes, e.g. `<EM3>[!]</EM3>`. */
  EM3: makeTag('EM3'),
  /** Emphasis tier 4 (most common). Accent colour for locations, item names, and key terms in mission text. */
  EM4: makeTag('EM4'),
  /** Emphasis tier 5. Specific style depends on the active UI stylesheet. */
  EM5: makeTag('EM5'),
  /** Bold text — `<b>content</b>`. */
  bold: makeTag('b'),
  /** Italic text — `<i>content</i>`. */
  italic: makeTag('i'),
} as const;
