import fs from 'node:fs/promises';

export interface DeployGlobalIniOptions {
  repoIniPath: string;
  targetIniPath: string;
  copyFile?: (source: string, destination: string) => Promise<void>;
}

export interface DeployGlobalIniResult {
  repoIniPath: string;
  targetIniPath: string;
}

export async function deployGlobalIni(options: DeployGlobalIniOptions): Promise<DeployGlobalIniResult> {
  const copyFile = options.copyFile ?? fs.copyFile;

  try {
    await fs.stat(options.repoIniPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot deploy global.ini because the repo file is missing: ${message}`);
  }

  try {
    await copyFile(options.repoIniPath, options.targetIniPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to deploy global.ini: ${message}`);
  }

  return { repoIniPath: options.repoIniPath, targetIniPath: options.targetIniPath };
}
