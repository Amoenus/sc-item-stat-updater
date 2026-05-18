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
