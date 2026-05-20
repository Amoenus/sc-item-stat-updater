import * as cheerio from 'cheerio/slim';
import type { AnyNode } from 'domhandler';

/**
 * Extracts the LIVE and PTU version strings from the SPViewer page HTML.
 * Active channel = the version span without the opacity-5 class.
 *
 * @param html - The HTML content of the page
 * @returns An object containing the live and ptu version strings
 */
export function extractVersions(html: string): { live: string | null; ptu: string | null } {
  const $ = cheerio.load(html);
  const liveSpan = $('h6.logo-version span.text-danger');
  const ptuSpan = $('h6.logo-version span.text-warning');

  const live = liveSpan.length ? liveSpan.text().trim() : null;
  const ptu = ptuSpan.length ? ptuSpan.text().trim() : null;

  return { live, ptu };
}

/**
 * Parses the item data table from the SPViewer HTML.
 *
 * @param html - The HTML content of the page
 * @returns An object containing headers and rows
 */
export function parseTable(html: string): { headers: string[]; rows: string[][] } {
  const $ = cheerio.load(html);

  const cleanHeader = (th: AnyNode) => {
    const $clone = $(th).clone();
    $clone
      .find(
        'select, .p-select, .p-dropdown, .p-column-filter, [class*="filter"], .p-column-header-content > :not(span:first-child)',
      )
      .remove();
    let text = $clone.text().trim();
    text = text.replace(/All[\s\S]*$/, '').trim() || text.trim();
    return text;
  };

  const theadRows = $('table thead tr').toArray();
  let headers: string[] = [];

  if (theadRows.length >= 2) {
    const groupCells = $(theadRows[0]).find('th').toArray();
    const leafCells = $(theadRows[theadRows.length - 1])
      .find('th')
      .toArray();
    const expanded: { name: string; span: number; originalSpan: number; isLeaf: boolean }[] = [];

    for (const th of groupCells) {
      const name = cleanHeader(th);
      const colspanAttr = $(th).attr('colspan');
      const span = colspanAttr ? Number.parseInt(colspanAttr, 10) : 1;
      // SPViewer rowspan structure can mean some headers in the first row don't have children in the second
      const rowspanAttr = $(th).attr('rowspan');
      const rowspan = rowspanAttr ? Number.parseInt(rowspanAttr, 10) : 1;

      for (let i = 0; i < span; i++) {
        expanded.push({ name, span, originalSpan: span, isLeaf: rowspan > 1 });
      }
    }

    let leafIdx = 0;
    for (let i = 0; i < expanded.length; i++) {
      if (expanded[i].isLeaf) {
        headers.push(expanded[i].name);
      } else if (
        expanded[i].span === 1 &&
        theadRows.length <= 2 &&
        expanded[i].originalSpan === 1 &&
        leafIdx >= leafCells.length
      ) {
        // some cases top row has no subheader, span 1
        headers.push(expanded[i].name);
      } else {
        const leafName = leafIdx < leafCells.length ? cleanHeader(leafCells[leafIdx]) : '';
        headers.push(leafName ? `${expanded[i].name} ${leafName}` : expanded[i].name);
        leafIdx++;
      }
    }
  } else if (theadRows.length === 1) {
    headers = $(theadRows[0]).find('th').toArray().map(cleanHeader);
  }

  const rows: string[][] = [];
  $('table tbody tr').each((_, tr) => {
    const text = $(tr).text();
    if (!text.includes('No data available')) {
      const rowData = $(tr)
        .find('td')
        .toArray()
        .map((td) => $(td).text().trim());
      if (rowData.length > 0) {
        rows.push(rowData);
      }
    }
  });

  return { headers, rows };
}

const PAGINATOR_SELECTORS = [
  '.p-paginator-rpp-options',
  '[class*="paginator"] select',
  '.p-select',
] as const;

const DROPDOWN_OPTION_SELECTORS = [
  '.p-select-option',
  '.p-dropdown-item',
  '.p-select-list li',
] as const;

/**
 * Detects whether a paginator / page-size control is present in the page HTML
 * and returns the first matching CSS selector, or null if none is found.
 *
 * @param html - The HTML content of the page
 * @returns The matching CSS selector string, or null
 */
export function findPaginatorSelector(html: string): string | null {
  const $ = cheerio.load(html);
  for (const selector of PAGINATOR_SELECTORS) {
    if ($(selector).length > 0) return selector;
  }
  return null;
}

/**
 * Returns true when a dropdown option with the text "All" (case-insensitive)
 * is present in the parsed HTML — i.e. the paginator dropdown is already open
 * and the "All" option is visible.
 *
 * @param html - The HTML content of the page after the dropdown has been opened
 */
export function hasAllOption(html: string): boolean {
  const $ = cheerio.load(html);
  return (
    $('li')
      .toArray()
      .some((el) => /^all$/i.test($(el).text().trim()))
  );
}

/**
 * Finds the CSS selector used to query individual dropdown option items
 * (the list that appears after opening a paginator / page-size dropdown).
 * Returns the first selector that matches at least one element, or null.
 *
 * @param html - The HTML content of the page after the dropdown has been opened
 */
export function findDropdownOptionSelector(html: string): string | null {
  const $ = cheerio.load(html);
  for (const selector of DROPDOWN_OPTION_SELECTORS) {
    if ($(selector).length > 0) return selector;
  }
  return null;
}
