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

  await t.test('preserves exact leaf order for each group (Min before Max when DOM says so)', () => {
    // Mirrors a real SPViewer table where one group has [Max, Min] and another has [Min, Max].
    // The parser must reflect the actual DOM order, not reorder it.
    const html = `
      <table>
        <thead>
          <tr>
            <th rowspan="2">Name</th>
            <th colspan="2">Laser Power</th>
            <th colspan="2">Cooling Usage</th>
          </tr>
          <tr>
            <th>Max</th>
            <th>Min</th>
            <th>Min</th>
            <th>Max</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Arbor MH1</td>
            <td>1890</td>
            <td>94.5</td>
            <td>5</td>
            <td>50</td>
          </tr>
        </tbody>
      </table>
    `;
    const parsed = parseTable(html);
    assert.deepEqual(parsed.headers, [
      'Name',
      'Laser Power Max',
      'Laser Power Min',
      'Cooling Usage Min',
      'Cooling Usage Max',
    ]);
    assert.deepEqual(parsed.rows, [['Arbor MH1', '1890', '94.5', '5', '50']]);
  });

  await t.test('handles many rowspan single-column headers before grouped columns', () => {
    // Mirrors the full SPViewer structure: several standalone columns (Size, Name, ...)
    // followed by multi-column groups. Single columns use rowspan=2.
    const html = `
      <table>
        <thead>
          <tr>
            <th rowspan="2">Size</th>
            <th rowspan="2">Name</th>
            <th rowspan="2">Manufacturer</th>
            <th colspan="2">Laser Power</th>
            <th colspan="2">Range Power</th>
          </tr>
          <tr>
            <th>Max</th>
            <th>Min</th>
            <th>Max</th>
            <th>Min</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>Arbor MH1</td>
            <td>MISC</td>
            <td>1890</td>
            <td>94.5</td>
            <td>60</td>
            <td>180</td>
          </tr>
        </tbody>
      </table>
    `;
    const parsed = parseTable(html);
    assert.deepEqual(parsed.headers, [
      'Size',
      'Name',
      'Manufacturer',
      'Laser Power Max',
      'Laser Power Min',
      'Range Power Max',
      'Range Power Min',
    ]);
    assert.deepEqual(parsed.rows, [['1', 'Arbor MH1', 'MISC', '1890', '94.5', '60', '180']]);
  });
});
