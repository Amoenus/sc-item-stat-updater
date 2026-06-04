import fs from 'node:fs/promises';
import path from 'node:path';
import { countDataCoreXmlFiles } from './xml-files';

export interface ExtractDataCoreXmlCacheOptions {
  dcbPath: string;
  xmlCacheDir: string;
  clearExisting?: boolean;
  runUnforge: (xmlCacheDir: string) => void;
}

export interface ExtractDataCoreXmlCacheResult {
  workDcbPath: string;
  monolithicXmlPath: string;
  xmlFileCount: number;
}

export async function extractDataCoreXmlCache(
  options: ExtractDataCoreXmlCacheOptions,
): Promise<ExtractDataCoreXmlCacheResult> {
  if (options.clearExisting) {
    await fs.rm(options.xmlCacheDir, { recursive: true, force: true });
  }

  await fs.mkdir(options.xmlCacheDir, { recursive: true });
  const workDcbPath = path.join(options.xmlCacheDir, path.basename(options.dcbPath));
  await fs.copyFile(options.dcbPath, workDcbPath);

  try {
    options.runUnforge(options.xmlCacheDir);
  } finally {
    await fs.rm(workDcbPath, { force: true });
    await fs.rm(workDcbPath.replace(/\.dcb$/i, '.xml'), { force: true });
  }

  return {
    workDcbPath,
    monolithicXmlPath: workDcbPath.replace(/\.dcb$/i, '.xml'),
    xmlFileCount: await countDataCoreXmlFiles(options.xmlCacheDir),
  };
}
