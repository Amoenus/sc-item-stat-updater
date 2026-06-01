import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractEntityClass, loadXml } from './datacore-xml-parser.js';

test('extractEntityClass', async (t) => {
  await t.test('extracts from __path attribute', () => {
    const xml = `<EntityClassDefinition __path="libs/foundry/records/entities/scitem/ships/shieldgenerator/shld_aegs_s04_reclaimer_scitem.xml"></EntityClassDefinition>`;
    const $ = loadXml(xml);
    const className = extractEntityClass($);
    assert.strictEqual(className, 'shld_aegs_s04_reclaimer');
  });

  await t.test('extracts from fallback tag name when __path is missing', () => {
    const xml = `<EntityClassDefinition.SHLD_AEGS_S04_Reclaimer_SCItem></EntityClassDefinition.SHLD_AEGS_S04_Reclaimer_SCItem>`;
    const $ = loadXml(xml);
    const className = extractEntityClass($);
    assert.strictEqual(className, 'SHLD_AEGS_S04_Reclaimer_SCItem');
  });

  await t.test('extracts from fallback tag name when __path is missing and there is no dot', () => {
    const xml = `<SHLD_AEGS_S04_Reclaimer_SCItem></SHLD_AEGS_S04_Reclaimer_SCItem>`;
    const $ = loadXml(xml);
    const className = extractEntityClass($);
    assert.strictEqual(className, 'SHLD_AEGS_S04_Reclaimer_SCItem');
  });

  await t.test('handles empty xml gracefully', () => {
    const xml = ``;
    const $ = loadXml(xml);
    const className = extractEntityClass($);
    assert.strictEqual(className, '');
  });
});
