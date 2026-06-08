import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultSpviewerBrowserLauncher,
  runSpviewerScrape,
  SPVIEWER_BASE_URL,
  type SpviewerBrowser,
  type SpviewerPage,
} from './run-spviewer-scrape';

class FakePage implements SpviewerPage {
  public gotos: string[] = [];
  public closed = false;

  constructor(private readonly html: string) {}

  async goto(url: string): Promise<void> {
    this.gotos.push(url);
  }

  async waitForFunction(): Promise<void> {}

  async content(): Promise<string> {
    return this.html;
  }

  async click(): Promise<void> {}

  async evaluate(): Promise<void> {}

  async $$(): Promise<Array<{ click?: () => Promise<unknown> }>> {
    return [];
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

class FakeBrowser implements SpviewerBrowser {
  public closed = false;
  public pages: FakePage[] = [];

  constructor(htmlPages: string[]) {
    this.pages = htmlPages.map((html) => new FakePage(html));
  }

  async newPage(): Promise<SpviewerPage> {
    const page = this.pages.shift();
    if (!page) throw new Error('No fake page available');
    return page;
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

test('runSpviewerScrape detects version, scrapes requested types, and writes CSV', async () => {
  const browser = new FakeBrowser(['version-html', 'shield-html']);
  const madeDirs: string[] = [];
  const writes: Array<{ path: string; content: string }> = [];
  const events: string[] = [];

  const result = await runSpviewerScrape({
    repoRoot: 'repo',
    types: ['Shield'],
    launchBrowser: async () => browser,
    extractVersions: (html) => {
      assert.equal(html, 'version-html');
      return { live: '4.8.1' };
    },
    parseTable: (html) => {
      assert.equal(html, 'shield-html');
      return {
        headers: ['Name', 'Power'],
        rows: [['Aegis Shield', '42']],
      };
    },
    settle: async () => {},
    makeDir: async (dir) => {
      madeDirs.push(dir);
    },
    writeTextFile: async (filePath, content) => {
      writes.push({ path: filePath, content });
    },
    onTypeStart: (itemType) => events.push(`start:${itemType}`),
    onTypeScraped: (itemType, data) => events.push(`scraped:${itemType}:${data.rows.length}`),
    onFileWritten: (file) => events.push(`written:${file.fileName}`),
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.version, '4.8.1-live');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.files.map((file) => file.fileName),
    ['shield.spviewer.csv'],
  );
  assert.deepEqual(madeDirs, ['repo\\csv\\spviewer\\4.8.1-live']);
  assert.deepEqual(writes, [
    {
      path: 'repo\\csv\\spviewer\\4.8.1-live\\shield.spviewer.csv',
      content: 'Name,Power\nAegis Shield,42\n',
    },
  ]);
  assert.deepEqual(events, ['start:Shield', 'scraped:Shield:1', 'written:shield.spviewer.csv']);
  assert.equal(browser.closed, true);
});

test('runSpviewerScrape records per-type scrape errors without failing the whole run', async () => {
  const browser = new FakeBrowser(['version-html', 'bad-html']);
  const errors: string[] = [];

  const result = await runSpviewerScrape({
    repoRoot: 'repo',
    types: ['Radar'],
    launchBrowser: async () => browser,
    extractVersions: () => ({ live: '4.8.1' }),
    parseTable: () => {
      throw new Error('schema changed');
    },
    settle: async () => {},
    makeDir: async () => {},
    writeTextFile: async () => {
      throw new Error('should not write after parse failure');
    },
    onTypeError: (error) => errors.push(`${error.itemType}:${error.message}`),
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.files, []);
  assert.match(result.errors[0].message, /SPViewer scraped data for Radar failed schema validation/);
  assert.match(errors[0], /Radar:SPViewer scraped data for Radar failed schema validation/);
  assert.equal(browser.closed, true);
});

test('runSpviewerScrape closes the browser when version detection fails', async () => {
  const browser = new FakeBrowser(['version-html']);

  await assert.rejects(
    () =>
      runSpviewerScrape({
        repoRoot: 'repo',
        types: ['Shield'],
        launchBrowser: async () => browser,
        extractVersions: () => ({}),
      }),
    /Could not detect LIVE version/,
  );

  assert.equal(browser.closed, true);
});

test('runSpviewerScrape uses the requested item type in SPViewer URLs', async () => {
  const browser = new FakeBrowser(['version-html', 'cooler-html']);
  const pages: FakePage[] = [];
  const originalNewPage = browser.newPage.bind(browser);
  browser.newPage = async () => {
    const page = (await originalNewPage()) as FakePage;
    pages.push(page);
    return page;
  };

  await runSpviewerScrape({
    repoRoot: 'repo',
    types: ['Cooler'],
    launchBrowser: async () => browser,
    extractVersions: () => ({ live: '4.8.1' }),
    parseTable: () => ({ headers: ['Name'], rows: [['Cooler']] }),
    settle: async () => {},
    makeDir: async () => {},
    writeTextFile: async () => {},
  });

  assert.equal(pages[0].gotos[0], `${SPVIEWER_BASE_URL}?item=Cooler`);
  assert.equal(pages[1].gotos[0], `${SPVIEWER_BASE_URL}?item=Cooler`);
});

test('default SPViewer browser launcher reports missing optional Puppeteer clearly', async () => {
  const missingPackageError = new Error("Cannot find package 'puppeteer'");
  Object.assign(missingPackageError, { code: 'ERR_MODULE_NOT_FOUND' });
  const launchBrowser = createDefaultSpviewerBrowserLauncher(async () => {
    throw missingPackageError;
  });

  await assert.rejects(
    launchBrowser,
    /SPViewer scraping requires the optional "puppeteer" dependency\. Install optional dependencies/,
  );
});

test('default SPViewer browser launcher loads Puppeteer only when invoked', async () => {
  let imported = false;
  const browser = new FakeBrowser([]);
  const launchBrowser = createDefaultSpviewerBrowserLauncher(async () => {
    imported = true;
    return {
      launch: async (options) => {
        assert.deepEqual(options, { headless: true });
        return browser;
      },
    };
  });

  assert.equal(imported, false);
  assert.equal(await launchBrowser(), browser);
  assert.equal(imported, true);
});
