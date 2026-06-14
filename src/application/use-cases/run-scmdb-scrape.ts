import fs from 'node:fs/promises';
import path from 'node:path';
import { toCsv } from '../../infrastructure/csv';
import {
  ScmdbCraftingBlueprintsSchema,
  ScmdbCraftingItemsSchema,
  ScmdbMemaCacheSchema,
  ScmdbMergedSchema,
  ScmdbMiningDataSchema,
  ScmdbVersionsSchema,
} from '../../schema/scmdb.schemas';
import {
  buildScmdbDataUrls,
  type FetchJson,
  fetchAndValidateScmdbJson,
  fetchScmdbJson,
  SCMDB_VERSIONS_URL,
} from '../../sources/scmdb/acquisition';
import { planScmdbOutputFiles } from '../../sources/scmdb/output-files';
import { buildScmdbOutputRows } from '../../sources/scmdb/outputs';
import { type ScmdbVersionEntry, selectScmdbVersion } from '../../sources/scmdb/version-selection';

export interface ScmdbWrittenFile {
  fileName: string;
  section: 'root' | 'missions';
  path: string;
}

export interface RunScmdbScrapeOptions {
  repoRoot: string;
  version?: string;
  ptu?: boolean;
  rawOnly?: boolean;
  fetchJson?: FetchJson;
  makeDir?: (dir: string) => Promise<void>;
  writeTextFile?: (filePath: string, content: string) => Promise<void>;
  onVersionSelected?: (version: ScmdbVersionEntry) => void;
  onFileWritten?: (file: ScmdbWrittenFile) => void;
  onWarning?: (message: string, error?: unknown) => void;
}

export interface RunScmdbScrapeResult {
  selected: ScmdbVersionEntry;
  outDir: string;
  missionsOutDir: string;
  files: ScmdbWrittenFile[];
}

export interface ScmdbRawDatasets {
  mergedRaw: unknown;
  miningRaw: unknown | null;
  craftingItemsRaw: unknown | null;
  craftingBlueprintsRaw: unknown | null;
  memaRaw: unknown | null;
}

export interface ScmdbScrapePlan {
  selectVersion(): Promise<ScmdbVersionEntry>;
  prepareOutputDirs(): Promise<{ outDir: string; missionsOutDir: string }>;
  fetchMergedDataset(): Promise<unknown>;
  fetchMiningDataset(): Promise<unknown | null>;
  fetchCraftingItemsDataset(): Promise<unknown | null>;
  fetchCraftingBlueprintsDataset(): Promise<unknown | null>;
  fetchMemaDataset(): Promise<unknown | null>;
  fetchRawDatasets(): Promise<ScmdbRawDatasets>;
  writeRawDatasets(): Promise<ScmdbWrittenFile[]>;
  writeDerivedOutputs(): Promise<ScmdbWrittenFile[]>;
  result(): RunScmdbScrapeResult;
}

