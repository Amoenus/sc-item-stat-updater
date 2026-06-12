import { spawn, spawnSync } from 'node:child_process';
import type fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

/**
 * Converts a path to a Windows-native path when running inside WSL.
 * Windows executables (.exe) cannot resolve /mnt/c/... paths — they need C:\...
 * On non-Linux platforms (win32, darwin) the path is returned unchanged.
 */
export function toWinPath(p: string): string {
  if (process.platform !== 'linux') return p;
  const result = spawnSync('wslpath', ['-w', p], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return p; // best-effort fallback
  return result.stdout.trim();
}

export interface Unp4kTools {
  unp4k: string;
  unforge: string;
}

async function getLatestUnp4kTag(): Promise<string> {
  const res = await fetch('https://github.com/dolkensp/unp4k/releases/latest', { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching latest release info`);
  const tag = res.url.split('/').at(-1);
  if (!tag || tag === 'latest') throw new Error('Could not resolve latest unp4k tag from redirect URL');
  return tag;
}

export async function findFile(dir: string, name: string): Promise<string | null> {
  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name === name) return path.join(dir, entry.name);
  }
  const subdirSearches = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => findFile(path.join(dir, entry.name), name));
  const results = await Promise.all(subdirSearches);
  return results.find((r) => r !== null) ?? null;
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  await fsp.writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

export function runTool(cmd: string, args: string[], opts: { cwd?: string; stdio?: 'inherit' | 'ignore' | 'pipe' } = {}): void {
  const winArgs = args.map(toWinPath);
  const winCwd = opts.cwd ? toWinPath(opts.cwd) : undefined;
  const stdio = opts.stdio ?? 'inherit';
  const result = spawnSync(cmd, winArgs, { stdio, cwd: winCwd });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(cmd)} exited with code ${result.status}`);
}

export async function runToolAsync(cmd: string, args: string[], opts: { cwd?: string; stdio?: 'inherit' | 'ignore' | 'pipe' } = {}): Promise<void> {
  const winArgs = args.map(toWinPath);
  const winCwd = opts.cwd ? toWinPath(opts.cwd) : undefined;
  const stdio = opts.stdio ?? 'inherit';

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, winArgs, { stdio, cwd: winCwd });

    child.on('error', (err: Error) => reject(err));
    child.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(`${path.basename(cmd)} exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Ensures that unp4k.exe and unforge.exe are installed in {@link toolDir},
 * downloading and extracting the latest release zip if needed.
 *
 * Follows the same installation pattern as extract-global-ini.ts:
 *  - toolDir/version.txt tracks the currently-installed release tag
 *  - If the tag matches the latest GitHub release, the download is skipped
 *  - Both tools come from the same unp4k-suite zip
 *
 * @returns Paths to unp4k.exe and unforge.exe
 */
export async function ensureToolsInstalled(toolDir: string, log: (msg: string) => void): Promise<Unp4kTools> {
  await fsp.mkdir(toolDir, { recursive: true });

  const zipPath = path.join(toolDir, 'unp4k.zip');
  const versionFile = path.join(toolDir, 'version.txt');

  let currentTag = '';
  try {
    currentTag = (await fsp.readFile(versionFile, 'utf8')).trim();
  } catch {
    // File likely doesn't exist; currentTag remains empty
  }

  log('Checking latest unp4k release...');
  let latestTag = currentTag;
  try {
    latestTag = await getLatestUnp4kTag();
  } catch (err) {
    if (currentTag) log(`Failed to check latest unp4k release, falling back to installed version ${currentTag}.`);
    else throw err;
  }

  const latestUrl = `https://github.com/dolkensp/unp4k/releases/download/${latestTag}/unp4k-suite-win-x64-${latestTag}.zip`;

  let [unp4kExe, unforgeExe] = await Promise.all([
    findFile(toolDir, 'unp4k.exe'),
    findFile(toolDir, 'unforge.cli.exe'),
  ]);

  if (!unp4kExe || !unforgeExe || currentTag !== latestTag) {
    log(`Downloading unp4k ${latestTag} ...`);
    await downloadToFile(latestUrl, zipPath);
    log('Extracting unp4k.zip ...');
    runTool('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${toolDir}'`,
    ]);
    [unp4kExe, unforgeExe] = await Promise.all([findFile(toolDir, 'unp4k.exe'), findFile(toolDir, 'unforge.cli.exe')]);
    if (!unp4kExe) throw new Error(`unp4k.exe not found after extraction in ${toolDir}`);
    if (!unforgeExe) throw new Error(`unforge.cli.exe not found after extraction in ${toolDir}`);
    await fsp.writeFile(versionFile, latestTag);
    log(`Tools installed at: ${toolDir}`);
  } else {
    log(`unp4k is already up-to-date (${currentTag}), skipping download.`);
  }

  return { unp4k: unp4kExe, unforge: unforgeExe };
}

/**
 * Resolves the Star Citizen LIVE directory using the same priority as extract-global-ini.ts:
 *  1. SC_LIVE_DIR environment variable (Windows or WSL/Unix path)
 *  2. Legacy fallback: 4 levels up from bin/ (only works when the repo lives inside the game tree)
 */
export function resolveLiveDir(binDirname: string): string {
  if (process.env.SC_LIVE_DIR) {
    const raw = process.env.SC_LIVE_DIR;
    if (raw.startsWith('/')) return raw;
    const winMatch = /^([A-Za-z]):[/\\](.*)/s.exec(raw);
    if (winMatch) {
      const drive = winMatch[1];
      const rest = winMatch[2].replaceAll('\\', '/');
      if (process.platform === 'win32') return `${drive}:/${rest}`;
      return `/mnt/${drive.toLowerCase()}/${rest}`;
    }
    return raw;
  }
  return path.resolve(binDirname, '..', '..', '..', '..');
}

/**
 * Attempts to read the SC build ID from explicit local version files.
 * Falls back to a Data.p4k timestamp marker if no reliable version file exists.
 */
export async function readGameVersion(liveDir: string): Promise<string> {
  for (const name of ['sc_version.id', 'version.id']) {
    const filePath = path.join(liveDir, name);
    try {
      const content = (await fsp.readFile(filePath, 'utf8')).trim();
      if (content) return content;
    } catch {
      // continue to next file
    }
  }

  try {
    const p4kStats = await fsp.stat(path.join(liveDir, 'Data.p4k'));
    return `local.${Math.round(p4kStats.mtimeMs)}`;
  } catch {
    return `local.${Date.now()}`;
  }
}
