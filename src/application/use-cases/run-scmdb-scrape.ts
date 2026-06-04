import fs from 'node:fs/promises';
import path from 'node:path';
import { toCsv } from '../../infrastructure/csv';
import {
  ScmdbCraftingBlueprintsSchema,
  ScmdbCraftingItemsSchema,
  ScmdbMergedSchema,
  ScmdbMiningDataSchema,
  ScmdbVersionsSchema,
} from '../../schema/scmdb.schemas';
import {
  buildScmdbDataUrls,
  fetchAndValidateScmdbJson,
  type FetchJson,
  fetchScmdbJson,
  SCMDB_VERSIONS_URL,
} from '../../sources/scmdb/acquisition';
import { planScmdbOutputFiles } from '../../sources/scmdb/output-files';
import { buildScmdbOutputRows } from '../../sources/scmdb/outputs';
import { selectScmdbVersion, type ScmdbVersionEntry } from '../../sources/scmdb/version-selection';

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
}

export interface RunScmdbScrapeResult {
  selected: ScmdbVersionEntry;
  outDir: string;
  missionsOutDir: string;
  files: ScmdbWrittenFile[];
}

export async function runScmdbScrape(options: RunScmdbScrapeOptions): Promise<RunScmdbScrapeResult> {
  const fetchJson = options.fetchJson;
  const makeDir = options.makeDir ?? ((dir) => fs.mkdir(dir, { recursive: true }).then(() => undefined));
  const writeTextFile = options.writeTextFile ?? fs.writeFile;

  const versions = await fetchAndValidateScmdbJson(SCMDB_VERSIONS_URL, ScmdbVersionsSchema, fetchJson);
  const selected = selectScmdbVersion(versions, { version: options.version, ptu: options.ptu ?? false });
  options.onVersionSelected?.(selected);

  const outDir = path.join(options.repoRoot, 'csv', 'scmdb', selected.version);
  const missionsOutDir = path.join(outDir, 'missions');
  await makeDir(outDir);
  await makeDir(missionsOutDir);

  const writtenFiles: ScmdbWrittenFile[] = [];
  const writeOutput = async (fileName: string, content: string, section: 'root' | 'missions' = 'root') => {
    const baseDir = section === 'missions' ? missionsOutDir : outDir;
    const filePath = path.join(baseDir, fileName);
    await makeDir(path.dirname(filePath));
    await writeTextFile(filePath, content);
    const file = { fileName, section, path: filePath };
    writtenFiles.push(file);
    options.onFileWritten?.(file);
  };

  const { mergedUrl, miningUrl, craftingItemsUrl, craftingBlueprintsUrl } = buildScmdbDataUrls(selected.file);
  const mergedRaw = await fetchScmdbJson(mergedUrl, fetchJson);
  await writeOutput(selected.file, JSON.stringify(mergedRaw, null, 2));

  const miningRaw = await fetchScmdbJson(miningUrl, fetchJson).catch(() => null);
  const craftingItemsRaw = await fetchScmdbJson(craftingItemsUrl, fetchJson).catch(() => null);
  const craftingBlueprintsRaw = await fetchScmdbJson(craftingBlueprintsUrl, fetchJson).catch(() => null);

  const versionFile = selected.file.replace('merged-', '');
  if (miningRaw) {
    await writeOutput(`mining_data-${versionFile}`, JSON.stringify(miningRaw, null, 2));
    await writeOutput('mining_data.json', JSON.stringify(miningRaw, null, 2));
  }
  if (craftingItemsRaw) {
    await writeOutput(`crafting_items-${versionFile}`, JSON.stringify(craftingItemsRaw, null, 2));
  }
  if (craftingBlueprintsRaw) {
    await writeOutput(`crafting_blueprints-${versionFile}`, JSON.stringify(craftingBlueprintsRaw, null, 2));
  }

  if (!options.rawOnly) {
    const mergedData = ScmdbMergedSchema.parse(mergedRaw);
    const miningData = miningRaw ? ScmdbMiningDataSchema.parse(miningRaw) : null;
    if (craftingItemsRaw) ScmdbCraftingItemsSchema.parse(craftingItemsRaw);
    if (craftingBlueprintsRaw) ScmdbCraftingBlueprintsSchema.parse(craftingBlueprintsRaw);

    const outputRows = buildScmdbOutputRows(mergedData, miningData);
    for (const outputFile of planScmdbOutputFiles(outputRows)) {
      await writeOutput(outputFile.fileName, toCsv(outputFile.rows, outputFile.headers), outputFile.section);
    }
  }

  return {
    selected,
    outDir,
    missionsOutDir,
    files: writtenFiles,
  };
}
