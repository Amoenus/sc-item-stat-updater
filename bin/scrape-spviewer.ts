#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { extractVersions, parseTable } from '../src/extractor/spviewer-html-parser.js';
import { SpviewerScrapedDataSchema } from '../src/schema/spviewer.schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const __rootDir = join(__dirname, '..');

const PAGE_LOAD_TIMEOUT_MS = 60_000;
const TABLE_LOAD_TIMEOUT_MS = 90_000;
const PAGINATION_SETTLE_MS = 500;
const POST_PAGINATION_SETTLE_MS = 2000;

const ITEM_TYPES = [
  // OP. MODES
  'Bomb',
  'EMP',
  'Missile',
  'WeaponMining',
  'MiningModifier',
  'SalvageModifier',
  'TractorBeam',
  // WEAPONS
  'WeaponGun',
  'MissileLauncher',
  'WeaponDefensive',
  'Turret',
  // SYSTEMS
  'Shield',
  'Cooler',
  'Radar',
  'SelfDestruct',
  'FlightController',
  'ShieldController',
  // PROPULSION
  'PowerPlant',
  'QuantumDrive',
  'QuantumInterdictionGenerator',
  'JumpDrive',
  // FPS GEAR
  'WeaponPersonal',
  'WeaponAttachment',
  'Throwable',
];

const BASE_URL = 'https://www.spviewer.eu/items';

// Try to show all entries (click "All" in page-size dropdown if present).
// Best-effort: errors are silently swallowed so scraping still continues.
async function expandPaginatorToAll(page: import('puppeteer').Page): Promise<void> {
  try {
    const paginator = await page.$('.p-paginator-rpp-options, [class*="paginator"] select, .p-select');
    if (!paginator) return;
    await paginator.click();
    await sleep(PAGINATION_SETTLE_MS);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allOption = await (page as any).$x("//li[contains(text(),'All') or contains(text(),'all')]");
    if (allOption.length) {
      await allOption[0].click();
    } else {
      const options = await page.$$('.p-select-option, .p-dropdown-item, .p-select-list li');
      if (options.length) await options.at(-1)?.click();
    }
    await sleep(POST_PAGINATION_SETTLE_MS);
  } catch {
    /* pagination handling is best-effort */
  }
}

/**
 * Scrapes item data for a given item type from SPViewer.
 */
async function scrapeItems(
  browser: import('puppeteer').Browser,
  itemType: string,
): Promise<{ headers: string[]; rows: string[][] }> {
  console.log(`  Scraping ${itemType}...`);

  const page = await browser.newPage();

  try {
    await page.goto(`${BASE_URL}?item=${itemType}`, {
      waitUntil: 'networkidle2',
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    // Wait for the DataTable to load rows (up to 90s for DB init)
    await page.waitForFunction(
      () => {
        const rows = document.querySelectorAll('table tbody tr');
        return rows.length > 0 && !rows[0].textContent.includes('No data available');
      },
      { timeout: TABLE_LOAD_TIMEOUT_MS },
    );

    await expandPaginatorToAll(page);
    await sleep(POST_PAGINATION_SETTLE_MS);

    const html = await page.content();
    const data = parseTable(html);

    const result = SpviewerScrapedDataSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`SPViewer scraped data for ${itemType} failed schema validation:\n${result.error.toString()}`);
    }

    return result.data;
  } finally {
    await page.close();
  }
}

/**
 * @param {{ headers: string[], rows: string[][] }} data
 * @returns {string}
 */
function toCsv({ headers, rows }: { headers: string[]; rows: string[][] }): string {
  const escapeVal = (v: string): string => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replaceAll('"', '""')}"`;
    }
    return v;
  };
  const lines = [headers.map(escapeVal).join(','), ...rows.map((row) => row.map(escapeVal).join(','))];
  return `${lines.join('\n')}\n`;
}

// --- CLI ---
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node scrape-spviewer.js [itemType ...] [options]

Item types: ${ITEM_TYPES.join(', ')}

Options:
  --all        Scrape all item types
  --ptu        Use PTU version label for output directory (default: LIVE)
  --live       Use LIVE version label for output directory (default)
  --list       List available item types
  --json       Output JSON instead of CSV
  -h, --help   Show this help

Output:
  CSVs are written to csv/spviewer/<version>-live/ or csv/spviewer/<version>-ptu/
  The version string is extracted from the SPViewer page header.

Examples:
  node scrape-spviewer.js --all
  node scrape-spviewer.js Radar Shield
  node scrape-spviewer.js --all --ptu`);
  process.exit(0);
}

if (args.includes('--list')) {
  console.log('Available item types:');
  for (const t of ITEM_TYPES) console.log(`  ${t}`);
  process.exit(0);
}

const usePtu = args.includes('--ptu');
const useJson = args.includes('--json');
const useAll = args.includes('--all');
const types = useAll ? ITEM_TYPES : args.filter((a) => !a.startsWith('--'));

if (types.length === 0) {
  console.error('Error: specify at least one item type, or use --all');
  process.exit(1);
}

const channel = usePtu ? 'ptu' : 'live';
console.log(`SPViewer scraper — channel: ${channel.toUpperCase()}`);
console.log(`Launching browser to detect version...`);

const browser = await puppeteer.launch({ headless: true });

// Navigate to the first item type page to extract version info from the header.
const versionPage = await browser.newPage();
await versionPage.goto(`${BASE_URL}?item=${types[0]}`, {
  waitUntil: 'networkidle2',
  timeout: PAGE_LOAD_TIMEOUT_MS,
});

const versionHtml = await versionPage.content();
const versions = extractVersions(versionHtml);
await versionPage.close();

const versionRaw = usePtu ? versions.ptu : versions.live;
if (!versionRaw) {
  console.error(
    `Could not detect ${channel.toUpperCase()} version from SPViewer page header.\n` +
      `Detected: LIVE=${versions.live ?? 'n/a'}, PTU=${versions.ptu ?? 'n/a'}\n` +
      `The page structure may have changed.`,
  );
  await browser.close();
  process.exit(1);
}

// Normalise: "4.7.2.11715810" -> "4.7.2.11715810-live" (append channel suffix)
const version = `${versionRaw}-${channel}`;
const outDir = join(__rootDir, 'csv', 'spviewer', version);

mkdirSync(outDir, { recursive: true });

console.log(`Version: ${version}`);
console.log(`Output:  csv/spviewer/${version}/`);
console.log();

for (const itemType of types) {
  try {
    const data = await scrapeItems(browser, itemType);
    console.log(`    ${data.rows.length} rows, ${data.headers.length} columns`);

    const ext = useJson ? 'json' : 'csv';
    const filename = `${itemType.toLowerCase()}.spviewer.${ext}`;
    const outPath = join(outDir, filename);

    const content = useJson ? JSON.stringify(data, null, 2) : toCsv(data);
    writeFileSync(outPath, content, 'utf-8');
    console.log(`    Saved: csv/spviewer/${version}/${filename}`);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`  FAILED ${itemType}: ${error.message}`);
  }
}

await browser.close();
console.log(`\nDone. Scraped ${types.length} item type(s) into csv/spviewer/${version}/`);
