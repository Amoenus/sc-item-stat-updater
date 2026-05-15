import assert from 'node:assert';
import { describe, it, mock } from 'node:test';
import { getLogger } from './logger.js';
import { validateRow } from './updater.js';

describe('updater: validateRow', () => {
  it('should return "valid" for a valid localization key', () => {
    const row = { 'Localization Key': 'item_name_01' };
    const result = validateRow(row, 'test-label');
    assert.strictEqual(result, 'valid');
  });

  it('should return "skip" if localization key is missing', () => {
    const row = {};
    const result = validateRow(row, 'test-label');
    assert.strictEqual(result, 'skip');
  });

  it('should return "skip" if localization key is "N/A"', () => {
    const row = { 'Localization Key': 'N/A' };
    const result = validateRow(row, 'test-label');
    assert.strictEqual(result, 'skip');
  });

  it('should return "invalid" and log a debug message for invalid keys', () => {
    const logger = getLogger('updater');
    const debugMock = mock.method(logger, 'debug', () => {});

    const row = { 'Localization Key': 'invalid key!' };
    const result = validateRow(row, 'test-label');

    assert.strictEqual(result, 'invalid');
    assert.strictEqual(debugMock.mock.callCount(), 1);
    const call = debugMock.mock.calls[0];
    assert.strictEqual(call.arguments[0], 'Invalid localization key, skipping row');
    assert.deepStrictEqual(call.arguments[1], { label: 'test-label', key: 'invalid key!' });

    debugMock.restore();
  });

  it('should accept keys with dots and hyphens', () => {
    const row = { 'Localization Key': 'item.name-01' };
    const result = validateRow(row, 'test-label');
    assert.strictEqual(result, 'valid');
  });
});