export function createScmdbScrapePlan(options: RunScmdbScrapeOptions): ScmdbScrapePlan {
  const fetchJson = options.fetchJson;
  const makeDir = options.makeDir ?? ((dir) => fs.mkdir(dir, { recursive: true }).then(() => undefined));
  const writeTextFile = options.writeTextFile ?? fs.writeFile;
  let selected: ScmdbVersionEntry | undefined;
  let outDir: string | undefined;
  let missionsOutDir: string | undefined;
  const rawDatasets: Partial<ScmdbRawDatasets> = {};
  const writtenFiles: ScmdbWrittenFile[] = [];

  const requireSelected = (): ScmdbVersionEntry => {
    if (!selected) throw new Error('SCMDB version has not been selected.');
    return selected;
  };

  const requireOutputDirs = (): { outDir: string; missionsOutDir: string } => {
    if (!outDir || !missionsOutDir) throw new Error('SCMDB output directories have not been prepared.');
    return { outDir, missionsOutDir };
  };

  const writeOutput = async (fileName: string, content: string, section: 'root' | 'missions' = 'root') => {
    const dirs = requireOutputDirs();
    const baseDir = section === 'missions' ? dirs.missionsOutDir : dirs.outDir;
    const filePath = path.join(baseDir, fileName);
    await makeDir(path.dirname(filePath));
    await writeTextFile(filePath, content);
    const file = { fileName, section, path: filePath };
    writtenFiles.push(file);
    options.onFileWritten?.(file);
    return file;
  };

  return {
    async selectVersion() {
      if (selected) return selected;
      const versions = await fetchAndValidateScmdbJson(SCMDB_VERSIONS_URL, ScmdbVersionsSchema, fetchJson);
      selected = selectScmdbVersion(versions, { version: options.version, ptu: options.ptu ?? false });
      options.onVersionSelected?.(selected);
      return selected;
    },

    async prepareOutputDirs() {
      const version = requireSelected();
      if (outDir && missionsOutDir) return { outDir, missionsOutDir };
      outDir = path.join(options.repoRoot, 'csv', 'scmdb', version.version);
      missionsOutDir = path.join(outDir, 'missions');
      await makeDir(outDir);
      await makeDir(missionsOutDir);
      return { outDir, missionsOutDir };
    },

    async fetchMergedDataset() {
      const version = requireSelected();
      if (rawDatasets.mergedRaw !== undefined) return rawDatasets.mergedRaw;
      const { mergedUrl } = buildScmdbDataUrls(version.file);
      rawDatasets.mergedRaw = await fetchScmdbJson(mergedUrl, fetchJson);
      return rawDatasets.mergedRaw;
    },

    async fetchMiningDataset() {
      const version = requireSelected();
      if ('miningRaw' in rawDatasets) return rawDatasets.miningRaw ?? null;
      const { miningUrl } = buildScmdbDataUrls(version.file);
      rawDatasets.miningRaw = await fetchScmdbJson(miningUrl, fetchJson).catch(() => null);
      return rawDatasets.miningRaw;
    },

    async fetchCraftingItemsDataset() {
      const version = requireSelected();
      if ('craftingItemsRaw' in rawDatasets) return rawDatasets.craftingItemsRaw ?? null;
      const { craftingItemsUrl } = buildScmdbDataUrls(version.file);
      rawDatasets.craftingItemsRaw = await fetchScmdbJson(craftingItemsUrl, fetchJson).catch(() => null);
      return rawDatasets.craftingItemsRaw;
    },

    async fetchCraftingBlueprintsDataset() {
      const version = requireSelected();
      if ('craftingBlueprintsRaw' in rawDatasets) return rawDatasets.craftingBlueprintsRaw ?? null;
      const { craftingBlueprintsUrl } = buildScmdbDataUrls(version.file);
      rawDatasets.craftingBlueprintsRaw = await fetchScmdbJson(craftingBlueprintsUrl, fetchJson).catch(() => null);
      return rawDatasets.craftingBlueprintsRaw;
    },

    async fetchMemaDataset() {
      const version = requireSelected();
      if ('memaRaw' in rawDatasets) return rawDatasets.memaRaw ?? null;
      const { memaUrl } = buildScmdbDataUrls(version.file);
      rawDatasets.memaRaw = await fetchScmdbJson(memaUrl, fetchJson).catch((err: unknown) => {
        options.onWarning?.('Failed to fetch MEMA cache', err);
        return null;
      });
      return rawDatasets.memaRaw;
    },

    async fetchRawDatasets() {
      const [mergedRaw, miningRaw, craftingItemsRaw, craftingBlueprintsRaw, memaRaw] = await Promise.all([
        this.fetchMergedDataset(),
        this.fetchMiningDataset(),
        this.fetchCraftingItemsDataset(),
        this.fetchCraftingBlueprintsDataset(),
        this.fetchMemaDataset(),
      ]);
      return { mergedRaw, miningRaw, craftingItemsRaw, craftingBlueprintsRaw, memaRaw };
    },

    async writeRawDatasets() {
      const version = requireSelected();
      const raw = await this.fetchRawDatasets();
      const before = writtenFiles.length;
      const versionFile = version.file.replace('merged-', '');
      await writeOutput(version.file, JSON.stringify(raw.mergedRaw, null, 2));

      if (raw.miningRaw) {
        await writeOutput(`mining_data-${versionFile}`, JSON.stringify(raw.miningRaw, null, 2));
        await writeOutput('mining_data.json', JSON.stringify(raw.miningRaw, null, 2));
      }
      if (raw.craftingItemsRaw) {
        await writeOutput(`crafting_items-${versionFile}`, JSON.stringify(raw.craftingItemsRaw, null, 2));
      }
      if (raw.craftingBlueprintsRaw) {
        await writeOutput(`crafting_blueprints-${versionFile}`, JSON.stringify(raw.craftingBlueprintsRaw, null, 2));
      }
      if (raw.memaRaw) {
        await writeOutput('mema-cache.json', JSON.stringify(raw.memaRaw, null, 2));
      }

      return writtenFiles.slice(before);
    },

    async writeDerivedOutputs() {
      if (options.rawOnly) return [];
      const raw = await this.fetchRawDatasets();
      const before = writtenFiles.length;
      const mergedData = ScmdbMergedSchema.parse(raw.mergedRaw);
      const miningData = raw.miningRaw ? ScmdbMiningDataSchema.parse(raw.miningRaw) : null;
      const memaData = raw.memaRaw ? ScmdbMemaCacheSchema.parse(raw.memaRaw) : null;
      if (raw.craftingItemsRaw) ScmdbCraftingItemsSchema.parse(raw.craftingItemsRaw);
      if (raw.craftingBlueprintsRaw) ScmdbCraftingBlueprintsSchema.parse(raw.craftingBlueprintsRaw);

      const outputRows = buildScmdbOutputRows(mergedData, miningData, memaData);
      for (const outputFile of planScmdbOutputFiles(outputRows)) {
        await writeOutput(outputFile.fileName, toCsv(outputFile.rows, outputFile.headers), outputFile.section);
      }
      return writtenFiles.slice(before);
    },

    result() {
      const version = requireSelected();
      const dirs = requireOutputDirs();
      return {
        selected: version,
        outDir: dirs.outDir,
        missionsOutDir: dirs.missionsOutDir,
        files: writtenFiles,
      };
    },
  };
}

export async function runScmdbScrape(options: RunScmdbScrapeOptions): Promise<RunScmdbScrapeResult> {
  const plan = createScmdbScrapePlan(options);
  await plan.selectVersion();
  await plan.prepareOutputDirs();
  await plan.fetchRawDatasets();
  await plan.writeRawDatasets();
  await plan.writeDerivedOutputs();
  return plan.result();
}
