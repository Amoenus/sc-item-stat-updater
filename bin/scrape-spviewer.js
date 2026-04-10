#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

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
  // OTHER
];

const BASE_URL = 'https://www.spviewer.eu/items';

async function scrapeItems(itemType) {
  console.log(`Scraping ${itemType} from SPViewer...`);

  const browser = await puppeteer.launch({ headless: true });
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
      // PrimeVue DataTable uses a dropdown for page size
      const paginator = await page.$('.p-paginator-rpp-options, [class*="paginator"] select, .p-select');
      if (paginator) {
        await paginator.click();
        await new Promise((r) => setTimeout(r, 500));
        // Look for an "All" option or the largest page size
        const allOption = await page.$x("//li[contains(text(),'All') or contains(text(),'all')]");
        if (allOption.length) {
          await allOption[0].click();
        } else {
          // Click the last (largest) option
          const options = await page.$$('.p-select-option, .p-dropdown-item, .p-select-list li');
          if (options.length) await options[options.length - 1].click();
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch {
      /* pagination handling is best-effort */
    }

    // Small extra delay for any remaining render
    await new Promise((r) => setTimeout(r, 2000));

    // Extract headers and rows from the table
    const data = await page.evaluate(() => {
      const cleanHeader = (th) => {
        const clone = th.cloneNode(true);
        // Remove filter dropdowns/selects/menus
        for (const el of clone.querySelectorAll(
          'select, .p-select, .p-dropdown, .p-column-filter, [class*="filter"], .p-column-header-content > :not(span:first-child)',
        )) {
          el.remove();
        }
        // Get the first meaningful text (column name), stripping filter values
        let text = clone.textContent.trim();
        // Remove "AllXxx" suffixes left by filter dropdown option text
        text = text.replace(/All[\s\S]*$/, '').trim() || text.trim();
        return text;
      };

      const theadRows = [...document.querySelectorAll('table thead tr')];

      let headers = [];

      if (theadRows.length >= 2) {
        // Multi-row header: expand group row by colspan, merge with leaf row
        const groupCells = [...theadRows[0].querySelectorAll('th')];
        const leafCells = [...theadRows[theadRows.length - 1].querySelectorAll('th')];

        // Build expanded group names array (one per data column)
        const expanded = [];
        for (const th of groupCells) {
          const name = cleanHeader(th);
          const span = th.colSpan || 1;
          for (let i = 0; i < span; i++) expanded.push({ name, span });
        }

        // Merge: for colspan=1, use group name; for colspan>1, prefix leaf name
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

    return data;
  } finally {
    await browser.close();
  }
}

function toCsv({ headers, rows }) {
  const escape = (v) => {
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
  console.log(`Usage: node scrape-spviewer.js [itemType ...] [--list] [--json]

Item types: ${ITEM_TYPES.join(', ')}

Options:
  --list   List available item types
  --json   Output JSON instead of CSV
  --all    Scrape all item types

Examples:
  node scrape-spviewer.js Throwable
  node scrape-spviewer.js Radar Shield --json
  node scrape-spviewer.js --all`);
  process.exit(0);
}

if (args.includes('--list')) {
  console.log('Available item types:');
  for (const t of ITEM_TYPES) console.log(`  ${t}`);
  process.exit(0);
}

const useJson = args.includes('--json');
const useAll = args.includes('--all');
const types = useAll ? ITEM_TYPES : args.filter((a) => !a.startsWith('--'));

if (types.length === 0) {
  console.error('Error: specify at least one item type, or use --all');
  process.exit(1);
}

for (const itemType of types) {
  try {
    const data = await scrapeItems(itemType);
    console.log(`  Got ${data.rows.length} rows, ${data.headers.length} columns`);

    const outDir = join(__rootDir, 'csv', 'spviewer');
    const ext = useJson ? 'json' : 'csv';
    const filename = `${itemType.toLowerCase()}.spviewer.${ext}`;
    const outPath = join(outDir, filename);

    const content = useJson ? JSON.stringify(data, null, 2) : toCsv(data);

    writeFileSync(outPath, content, 'utf-8');
    console.log(`  Saved to csv/${filename}`);
  } catch (err) {
    console.error(`  Failed to scrape ${itemType}: ${err.message}`);
  }
}
