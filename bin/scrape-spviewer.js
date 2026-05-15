#!/usr/bin/env node
// @ts-check
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { SpviewerScrapedDataSchema } from '../src/lib/schemas/spviewer.schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const __rootDir = join(__dirname, '..');

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

/**
 * Extracts the LIVE and PTU version strings from the SPViewer page header.
 * The header contains:
 *   <span class="text-danger ...">4.7.2.11715810</span>   <- LIVE (active when no opacity-5)
 *   <span class="text-warning ... opacity-5">4.8.0.11768487</span>  <- PTU (inactive when opacity-5)
 * Active channel = the version span without the opacity-5 class.
 *
 * @param {import('puppeteer').Page} page
 * @returns {Promise<{ live: string | null, ptu: string | null }>}
 */
async function extractVersions(page) {
  return page.evaluate(() => {
    const liveSpan = document.querySelector('h6.logo-version span.text-danger');
    const ptuSpan = document.querySelector('h6.logo-version span.text-warning');
    const live = liveSpan ? liveSpan.textContent.trim() : null;
    const ptu = ptuSpan ? ptuSpan.textContent.trim() : null;
    return { live, ptu };
  });
}

/**
 * Scrapes item data for a given item type from SPViewer.
 *
 * @param {import('puppeteer').Browser} browser
 * @param {string} itemType
 * @returns {Promise<{ headers: string[], rows: string[][] }>}
 */
async function scrapeItems(browser, itemType) {
  console.log(`  Scraping ${itemType}...`);

  const page = await browser.newPage();

  try {
    await page.goto(`${BASE_URL}?item=${itemType}`, {
      waitUntil: 'networkidle2',
      timeout: 60_000,
    });

    // Wait for the DataTable to load rows (up to 90s for DB init)
    await page.waitForFunction(
      () => {
        const rows = document.querySelectorAll('table tbody tr');
        return rows.length > 0 && !rows[0].textContent.includes('No data available');
      },
      { timeout: 90_000 },
    );

    // Try to show all entries (click "All" in page-size dropdown if present)
    try {
      const paginator = await page.$('.p-paginator-rpp-options, [class*="paginator"] select, .p-select');
      if (paginator) {
        await paginator.click();
        await new Promise((r) => setTimeout(r, 500));
        const allOption = await page.$x("//li[contains(text(),'All') or contains(text(),'all')]");
        if (allOption.length) {
          await allOption[0].click();
        } else {
          const options = await page.$$('.p-select-option, .p-dropdown-item, .p-select-list li');
          if (options.length) await options[options.length - 1].click();
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch {
      /* pagination handling is best-effort */
    }

    await new Promise((r) => setTimeout(r, 2000));

    const data = await page.evaluate(() => {
      const cleanHeader = (/** @type {Element} */ th) => {
        const clone = th.cloneNode(true);
        for (const el of clone.querySelectorAll(
          'select, .p-select, .p-dropdown, .p-column-filter, [class*="filter"], .p-column-header-content > :not(span:first-child)',
        )) {
          el.remove();
        }
        let text = clone.textContent.trim();
        text = text.replace(/All[\s\S]*$/, '').trim() || text.trim();
        return text;
      };

      const theadRows = [...document.querySelectorAll('table thead tr')];
      let headers = [];

      if (theadRows.length >= 2) {
        const groupCells = [...theadRows[0].querySelectorAll('th')];
        const leafCells = [...theadRows[theadRows.length - 1].querySelectorAll('th')];
        const expanded = [];
        for (const th of groupCells) {
          const name = cleanHeader(th);
          const span = th.colSpan || 1;
          for (let i = 0; i < span; i++) expanded.push({ name, span });
        }
        let leafIdx = 0;
        for (let i = 0; i < expanded.length; i++) {
          if (expanded[i].span === 1) {
            headers.push(expanded[i].name);
          } else {
            const leafName = leafIdx < leafCells.length ? cleanHeader(leafCells[leafIdx]) : '';
            headers.push(leafName ? `${expanded[i].name} ${leafName}` : expanded[i].name);
            leafIdx++;
          }
        }
      } else if (theadRows.length === 1) {
        headers = [...theadRows[0].querySelectorAll('th')].map(cleanHeader);
      }

      const rows = [...document.querySelectorAll('table tbody tr')]
        .filter((tr) => !tr.textContent.includes('No data available'))
        .map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim()));

      return { headers, rows };
    });

    const result = SpviewerScrapedDataSchema.safeParse(data);
    if (!result.success) {
      throw new Error(
        `SPViewer scraped data for ${itemType} failed schema validation:\n${result.error.toString()}`,
      );
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
function toCsv({ headers, rows }) {
  const escape = (/** @type {string} */ v) => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))];
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
  timeout: 60_000,
});

const versions = await extractVersions(versionPage);
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
    console.error(`  FAILED ${itemType}: ${err.message}`);
  }
}

await browser.close();
console.log(`\nDone. Scraped ${types.length} item type(s) into csv/spviewer/${version}/`);
