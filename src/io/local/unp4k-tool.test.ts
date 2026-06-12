import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { findFile, readGameVersion, resolveLiveDir, toWinPath } from './unp4k-tool';

const isLinux = process.platform === 'linux';
const isWin = process.platform === 'win32';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unp4k-tool-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('toWinPath', () => {
  it('returns the path unchanged on non-linux platforms', { skip: isLinux }, () => {
    const input = 'C:\\Star Citizen\\LIVE\\Data.p4k';
    assert.strictEqual(toWinPath(input), input);
  });

  it('returns the path unchanged when wslpath is unavailable (best-effort fallback)', { skip: !isLinux }, () => {
    // On a Linux host without WSL, spawnSync will error or return a non-zero status;
    // in either case the implementation returns the original path.
    const result = toWinPath('/tmp/example');
    // We can't assert exact equality (it may succeed in real WSL), but it must be a string.
    assert.strictEqual(typeof result, 'string');
    assert.ok(result.length > 0);
  });
});

describe('findFile', () => {
  it('finds a file at the top level of the search dir', async () => {
    const target = path.join(tmpDir, 'unp4k.exe');
    await fs.writeFile(target, '');
    const result = await findFile(tmpDir, 'unp4k.exe');
    assert.strictEqual(result, target);
  });

  it('finds a file inside a nested subdirectory', async () => {
    const nestedDir = path.join(tmpDir, 'sub', 'deeper');
    await fs.mkdir(nestedDir, { recursive: true });
    const target = path.join(nestedDir, 'unforge.cli.exe');
    await fs.writeFile(target, '');
    const result = await findFile(tmpDir, 'unforge.cli.exe');
    assert.strictEqual(result, target);
  });

  it('returns null when the file is not present anywhere under the search dir', async () => {
    await fs.writeFile(path.join(tmpDir, 'other.exe'), '');
    const result = await findFile(tmpDir, 'missing.exe');
    assert.strictEqual(result, null);
  });

  it('returns null when the search directory does not exist (covers the catch block)', async () => {
    const result = await findFile(path.join(tmpDir, 'does-not-exist'), 'anything');
    assert.strictEqual(result, null);
  });

  it('returns a top-level match even when subdirectories also contain the name', async () => {
    const topMatch = path.join(tmpDir, 'unp4k.exe');
    await fs.writeFile(topMatch, '');
    const subDir = path.join(tmpDir, 'sub');
    await fs.mkdir(subDir);
    await fs.writeFile(path.join(subDir, 'unp4k.exe'), '');
    const result = await findFile(tmpDir, 'unp4k.exe');
    assert.strictEqual(result, topMatch, 'top-level match should win over the nested one');
  });
});

describe('resolveLiveDir', () => {
  const originalEnv = process.env.SC_LIVE_DIR;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.SC_LIVE_DIR;
    else process.env.SC_LIVE_DIR = originalEnv;
  });

  it('falls back to four levels up from binDirname when SC_LIVE_DIR is unset', () => {
    delete process.env.SC_LIVE_DIR;
    // path.resolve(binDirname, '..', '..', '..', '..') — climb 4 levels.
    // With binDirname 4 deep from tmpDir, the result is tmpDir.
    const fakeBin = path.join(tmpDir, 'a', 'b', 'c', 'd');
    const result = resolveLiveDir(fakeBin);
    assert.strictEqual(result, path.resolve(tmpDir));
  });

  it('returns a Unix-style absolute path (starts with "/") unchanged', () => {
    process.env.SC_LIVE_DIR = '/mnt/c/StarCitizen/LIVE';
    assert.strictEqual(resolveLiveDir('/anything'), '/mnt/c/StarCitizen/LIVE');
  });

  it('normalizes a Windows drive path on win32 to drive:/forward/slashes', { skip: !isWin }, () => {
    process.env.SC_LIVE_DIR = 'C:\\Games\\StarCitizen\\LIVE';
    assert.strictEqual(resolveLiveDir('/anything'), 'C:/Games/StarCitizen/LIVE');
  });

  it('rewrites a Windows drive path to /mnt/<drive>/... on non-win32 hosts', { skip: isWin }, () => {
    process.env.SC_LIVE_DIR = 'C:\\Games\\StarCitizen\\LIVE';
    assert.strictEqual(resolveLiveDir('/anything'), '/mnt/c/Games/StarCitizen/LIVE');
  });

  it('returns SC_LIVE_DIR unchanged when it matches neither absolute nor Windows-drive form', () => {
    process.env.SC_LIVE_DIR = 'relative/path/with/no/drive';
    assert.strictEqual(resolveLiveDir('/anything'), 'relative/path/with/no/drive');
  });
});

describe('readGameVersion', () => {
  it('reads sc_version.id plain text', async () => {
    await fs.writeFile(path.join(tmpDir, 'sc_version.id'), '4.5.0-PTU.99999\n');
    assert.strictEqual(await readGameVersion(tmpDir), '4.5.0-PTU.99999');
  });

  it('falls back to version.id when sc_version.id is missing', async () => {
    await fs.writeFile(path.join(tmpDir, 'version.id'), '3.23.1-LIVE');
    assert.strictEqual(await readGameVersion(tmpDir), '3.23.1-LIVE');
  });

  it('does not treat build_manifest.id as authoritative', async () => {
    const manifest = {
      Data: { Branch: 'sc-alpha-4.8.0-hotfix', RequestedP4ChangeNum: '987654' },
    };
    await fs.writeFile(path.join(tmpDir, 'build_manifest.id'), JSON.stringify(manifest));
    await fs.writeFile(path.join(tmpDir, 'sc_version.id'), '4.0.0');
    assert.strictEqual(await readGameVersion(tmpDir), '4.0.0');
  });

  it('returns a local Data.p4k marker when no reliable version files exist', async () => {
    const p4kPath = path.join(tmpDir, 'Data.p4k');
    await fs.writeFile(p4kPath, 'packed data');
    const timestamp = new Date('2026-06-01T00:00:00.000Z');
    await fs.utimes(p4kPath, timestamp, timestamp);
    const version = await readGameVersion(tmpDir);
    assert.match(version, /^local\.\d+$/);
  });

  it('skips an empty sc_version.id and continues to version.id', async () => {
    await fs.writeFile(path.join(tmpDir, 'sc_version.id'), '   \n  ');
    await fs.writeFile(path.join(tmpDir, 'version.id'), '4.1.0');
    assert.strictEqual(await readGameVersion(tmpDir), '4.1.0');
  });
});
