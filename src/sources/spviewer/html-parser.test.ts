import assert from 'node:assert/strict';
import test from 'node:test';
import { extractVersions, findPaginatorSelector, hasAllOption, parseTable } from './html-parser';

test('SPViewer HTML parser facade exposes legacy source parsing helpers', () => {
  const html = `
    <h6 class="logo-version">
      <span class="text-danger">4.8.0</span>
      <span class="text-warning">4.9.0</span>
    </h6>
    <div class="p-paginator-rpp-options"></div>
    <ul><li>All</li></ul>
    <table>
      <thead>
        <tr><th>Name</th><th>Size</th></tr>
      </thead>
      <tbody>
        <tr><td>CF-117 Bulldog</td><td>1</td></tr>
      </tbody>
    </table>
  `;

  assert.deepEqual(extractVersions(html), { live: '4.8.0', ptu: '4.9.0' });
  assert.equal(findPaginatorSelector(html), '.p-paginator-rpp-options');
  assert.equal(hasAllOption(html), true);
  assert.deepEqual(parseTable(html), {
    headers: ['Name', 'Size'],
    rows: [['CF-117 Bulldog', '1']],
  });
});
