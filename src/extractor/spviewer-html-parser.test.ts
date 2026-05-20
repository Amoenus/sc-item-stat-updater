import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extractVersions,
  findDropdownOptionSelector,
  findPaginatorSelector,
  hasAllOption,
  parseTable,
} from './spviewer-html-parser';

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

test('findPaginatorSelector', async (t) => {
  await t.test('returns selector when .p-paginator-rpp-options is present', () => {
    const html = '<div class="p-paginator-rpp-options"></div>';
    assert.equal(findPaginatorSelector(html), '.p-paginator-rpp-options');
  });

  await t.test('returns selector when .p-select is present', () => {
    const html = '<div class="p-select"></div>';
    assert.equal(findPaginatorSelector(html), '.p-select');
  });

  await t.test('returns selector when paginator select is present', () => {
    const html = '<div class="p-paginator"><select></select></div>';
    assert.equal(findPaginatorSelector(html), '[class*="paginator"] select');
  });

  await t.test('returns null when no paginator is present', () => {
    const html = '<div class="content"><table></table></div>';
    assert.equal(findPaginatorSelector(html), null);
  });

  await t.test('prefers .p-paginator-rpp-options over .p-select when both present', () => {
    const html = '<div class="p-paginator-rpp-options"></div><div class="p-select"></div>';
    assert.equal(findPaginatorSelector(html), '.p-paginator-rpp-options');
  });
});

test('hasAllOption', async (t) => {
  await t.test('returns true when "All" option is present (exact match)', () => {
    const html = '<ul><li>10</li><li>25</li><li>All</li></ul>';
    assert.equal(hasAllOption(html), true);
  });

  await t.test('returns true for case-insensitive "all"', () => {
    const html = '<ul><li>10</li><li>all</li></ul>';
    assert.equal(hasAllOption(html), true);
  });

  await t.test('returns true for case-insensitive "ALL"', () => {
    const html = '<ul><li>ALL</li></ul>';
    assert.equal(hasAllOption(html), true);
  });

  await t.test('returns false when no "All" option is present', () => {
    const html = '<ul><li>10</li><li>25</li><li>50</li></ul>';
    assert.equal(hasAllOption(html), false);
  });

  await t.test('returns false when "All" is a substring but not the whole text', () => {
    const html = '<ul><li>Allow all</li></ul>';
    assert.equal(hasAllOption(html), false);
  });

  await t.test('returns false on empty HTML', () => {
    assert.equal(hasAllOption('<div></div>'), false);
  });
});

test('findDropdownOptionSelector', async (t) => {
  await t.test('returns .p-select-option when present', () => {
    const html = '<ul><li class="p-select-option">10</li></ul>';
    assert.equal(findDropdownOptionSelector(html), '.p-select-option');
  });

  await t.test('returns .p-dropdown-item when present', () => {
    const html = '<ul><li class="p-dropdown-item">10</li></ul>';
    assert.equal(findDropdownOptionSelector(html), '.p-dropdown-item');
  });

  await t.test('returns .p-select-list li when present', () => {
    const html = '<ul class="p-select-list"><li>10</li></ul>';
    assert.equal(findDropdownOptionSelector(html), '.p-select-list li');
  });

  await t.test('returns null when no known dropdown selectors match', () => {
    const html = '<ul><li>10</li></ul>';
    assert.equal(findDropdownOptionSelector(html), null);
  });

  await t.test('prefers .p-select-option over .p-dropdown-item when both present', () => {
    const html = '<li class="p-select-option">A</li><li class="p-dropdown-item">B</li>';
    assert.equal(findDropdownOptionSelector(html), '.p-select-option');
  });
});
