import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import puppeteer from 'puppeteer';
import type { SpviewerScrapedDataDTO } from '../../schema/spviewer.schemas';
import {
  extractVersions,
  findDropdownOptionSelector,
  findPaginatorSelector,
  hasAllOption,
  parseTable,
} from '../../sources/spviewer/html-parser';

export const SPVIEWER_ITEM_TYPES = [
  'Bomb',
  'EMP',
  'Missile',
  'WeaponMining',
  'MiningModifier',
  'SalvageModifier',
  'TractorBeam',
  'WeaponGun',
  'MissileLauncher',
  'WeaponDefensive',
  'Turret',
  'Shield',
  'Cooler',
  'Radar',
  'SelfDestruct',
  'FlightController',
  'ShieldController',
  'PowerPlant',
  'QuantumDrive',
  'QuantumInterdictionGenerator',
  'JumpDrive',
  'WeaponPersonal',
  'WeaponAttachment',
  'Throwable',
] as const;

export const SPVIEWER_BASE_URL = 'https://www.spviewer.eu/items';

const PAGE_LOAD_TIMEOUT_MS = 60_000;
const TABLE_LOAD_TIMEOUT_MS = 90_000;
const PAGINATION_SETTLE_MS = 500;
const POST_PAGINATION_SETTLE_MS = 2000;

export interface SpviewerPage {
  goto(url: string, options: { waitUntil: 'networkidle2'; timeout: number }): Promise<unknown>;
  waitForFunction(pageFunction: () => boolean, options: { timeout: number }): Promise<unknown>;
  content(): Promise<string>;
  click(selector: string): Promise<unknown>;
  evaluate(pageFunction: () => void): Promise<unknown>;
  $$(selector: string): Promise<Array<{ click?: () => Promise<unknown> }>>;
  close(): Promise<void>;
}

export interface SpviewerBrowser {
  newPage(): Promise<SpviewerPage>;
  close(): Promise<void>;
}

export interface SpviewerWrittenFile {
  itemType: string;
  fileName: string;
  path: string;
  rows: number;
  columns: number;
}

export interface SpviewerScrapeTypeError {
  itemType: string;
  message: string;
}

export interface RunSpviewerScrapeOptions {
  repoRoot: string;
  ptu?: boolean;
  json?: boolean;
  types?: string[];
  launchBrowser?: () => Promise<SpviewerBrowser>;
  parseTable?: (html: string) => SpviewerScrapedDataDTO;
  extractVersions?: (html: string) => { live?: string; ptu?: string };
  makeDir?: (dir: string) => Promise<void>;
  writeTextFile?: (filePath: string, content: string) => Promise<void>;
  settle?: (ms: number) => Promise<void>;
  onVersionDetectStart?: (itemType: string) => void;
  onPrepared?: (context: { channel: 'live' | 'ptu'; version: string; outDir: string }) => void;
  onTypeStart?: (itemType: string) => void;
  onTypeScraped?: (itemType: string, data: SpviewerScrapedDataDTO) => void;
  onFileWritten?: (file: SpviewerWrittenFile) => void;
  onTypeError?: (error: SpviewerScrapeTypeError) => void;
}

export interface RunSpviewerScrapeResult {
  exitCode: number;
  channel: 'live' | 'ptu';
  version: string;
  outDir: string;
  types: string[];
  files: SpviewerWrittenFile[];
  errors: SpviewerScrapeTypeError[];
}

