import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractVersions, parseTable } from './spviewer-html-parser.js';

test('extractVersions', async (t) => {
  await t.test('extracts LIVE and PTU versions', () => {
    const html = `
      <h6 class="logo-version">
        <span class="text-danger">4.7.2.11715810</span>
        <span class="text-warning opacity-5">4.8.0.11768487</span>
      </h6>
    `;
    const versions = extractVersions(html);
    assert.deepEqual(versions, { live: '4.7.2.11715810', ptu: '4.8.0.11768487' });
  });

  await t.test('handles missing versions', () => {
    const html = '<h6 class="logo-version"></h6>';
    const versions = extractVersions(html);
    assert.deepEqual(versions, { live: null, ptu: null });
  });
});

test('parseTable', async (t) => {
  await t.test('parses simple table', () => {
    const html = `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Item A</td>
            <td>1</td>
          </tr>
          <tr>
            <td>Item B</td>
            <td>2</td>
          </tr>
        </tbody>
      </table>
    `;
    const parsed = parseTable(html);
    assert.deepEqual(parsed.headers, ['Name', 'Size']);
    assert.deepEqual(parsed.rows, [
      ['Item A', '1'],
      ['Item B', '2'],
    ]);
  });

  await t.test('parses table with grouped headers', () => {
    const html = `
      <table>
        <thead>
          <tr>
            <th rowspan="2">General</th>
            <th colspan="2">Stats</th>
          </tr>
          <tr>
            <th>Speed</th>
            <th>Power</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Item A</td>
            <td>100</td>
            <td>50</td>
          </tr>
        </tbody>
      </table>
    `;
    const parsed = parseTable(html);
    assert.deepEqual(parsed.headers, ['General', 'Stats Speed', 'Stats Power']);
    assert.deepEqual(parsed.rows, [['Item A', '100', '50']]);
  });
});
