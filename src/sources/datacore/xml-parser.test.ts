import assert from 'node:assert/strict';
import test from 'node:test';
import { extractAttachDef, extractEntityClass, extractHealth, loadXml, xmlAttr, xmlVal } from './xml-parser';

test('DataCore XML parser facade exposes XML helpers and common normalization helpers', () => {
  const $ = loadXml(`
    <EntityClassDefinition.SHLD_AEGS_S04_Reclaimer_SCItem __path="libs/foundry/records/entities/scitem/ships/shieldgenerator/shld_aegs_s04_reclaimer_scitem.xml">
      <SAttachableComponentParams>
        <AttachDef size="4" grade="a" subtype="MILITARY">
          <Manufacturer name="AEGS" />
        </AttachDef>
      </SAttachableComponentParams>
      <SHealthComponentParams Health="1250" />
      <Power value="42" unit="MW" />
      <Label> Reclaimer Shield </Label>
    </EntityClassDefinition.SHLD_AEGS_S04_Reclaimer_SCItem>
  `);

  assert.equal(extractEntityClass($), 'shld_aegs_s04_reclaimer');
  assert.deepEqual(extractAttachDef($), {
    size: '4',
    grade: 'A',
    subtype: 'Military',
    manufacturer: 'AEGS',
  });
  assert.equal(extractHealth($), '1250');
  assert.equal(xmlVal($, 'Power'), '42');
  assert.equal(xmlVal($, 'Label'), 'Reclaimer Shield');
  assert.equal(xmlAttr($, 'Power', 'unit'), 'MW');
});