export async function runSpviewerScrape(options: RunSpviewerScrapeOptions): Promise<RunSpviewerScrapeResult> {
  const types = selectTypes(options.types ?? SPVIEWER_ITEM_TYPES.slice());
  const channel = options.ptu ? 'ptu' : 'live';
  const launchBrowser =
    options.launchBrowser ?? (async () => (await puppeteer.launch({ headless: true })) as unknown as SpviewerBrowser);
  const parse = options.parseTable ?? parseTable;
  const extractPageVersions = options.extractVersions ?? extractVersions;
  const makeDir = options.makeDir ?? ((dir) => fs.mkdir(dir, { recursive: true }).then(() => undefined));
  const writeTextFile = options.writeTextFile ?? fs.writeFile;
  const settle = options.settle ?? sleep;

  const browser = await launchBrowser();
  try {
    options.onVersionDetectStart?.(types[0]);
    const versionPage = await browser.newPage();
    let versionHtml: string;
    try {
      await versionPage.goto(`${SPVIEWER_BASE_URL}?item=${types[0]}`, {
        waitUntil: 'networkidle2',
        timeout: PAGE_LOAD_TIMEOUT_MS,
      });
      versionHtml = await versionPage.content();
    } finally {
      await versionPage.close();
    }

    const versions = extractPageVersions(versionHtml);
    const versionRaw = options.ptu ? versions.ptu : versions.live;
    if (!versionRaw) {
      throw new Error(
        `Could not detect ${channel.toUpperCase()} version from SPViewer page header.\n` +
          `Detected: LIVE=${versions.live ?? 'n/a'}, PTU=${versions.ptu ?? 'n/a'}\n` +
          `The page structure may have changed.`,
      );
    }

    const version = `${versionRaw}-${channel}`;
    const outDir = path.join(options.repoRoot, 'csv', 'spviewer', version);
    await makeDir(outDir);
    options.onPrepared?.({ channel, version, outDir });

    const files: SpviewerWrittenFile[] = [];
    const errors: SpviewerScrapeTypeError[] = [];

    for (const itemType of types) {
      options.onTypeStart?.(itemType);

      try {
        const data = await scrapeItems(browser, itemType, { parse, settle });
        options.onTypeScraped?.(itemType, data);

        const ext = options.json ? 'json' : 'csv';
        const fileName = `${itemType.toLowerCase()}.spviewer.${ext}`;
        const filePath = path.join(outDir, fileName);
        const content = options.json ? JSON.stringify(data, null, 2) : toCsv(data);
        await writeTextFile(filePath, content);

        const file = { itemType, fileName, path: filePath, rows: data.rows.length, columns: data.headers.length };
        files.push(file);
        options.onFileWritten?.(file);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const error = { itemType, message };
        errors.push(error);
        options.onTypeError?.(error);
      }
    }

    return { exitCode: 0, channel, version, outDir, types, files, errors };
  } finally {
    await browser.close();
  }
}

function selectTypes(types: string[]): string[] {
  if (types.length === 0) return SPVIEWER_ITEM_TYPES.slice();
  return types;
}

async function expandPaginatorToAll(page: SpviewerPage, settle: (ms: number) => Promise<void>): Promise<void> {
  try {
    const initialHtml = await page.content();
    const paginatorSelector = findPaginatorSelector(initialHtml);
    if (!paginatorSelector) return;

    await page.click(paginatorSelector);
    await settle(PAGINATION_SETTLE_MS);

    const expandedHtml = await page.content();
    if (hasAllOption(expandedHtml)) {
      await page.evaluate(() => {
        const items = document.querySelectorAll('li');
        for (const item of items) {
          if (/^all$/i.test(item.textContent?.trim() ?? '')) {
            (item as HTMLElement).click();
            return;
          }
        }
      });
    } else {
      const optionSelector = findDropdownOptionSelector(expandedHtml);
      if (optionSelector) {
        const options = await page.$$(optionSelector);
        if (options.length) await options.at(-1)?.click?.();
      }
    }
    await settle(POST_PAGINATION_SETTLE_MS);
  } catch {
    // Pagination handling is best-effort, matching the CLI's historical behavior.
  }
}

async function scrapeItems(
  browser: SpviewerBrowser,
  itemType: string,
  options: { parse: (html: string) => SpviewerScrapedDataDTO; settle: (ms: number) => Promise<void> },
): Promise<SpviewerScrapedDataDTO> {
  const page = await browser.newPage();

  try {
    await page.goto(`${SPVIEWER_BASE_URL}?item=${itemType}`, {
      waitUntil: 'networkidle2',
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    await page.waitForFunction(
      () => {
        const rows = document.querySelectorAll('table tbody tr');
        return rows.length > 0 && !rows[0].textContent?.includes('No data available');
      },
      { timeout: TABLE_LOAD_TIMEOUT_MS },
    );

    await expandPaginatorToAll(page, options.settle);
    await options.settle(POST_PAGINATION_SETTLE_MS);

    const html = await page.content();
    try {
      return options.parse(html);
    } catch (err) {
      const msg = err instanceof Error ? err.toString() : String(err);
      throw new Error(`SPViewer scraped data for ${itemType} failed schema validation:\n${msg}`);
    }
  } finally {
    await page.close();
  }
}

function toCsv({ headers, rows }: { headers: string[]; rows: string[][] }): string {
  const escapeVal = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replaceAll('"', '""')}"`;
    }
    return value;
  };
  const lines = [headers.map(escapeVal).join(','), ...rows.map((row) => row.map(escapeVal).join(','))];
  return `${lines.join('\n')}\n`;
}
