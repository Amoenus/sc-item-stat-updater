import fs from 'node:fs/promises';
import { extractGlobalIni } from '../../pipeline/extract';

export interface RefreshGlobalIniOptions {
  repoIniPath: string;
  p4kFile?: string;
  extract?: (p4kFile: string | undefined, log: (message: string) => void) => Promise<string>;
  copyFile?: (source: string, destination: string) => Promise<void>;
  log?: (message: string) => void;
}

export interface RefreshGlobalIniResult {
  extractedGamePath: string;
  repoIniPath: string;
}

export async function refreshGlobalIni(options: RefreshGlobalIniOptions): Promise<RefreshGlobalIniResult> {
  const log = options.log ?? (() => {});
  const extract = options.extract ?? extractGlobalIni;
  const copyFile = options.copyFile ?? fs.copyFile;

  let extractedGamePath: string;
  try {
    extractedGamePath = await extract(options.p4kFile, log);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Data\.p4k not found|SC_LIVE_DIR|LIVE directory/i.test(message)) {
      throw new Error(`Missing game install or Data.p4k: ${message}`);
    }
    throw new Error(`Failed to extract global.ini: ${message}`);
  }

  try {
    await copyFile(extractedGamePath, options.repoIniPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to refresh repo global.ini: ${message}`);
  }

  return { extractedGamePath, repoIniPath: options.repoIniPath };
}
