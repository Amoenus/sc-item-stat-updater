import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Normalises a raw path from SC_LIVE_DIR so the same value works on both
 * native Windows and WSL.
 *
 * - Unix path (/mnt/c/…)  → returned as-is.
 * - Windows path (C:\… or C:/…):
 *     • on win32  → forward-slash normalisation only
 *     • on WSL    → converted to /mnt/<drive>/…
 */
function normalizeGamePath(rawPath: string): string {
  // Already a Unix absolute path — use as-is.
  if (rawPath.startsWith('/')) return rawPath;

  // Windows absolute path: drive letter + colon + separator
  const winMatch = rawPath.match(/^([A-Za-z]):[/\\](.*)/s);
  if (winMatch) {
    const drive = winMatch[1];
    const rest = winMatch[2].replace(/\\/g, '/');
    if (process.platform === 'win32') {
      return `${drive}:/${rest}`;
    }
    // WSL / Linux — convert to /mnt/<drive>/…
    return `/mnt/${drive.toLowerCase()}/${rest}`;
  }

  // Relative or unrecognised — let path.resolve sort it out.
  return rawPath;
}

/**
 * Resolve the Star Citizen LIVE directory.
 *
 * Priority order:
 *  1. SC_LIVE_DIR environment variable (set via .env.local or shell profile).
 *     Accepts both Windows paths (C:\…) and Unix/WSL paths (/mnt/c/…).
 *  2. Legacy fallback: walk 4 levels up from bin/ — only works when the repo
 *     lives inside the game tree at LIVE/Data/Localization/english/
 */
function resolveLiveDir(): string {
  if (process.env.SC_LIVE_DIR) {
    return path.resolve(normalizeGamePath(process.env.SC_LIVE_DIR));
  }
  // Legacy: bin/ -> english/ -> Localization/ -> Data/ -> LIVE/
  return path.resolve(__dirname, '..', '..', '..', '..');
}

const LIVE_DIR = resolveLiveDir();

const FILTER = 'global.ini';

function log(msg: string): void {
  console.log(`[extract-global-ini] ${msg}`);
}

async function getLatestUnp4kTag(): Promise<string> {
  const res = await fetch('https://github.com/dolkensp/unp4k/releases/latest', { redirect: 'follow' });
  const tag = res.url.split('/').at(-1);
  if (!tag) throw new Error('Could not resolve latest unp4k tag from redirect URL');
  return tag;
}

async function findFile(dir: string, name: string): Promise<string | null> {
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

function run(cmd: string, args: string[], opts: { cwd?: string } = {}): void {
  const result = spawnSync(cmd, args, { stdio: 'inherit', cwd: opts.cwd });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(cmd)} exited with code ${result.status}`);
}

export async function extractGlobalIni(p4kFile?: string): Promise<string> {
  const resolvedP4k = p4kFile ?? path.join(LIVE_DIR, 'Data.p4k');
  const outputDir = path.dirname(resolvedP4k);
  const toolDir = path.join(outputDir, 'unp4k');
  const zipPath = path.join(toolDir, 'unp4k.zip');
  const versionFile = path.join(toolDir, 'version.txt');
  const resultPath = path.join(outputDir, 'Data', 'Localization', 'english', FILTER);

  if (!fs.existsSync(resolvedP4k)) {
    throw new Error(`Data.p4k not found at: ${resolvedP4k}`);
  }

  fs.mkdirSync(toolDir, { recursive: true });

  log('Checking latest unp4k release...');
  const latestTag = await getLatestUnp4kTag();
  const latestUrl = `https://github.com/dolkensp/unp4k/releases/download/${latestTag}/unp4k-win-x64-${latestTag}.zip`;

  const currentTag = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf8').trim() : '';
  let toolExe = await findFile(toolDir, 'unp4k.exe');

  if (!toolExe || currentTag !== latestTag) {
    log(`Downloading unp4k ${latestTag} ...`);
    await downloadToFile(latestUrl, zipPath);
    log('Extracting unp4k.zip ...');
    run('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${toolDir}'`,
    ]);
    toolExe = await findFile(toolDir, 'unp4k.exe');
    if (!toolExe) throw new Error(`unp4k.exe not found after extraction in ${toolDir}`);
    fs.writeFileSync(versionFile, latestTag);
    log(`unp4k installed at: ${toolDir}`);
  } else {
    log(`unp4k is already up-to-date (${currentTag}), skipping download.`);
    if (!toolExe) throw new Error(`unp4k.exe not found in ${toolDir} — delete version.txt to force re-download`);
  }

  log(`Extracting: ${FILTER}`);
  log(`  Source : ${resolvedP4k}`);
  log(`  Output : ${outputDir}`);

  if (fs.existsSync(resultPath)) {
    log('Removing existing global.ini before fresh extraction...');
    fs.rmSync(resultPath);
  }

  // unp4k extracts relative to cwd; run from outputDir
  run(toolExe, [resolvedP4k, FILTER], { cwd: outputDir });

  if (!fs.existsSync(resultPath)) {
    throw new Error(`Extraction completed but global.ini not found at: ${resultPath}`);
  }

  const { size } = fs.statSync(resultPath);
  log(`SUCCESS: global.ini extracted (${size} bytes)`);
  log(`  Path: ${resultPath}`);
  return resultPath;
}

// Run when invoked directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  extractGlobalIni(process.argv[2]).catch((err: Error) => {
    console.error(`[extract-global-ini] ERROR: ${err.message}`);
    process.exit(1);
  });
}
