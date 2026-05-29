import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { parseCSV, readCsvFile } from './csv-parser';

describe('parseCSV', () => {
  it('parses a basic CSV with a header row into objects', () => {
    const text = 'Name,Damage,Range\nLaser,100,500\nPlasma,200,300';
    const rows = parseCSV(text);
    assert.deepStrictEqual(rows, [
      { Name: 'Laser', Damage: '100', Range: '500' },
      { Name: 'Plasma', Damage: '200', Range: '300' },
    ]);
  });

  it('skips empty lines', () => {
    const text = 'A,B\n1,2\n\n\n3,4\n';
    const rows = parseCSV(text);
    assert.strictEqual(rows.length, 2);
    assert.deepStrictEqual(rows[0], { A: '1', B: '2' });
    assert.deepStrictEqual(rows[1], { A: '3', B: '4' });
  });

  it('trims surrounding whitespace from values', () => {
    const text = 'A,B\n  hello  ,  world  ';
    const rows = parseCSV(text);
    assert.deepStrictEqual(rows, [{ A: 'hello', B: 'world' }]);
  });

  it('tolerates rows with fewer columns than the header (relax_column_count)', () => {
    const text = 'A,B,C\n1,2\n4,5,6';
    const rows = parseCSV(text);
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0]['A'], '1');
    assert.strictEqual(rows[0]['B'], '2');
    assert.strictEqual(rows[1]['C'], '6');
  });

  it('returns an empty array for header-only CSV', () => {
    const rows = parseCSV('Name,Value');
    assert.deepStrictEqual(rows, []);
  });

  it('handles quoted fields containing commas', () => {
    const text = 'Name,Description\n"Foo, bar","baz, qux"';
    const rows = parseCSV(text);
    assert.deepStrictEqual(rows, [{ Name: 'Foo, bar', Description: 'baz, qux' }]);
  });

  it('tolerates stray double-quotes within fields (relax_quotes)', () => {
    // relax_quotes lets us parse mid-field bare quotes without throwing.
    const text = 'A,B\nhe said "hi",ok';
    const rows = parseCSV(text);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0]['B'], 'ok');
  });
});

describe('readCsvFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'csv-parser-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reads a CSV file from disk and parses it', async () => {
    const file = path.join(tmpDir, 'items.csv');
    await fs.writeFile(file, 'Name,Damage\nLaser,100\nPlasma,200');
    const rows = await readCsvFile(file);
    assert.deepStrictEqual(rows, [
      { Name: 'Laser', Damage: '100' },
      { Name: 'Plasma', Damage: '200' },
    ]);
  });

  it('rejects when the file does not exist', async () => {
    await assert.rejects(readCsvFile(path.join(tmpDir, 'missing.csv')), (err: NodeJS.ErrnoException) => {
      assert.strictEqual(err.code, 'ENOENT');
      return true;
    });
  });
});
