import * as cheerio from 'cheerio/slim';
import type { AnyNode } from 'domhandler';
import { type SpviewerScrapedDataDTO, SpviewerScrapedDataSchema } from '../schema/spviewer.schemas.js';

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

type ExpandedCell = { name: string; span: number; originalSpan: number; isLeaf: boolean };
type CheerioRoot = ReturnType<typeof cheerio.load>;
type HeaderCleaner = (th: AnyNode) => string;

function makeHeaderCleaner($: CheerioRoot): HeaderCleaner {
  return (th: AnyNode) => {
    const $clone = $(th).clone();
    $clone
      .find(
        'select, .p-select, .p-dropdown, .p-column-filter, [class*="filter"], .p-column-header-content > :not(span:first-child)',
      )
      .remove();
    const text = $clone.text().trim();
    return text.replace(/All[\s\S]*$/, '').trim() || text;
  };
}

function expandGroupCells(groupCells: AnyNode[], $: CheerioRoot, cleanHeader: HeaderCleaner): ExpandedCell[] {
  const expanded: ExpandedCell[] = [];
  for (const th of groupCells) {
    const name = cleanHeader(th);
    const span = Number.parseInt($(th).attr('colspan') ?? '1', 10);
    // SPViewer rowspan structure can mean some headers in the first row don't have children in the second
    const rowspan = Number.parseInt($(th).attr('rowspan') ?? '1', 10);
    for (let i = 0; i < span; i++) {
      expanded.push({ name, span, originalSpan: span, isLeaf: rowspan > 1 });
    }
  }
  return expanded;
}

function resolveMultiRowHeaders(
  expanded: ExpandedCell[],
  leafCells: AnyNode[],
  theadRowCount: number,
  cleanHeader: HeaderCleaner,
): string[] {
  const headers: string[] = [];
  let leafIdx = 0;
  for (const element of expanded) {
    if (element.isLeaf) {
      headers.push(element.name);
    } else if (element.originalSpan === 1 && theadRowCount <= 2 && leafIdx >= leafCells.length) {
      // some cases top row has no subheader, span 1
      headers.push(element.name);
    } else {
      const leafName = leafIdx < leafCells.length ? cleanHeader(leafCells[leafIdx]) : '';
      headers.push(leafName ? `${element.name} ${leafName}` : element.name);
      leafIdx++;
    }
  }
  return headers;
}

function extractTableRows($: CheerioRoot): string[][] {
  const rows: string[][] = [];
  $('table tbody tr').each((_, tr) => {
    if ($(tr).text().includes('No data available')) return;
    const rowData = $(tr)
      .find('td')
      .toArray()
      .map((td) => $(td).text().trim());
    if (rowData.length > 0) rows.push(rowData);
  });
  return rows;
}

/**
 * Parses the item data table from the SPViewer HTML.
 *
 * @param html - The HTML content of the page
 * @returns An object containing headers and rows
 */
export function parseTable(html: string): SpviewerScrapedDataDTO {
  const $ = cheerio.load(html);
  const cleanHeader = makeHeaderCleaner($);
  const theadRows = $('table thead tr').toArray();
  let headers: string[] = [];

  if (theadRows.length >= 2) {
    const groupCells = $(theadRows[0]).find('th').toArray();
    const leafCells = $(theadRows.at(-1)).find('th').toArray();
    const expanded = expandGroupCells(groupCells, $, cleanHeader);
    headers = resolveMultiRowHeaders(expanded, leafCells, theadRows.length, cleanHeader);
  } else if (theadRows.length === 1) {
    headers = $(theadRows[0]).find('th').toArray().map(cleanHeader);
  }

  return SpviewerScrapedDataSchema.parse({ headers, rows: extractTableRows($) });
}

const PAGINATOR_SELECTORS = ['.p-paginator-rpp-options', '[class*="paginator"] select', '.p-select'] as const;

const DROPDOWN_OPTION_SELECTORS = ['.p-select-option', '.p-dropdown-item', '.p-select-list li'] as const;

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
  return $('li')
    .toArray()
    .some((el) => /^all$/i.test($(el).text().trim()));
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
