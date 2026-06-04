import fs from 'node:fs/promises';
import { backupIniFile } from '../../localization/ini-file';

export interface DeployGlobalIniOptions {
  repoIniPath: string;
  targetIniPath: string;
  copyFile?: (source: string, destination: string) => Promise<void>;
  backupIni?: typeof backupIniFile;
}

export interface DeployGlobalIniResult {
  repoIniPath: string;
  targetIniPath: string;
}

export async function deployGlobalIni(options: DeployGlobalIniOptions): Promise<DeployGlobalIniResult> {
  const copyFile = options.copyFile ?? fs.copyFile;
  const backupIni = options.backupIni ?? backupIniFile;

  try {
    await fs.stat(options.repoIniPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot deploy global.ini because the repo file is missing: ${message}`);
  }

  try {
    await backupIni(options.targetIniPath);
    await copyFile(options.repoIniPath, options.targetIniPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to deploy global.ini: ${message}`);
  }

  return { repoIniPath: options.repoIniPath, targetIniPath: options.targetIniPath };
}
