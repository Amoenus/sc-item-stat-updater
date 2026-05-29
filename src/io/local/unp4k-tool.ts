import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
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
  const tag = res.url.split('/').at(-1);
  if (!tag) throw new Error('Could not resolve latest unp4k tag from redirect URL');
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
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === name) return full;
    if (entry.isDirectory()) {
      const found = await findFile(full, name);
      if (found) return found;
    }
  }
  return null;
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  await fsp.writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

export function runTool(cmd: string, args: string[], opts: { cwd?: string } = {}): void {
  const winArgs = args.map(toWinPath);
  const winCwd = opts.cwd ? toWinPath(opts.cwd) : undefined;
  const result = spawnSync(cmd, winArgs, { stdio: 'inherit', cwd: winCwd });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(cmd)} exited with code ${result.status}`);
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

  log('Checking latest unp4k release...');
  const latestTag = await getLatestUnp4kTag();
  const latestUrl = `https://github.com/dolkensp/unp4k/releases/download/${latestTag}/unp4k-suite-win-x64-${latestTag}.zip`;

  let currentTag = '';
  try {
    currentTag = (await fsp.readFile(versionFile, 'utf8')).trim();
  } catch {
    // File likely doesn't exist; currentTag remains empty
  }

  let unp4kExe = await findFile(toolDir, 'unp4k.exe');
  let unforgeExe = await findFile(toolDir, 'unforge.cli.exe');

  if (!unp4kExe || !unforgeExe || currentTag !== latestTag) {
    log(`Downloading unp4k ${latestTag} ...`);
    await downloadToFile(latestUrl, zipPath);
    log('Extracting unp4k.zip ...');
    runTool('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${toolDir}'`,
    ]);
    unp4kExe = await findFile(toolDir, 'unp4k.exe');
    unforgeExe = await findFile(toolDir, 'unforge.cli.exe');
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
 * Attempts to read the SC build ID from a build manifest file in the LIVE directory.
 * Falls back to a timestamp string if the file is not found.
 */
export function readGameVersion(liveDir: string): string {
  // build_manifest.id contains JSON — extract a clean version tag from it.
  const manifestPath = path.join(liveDir, 'build_manifest.id');
  if (fs.existsSync(manifestPath)) {
    try {
      const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const data = json?.Data ?? json;
      // Branch looks like "sc-alpha-4.8.0-hotfix" → extract "4.8.0"
      const branch: string = data?.Branch ?? '';
      const versionMatch = /(\d+\.\d+\.\d+)/.exec(branch);
      const semver = versionMatch?.[1];
      const changeNum: string = data?.RequestedP4ChangeNum ?? '';
      if (semver && changeNum) return `${semver}.${changeNum}`;
      if (semver) return semver;
    } catch {
      // fall through to plain-text candidates
    }
  }

  // sc_version.id / version.id are plain-text version strings.
  for (const name of ['sc_version.id', 'version.id']) {
    const filePath = path.join(liveDir, name);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8').trim();
      if (content) return content;
    }
  }

  return new Date().toISOString().slice(0, 10).replaceAll('-', '');
}
