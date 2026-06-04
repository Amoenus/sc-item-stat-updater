import assert from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { resetStatBuilderWarnings, stat } from './stat-builder';

type StderrWrite = typeof process.stderr.write;

let capturedStderr: string[];
let originalStderrWrite: StderrWrite;

beforeEach(() => {
  resetStatBuilderWarnings();
  capturedStderr = [];
  originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    capturedStderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
    return true;
  }) as StderrWrite;
});

afterEach(() => {
  process.stderr.write = originalStderrWrite;
});

/** Joined stderr text limited to stat-builder warnings, to avoid noise from other logs. */
function statBuilderLog(): string {
  return capturedStderr.filter((s) => s.includes('stat-builder')).join('');
}

describe('stat-builder: column existence checks', () => {
  it('warns when .raw references a column missing from the row', () => {
    const row = { Health: '100' };
    stat(row).raw('Pool HP', 'Shield HP Pool').build('');
    const log = statBuilderLog();
    assert.match(log, /\[WARN\]/);
    assert.match(log, /method=raw/);
    assert.match(log, /label=Pool HP/);
    assert.match(log, /column=Shield HP Pool/);
  });

  it('warns when .num references a column missing from the row', () => {
    const row = { Health: '100' };
    stat(row).num('Damage', 'Damage Alpha').build('');
    const log = statBuilderLog();
    assert.match(log, /method=num/);
    assert.match(log, /column=Damage Alpha/);
  });

  it('warns when .rawIf references a column missing from the row', () => {
    const row = { Health: '100' };
    stat(row).rawIf('Regen', 'Reserve Regen Rate').build('');
    const log = statBuilderLog();
    assert.match(log, /method=rawIf/);
    assert.match(log, /column=Reserve Regen Rate/);
  });

  it('warns when .numIf references a column missing from the row', () => {
    const row = { Health: '100' };
    stat(row).numIf('Heat', 'Heat Per Shot').build('');
    const log = statBuilderLog();
    assert.match(log, /method=numIf/);
    assert.match(log, /column=Heat Per Shot/);
  });

  it('does not warn when the column is present, even if its value is empty', () => {
    const row = { 'Reserve Regen Rate': '', Health: '100' };
    stat(row)
      .raw('Health', 'Health')
      .rawIf('Reserve', 'Reserve Regen Rate')
      .numIf('Reserve Num', 'Reserve Regen Rate')
      .build('');
    assert.strictEqual(statBuilderLog(), '', 'expected no stat-builder warnings');
  });

  it('dedupes warnings so a typo logs once across many rows', () => {
    for (let i = 0; i < 5; i++) {
      stat({ Health: String(i) })
        .raw('Pool HP', 'Sheild HP Pool')
        .build('');
    }
    const matches = statBuilderLog().match(/column=Sheild HP Pool/g) ?? [];
    assert.strictEqual(matches.length, 1, 'expected one deduped warning across all rows');
  });

  it('does not check columns for literal-value methods (.line, .lineIf, .section)', () => {
    stat({}).line('Item Type', 'Shield Generator').lineIf('Class', 'A').section('-- Stats --').build('flavor text');
    assert.strictEqual(statBuilderLog(), '', 'literal-value methods should never warn');
  });

  it('still emits output for .raw even when the column is missing (back-compat)', () => {
    const row = { Health: '100' };
    const out = stat(row).raw('Pool HP', 'Shield HP Pool').build('');
    // The literal "undefined" still appears so callers can spot it in extracted
    // INI output. The new warning is the primary signal.
    assert.match(out, /Pool HP: undefined/);
  });

  it('skips .rawIf output when the column is missing (existing behavior)', () => {
    const row = { Health: '100' };
    const out = stat(row).raw('Health', 'Health').rawIf('Reserve', 'Reserve Regen Rate').build('');
    assert.doesNotMatch(out, /Reserve/);
  });
});
