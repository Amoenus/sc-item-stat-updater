import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { buildLookupMap, loadMappingFile, saveMappingFile } from './mapping-store';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mapping-store-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('loadMappingFile', () => {
  it('loads an existing mapping into a Map', async () => {
    const file = path.join(tmpDir, 'mapping.json');
    await fs.writeFile(file, JSON.stringify({ 'Laser Cannon': 'item_Name_laser', 'Shield Gen': 'item_Name_shield' }));
    const map = await loadMappingFile(file);
    assert.strictEqual(map.size, 2);
    assert.strictEqual(map.get('Laser Cannon'), 'item_Name_laser');
    assert.strictEqual(map.get('Shield Gen'), 'item_Name_shield');
  });

  it('returns an empty Map when the file does not exist (ENOENT path)', async () => {
    const map = await loadMappingFile(path.join(tmpDir, 'never-created.json'));
    assert.strictEqual(map.size, 0);
  });

  it('returns an empty Map when the JSON is malformed (logged but not thrown)', async () => {
    const file = path.join(tmpDir, 'broken.json');
    await fs.writeFile(file, '{not valid json');
    const map = await loadMappingFile(file);
    assert.strictEqual(map.size, 0);
  });

  it('returns an empty Map for an empty JSON object', async () => {
    const file = path.join(tmpDir, 'empty.json');
    await fs.writeFile(file, '{}');
    const map = await loadMappingFile(file);
    assert.strictEqual(map.size, 0);
  });
});

describe('saveMappingFile', () => {
  it('writes the mapping as sorted JSON with a trailing newline', async () => {
    const file = path.join(tmpDir, 'out.json');
    const map = new Map([
      ['Zeta', 'item_Name_z'],
      ['Alpha', 'item_Name_a'],
      ['Mu', 'item_Name_m'],
    ]);
    await saveMappingFile(file, map);
    const written = await fs.readFile(file, 'utf-8');
    assert.ok(written.endsWith('\n'), 'should end with a newline');
    // Keys must be alphabetically ordered in the serialized output.
    const aIdx = written.indexOf('Alpha');
    const mIdx = written.indexOf('Mu');
    const zIdx = written.indexOf('Zeta');
    assert.ok(aIdx < mIdx && mIdx < zIdx, 'keys should be sorted alphabetically');
    const parsed = JSON.parse(written);
    assert.deepStrictEqual(parsed, { Alpha: 'item_Name_a', Mu: 'item_Name_m', Zeta: 'item_Name_z' });
  });

  it('creates parent directories that do not yet exist', async () => {
    const file = path.join(tmpDir, 'nested', 'sub', 'out.json');
    await saveMappingFile(file, new Map([['A', 'item_Name_a']]));
    const parsed = JSON.parse(await fs.readFile(file, 'utf-8'));
    assert.deepStrictEqual(parsed, { A: 'item_Name_a' });
  });

  it('writes an empty object for an empty Map', async () => {
    const file = path.join(tmpDir, 'empty.json');
    await saveMappingFile(file, new Map());
    const written = await fs.readFile(file, 'utf-8');
    assert.strictEqual(written, '{}\n');
  });

  it('round-trips through loadMappingFile', async () => {
    const file = path.join(tmpDir, 'roundtrip.json');
    const original = new Map([
      ['Foo', 'item_Name_foo'],
      ['Bar', 'item_Name_bar'],
    ]);
    await saveMappingFile(file, original);
    const loaded = await loadMappingFile(file);
    assert.strictEqual(loaded.size, original.size);
    for (const [k, v] of original) {
      assert.strictEqual(loaded.get(k), v);
    }
  });
});

describe('buildLookupMap', () => {
  it('maps both Name and Localization Display Name to the Localization Key', async () => {
    const csv = path.join(tmpDir, 'lookup.csv');
    await fs.writeFile(
      csv,
      [
        'Name,Localization Display Name,Localization Key',
        'Laser MK1,Laser Mark I,item_Name_laser_mk1',
        'Plasma X,Plasma Ten,item_Name_plasma_x',
      ].join('\n'),
    );
    const map = await buildLookupMap(csv);
    assert.strictEqual(map.get('Laser MK1'), 'item_Name_laser_mk1');
    assert.strictEqual(map.get('Laser Mark I'), 'item_Name_laser_mk1');
    assert.strictEqual(map.get('Plasma X'), 'item_Name_plasma_x');
    assert.strictEqual(map.get('Plasma Ten'), 'item_Name_plasma_x');
  });

  it('skips rows whose Localization Key is empty or "N/A"', async () => {
    const csv = path.join(tmpDir, 'lookup.csv');
    await fs.writeFile(
      csv,
      [
        'Name,Localization Display Name,Localization Key',
        'Has Key,Display Has Key,item_Name_keep',
        'No Key,Display No Key,',
        'Marked NA,Display NA,N/A',
      ].join('\n'),
    );
    const map = await buildLookupMap(csv);
    assert.strictEqual(map.get('Has Key'), 'item_Name_keep');
    assert.strictEqual(map.has('No Key'), false);
    assert.strictEqual(map.has('Display No Key'), false);
    assert.strictEqual(map.has('Marked NA'), false);
    assert.strictEqual(map.has('Display NA'), false);
  });

  it('does not add an empty Name or empty Display Name key', async () => {
    const csv = path.join(tmpDir, 'lookup.csv');
    await fs.writeFile(
      csv,
      [
        'Name,Localization Display Name,Localization Key',
        ',Only Display,item_Name_only_display',
        'Only Name,,item_Name_only_name',
      ].join('\n'),
    );
    const map = await buildLookupMap(csv);
    assert.strictEqual(map.has(''), false, 'empty string should never be inserted');
    assert.strictEqual(map.get('Only Display'), 'item_Name_only_display');
    assert.strictEqual(map.get('Only Name'), 'item_Name_only_name');
  });

  it('returns an empty Map when no rows have keys', async () => {
    const csv = path.join(tmpDir, 'lookup.csv');
    await fs.writeFile(csv, 'Name,Localization Display Name,Localization Key\n');
    const map = await buildLookupMap(csv);
    assert.strictEqual(map.size, 0);
  });
});
