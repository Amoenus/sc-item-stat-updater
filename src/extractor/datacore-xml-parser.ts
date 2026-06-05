import * as cheerio from 'cheerio/slim';

export type CheerioDoc = ReturnType<typeof cheerio.load>;

/**
 * Loads an XML document string into a cheerio instance with XML mode enabled.
 * All DataForge XML parsing in the DataCore provider goes through this.
 */
export function loadXml(xml: string): CheerioDoc {
  return cheerio.load(xml, { xmlMode: true });
}

/**
 * Reads a value from a DataForge XML element.
 * Handles both attribute-value format (`<Foo value="123" />`)
 * and text-content format (`<Foo>123</Foo>`).
 * Returns an empty string when the element is not found.
 */
export function xmlVal($: CheerioDoc, selector: string): string {
  const el = $(selector);
  if (!el.length) return '';
  const attrVal = el.first().attr('value');
  if (attrVal !== undefined) return attrVal;
  return el.first().text().trim();
}

/**
 * Reads a named attribute from a DataForge XML element.
 * Returns an empty string when the element or attribute is not found.
 */
export function xmlAttr($: CheerioDoc, selector: string, attr: string): string {
  return $(selector).first().attr(attr) ?? '';
}

// ---------------------------------------------------------------------------
// Common component accessors
// These reflect the DataForge entity class XML structure produced by unforge.
// Paths are CSS selectors in cheerio XML mode (tag1 tag2 is descendant, > is
// direct child). The exact paths should be verified against real game files.
// ---------------------------------------------------------------------------

/**
 * Extracts the entity class name from the root element's __path attribute.
 * Real XMLs have __path="libs/foundry/records/entities/scitem/ships/shieldgenerator/shld_aegs_s04_reclaimer_scitem.xml"
 * Strip _scitem.xml suffix to get the entity class name.
 * Falls back to parsing the root tag name after the dot.
 */
export function extractEntityClass($: CheerioDoc): string {
  const root = $(':root').first();
  const pathAttr = root.attr('__path') ?? '';
  if (pathAttr) {
    const basename = pathAttr.split('/').pop() ?? '';
    return basename.replace(/_scitem\.xml$/i, '').replace(/\.xml$/i, '');
  }
  // Fallback: parse from tag name "EntityClassDefinition.SHLD_AEGS_S04_Reclaimer_SCItem"
  let tagName = '';
  const node = root[0];
  if (node && node.type === 'tag') {
    tagName = node.name;
  }

  const dot = tagName.indexOf('.');
  return dot === -1 ? tagName : tagName.slice(dot + 1);
}

/** AttachDef attributes - common to all vehicle items. */
export interface AttachDef {
  size: string;
  grade: string;
  subtype: string;
  manufacturer: string;
}

const SUBTYPE_MAP: Record<string, string> = {
  BASIC: '',
  CIVILIAN: 'Civilian',
  MILITARY: 'Military',
  INDUSTRIAL: 'Industrial',
  STEALTH: 'Stealth',
  COMPETITION: 'Competition',
  EXPERIMENTAL: 'Experimental',
};

/**
 * Maps a DataForge subtype/class enum string to a human-readable class label.
 * Returns an empty string for BASIC (no class indicator) and passes through
 * any unknown values as-is for forward compatibility.
 */
function mapSubtype(raw: string): string {
  const upper = raw.toUpperCase();
  return upper in SUBTYPE_MAP ? SUBTYPE_MAP[upper] : raw;
}

/**
 * Extracts Size, Grade, Class, and Manufacturer from `SAttachableComponentParams`.
 * These fields are present on virtually every vehicle item.
 */
export function extractAttachDef($: CheerioDoc): AttachDef {
  const def = $('SAttachableComponentParams AttachDef').first();
  const mfr =
    readAttr(def.find('Manufacturer').first(), 'name') ??
    readAttr(def.find('manufacturer').first(), 'name') ??
    readAttr($('SAttachableComponentParams AttachDef > Manufacturer').first(), 'name') ??
    '';
  return {
    size: readAttr(def, 'size') ?? '',
    grade: (readAttr(def, 'grade') ?? '').toUpperCase(),
    subtype: mapSubtype(readAttr(def, 'subtype') ?? readAttr(def, 'sub_type') ?? ''),
    manufacturer: mfr,
  };
}

function readAttr(
  element: {
    attr(): Record<string, string> | undefined;
    attr(name: string): string | undefined;
  },
  name: string,
): string | undefined {
  const exact = element.attr(name);
  if (exact !== undefined) return exact;

  const attrs = element.attr() as Record<string, string> | undefined;
  const lowerName = name.toLowerCase();
  const found = Object.entries(attrs ?? {}).find(([key]) => key.toLowerCase() === lowerName);
  return found?.[1];
}

/**
 * Extracts health (max HP) from SHealthComponentParams Health attribute.
 */
export function extractHealth($: CheerioDoc): string {
  return $('SHealthComponentParams').first().attr('Health') ?? '';
}
