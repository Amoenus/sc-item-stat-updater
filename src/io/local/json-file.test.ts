import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { readJsonFile, readJsonRelative } from './json-file';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'json-file-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('readJsonFile', () => {
  it('parses a valid JSON object', async () => {
    const file = path.join(tmpDir, 'good.json');
    await fs.writeFile(file, '{"name":"x","count":3}');
    const result = await readJsonFile(file);
    assert.deepStrictEqual(result, { name: 'x', count: 3 });
  });

  it('parses a valid JSON array', async () => {
    const file = path.join(tmpDir, 'arr.json');
    await fs.writeFile(file, '[1,2,3]');
    const result = await readJsonFile(file);
    assert.deepStrictEqual(result, [1, 2, 3]);
  });

  it('throws a wrapped error when JSON is malformed (covers the catch block)', async () => {
    const file = path.join(tmpDir, 'bad.json');
    await fs.writeFile(file, '{not valid json');
    await assert.rejects(readJsonFile(file), (err: Error) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /^Invalid JSON file: /, 'default label should appear in error');
      return true;
    });
  });

  it('uses the provided label in the error message', async () => {
    const file = path.join(tmpDir, 'bad.json');
    await fs.writeFile(file, 'not json at all');
    await assert.rejects(readJsonFile(file, 'item manifest'), (err: Error) => {
      assert.match(err.message, /^Invalid item manifest: /);
      return true;
    });
  });

  it('propagates filesystem errors (file not found) without wrapping', async () => {
    const missing = path.join(tmpDir, 'does-not-exist.json');
    await assert.rejects(readJsonFile(missing), (err: NodeJS.ErrnoException) => {
      assert.strictEqual(err.code, 'ENOENT', 'ENOENT bubbles up unmodified');
      return true;
    });
  });
});

describe('readJsonRelative', () => {
  it('resolves the path relative to the calling module URL and parses', async () => {
    const file = path.join(tmpDir, 'data.json');
    await fs.writeFile(file, '{"ok":true}');
    // Simulate a module living in tmpDir; ask for ./data.json from there.
    const fakeModuleUrl = pathToFileURL(path.join(tmpDir, 'caller.ts')).href;
    const result = await readJsonRelative(fakeModuleUrl, './data.json');
    assert.deepStrictEqual(result, { ok: true });
  });

  it('uses relativePath as the default label in error messages', async () => {
    const file = path.join(tmpDir, 'broken.json');
    await fs.writeFile(file, '{not json');
    const fakeModuleUrl = pathToFileURL(path.join(tmpDir, 'caller.ts')).href;
    await assert.rejects(readJsonRelative(fakeModuleUrl, './broken.json'), (err: Error) => {
      assert.match(err.message, /^Invalid \.\/broken\.json: /);
      return true;
    });
  });
});
