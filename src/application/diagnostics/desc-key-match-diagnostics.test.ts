import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ItemConfig } from '../../enrichment/item-config';
import { listCategories, loadConfig } from '../../items/registry';
import {
  type DescKeyMatchConfig,
  findDescKeyMatchOverlaps,
  logDescKeyMatchOverlaps,
} from './desc-key-match-diagnostics';

type Provider = keyof Awaited<ReturnType<typeof listCategories>>;

const samplesBySlug: Record<string, { positive: string[]; negative: string[] }> = {
  'dc-bombs': { positive: ['item_DescBOMB_AEGS_S01_Test'], negative: ['item_Desc_COOL_ACOM_S01_Test'] },
  'dc-coolers': { positive: ['item_Desc_COOL_ACOM_S01_Test'], negative: ['item_DescPOWR_AMRS_S1_Test'] },
  'dc-emps': { positive: ['item_Desc_EMP_Device_Test'], negative: ['item_Desc_QDRV_RSI_Test'] },
  'dc-jump-drives': { positive: ['item_Desc_JDRV_RSI_Test'], negative: ['item_DescSHLD_AEGS_Test'] },
  'dc-mining-lasers': { positive: ['item_mininglaser_head_helix_desc'], negative: ['item_DescMISC_Test'] },
  'dc-mining-modifiers': {
    positive: ['item_mining_modules_focus_desc'],
    negative: ['item_Desc_COOL_ACOM_S01_Test'],
  },
  'dc-missile-launchers': { positive: ['item_DescMRCK_RSI_S01_Test'], negative: ['item_DescMISL_RSI_Test'] },
  'dc-missiles': { positive: ['item_DescMISL_RSI_Test'], negative: ['item_DescMRCK_RSI_S01_Test'] },
  'dc-powerplants': { positive: ['item_DescPOWR_AMRS_S1_Test'], negative: ['item_Desc_COOL_ACOM_S01_Test'] },
  'dc-qeds': { positive: ['item_DescQDMP_RSI_Test'], negative: ['item_DescQDRV_RSI_Test'] },
  'dc-quantum-drives': { positive: ['item_DescQDRV_RSI_Test'], negative: ['item_DescQDMP_RSI_Test'] },
  'dc-radars': { positive: ['item_Desc_RADR_RSI_Test'], negative: ['item_DescQDRV_RSI_Test'] },
  'dc-salvage-modifiers': { positive: ['item_scraper_trawler_desc'], negative: ['item_DescTRACTORBEAM_Test'] },
  'dc-self-destruct': { positive: ['item_Desc_SelfDestruct_Charge_Test'], negative: ['item_Desc_EMP_Test'] },
  'dc-shields': { positive: ['item_DescSHLD_AEGS_Test'], negative: ['item_DescPOWR_AMRS_S1_Test'] },
  'dc-throwables': { positive: ['item_Desc_Grenade_Frag_Test'], negative: ['item_Desc_Rifle_Test'] },
  'dc-tractor-beams': { positive: ['item_Desc_TractorBeam_Module_Test'], negative: ['item_Desc_Turret_Test'] },
  'dc-turrets': { positive: ['item_Desc_Turret_Ball_Test'], negative: ['item_Desc_TractorBeam_Test'] },
  'dc-weapon-attachments': { positive: ['item_Desc_Barrel_Stabilizer_Test'], negative: ['item_Desc_Rifle_Test'] },
  'dc-weapon-defensive': { positive: ['item_Desc_Chaff_Countermeasure_Test'], negative: ['item_Desc_Rifle_Test'] },
  'dc-weapon-guns': { positive: ['item_DescBEHR_LaserRepeater_Test'], negative: ['item_Desc_COOL_ACOM_Test'] },
  'dc-weapon-personal': { positive: ['item_Desc_GMNI_Rifle_Test'], negative: ['item_Desc_Barrel_Test'] },
  'mission-commodities': { positive: ['items_commodities_agricium_desc'], negative: ['item_Desc_COOL_Test'] },
  'mission-mining-elements': {
    positive: ['items_commodities_agricium_ore_desc'],
    negative: ['items_commodities_agricium_desc'],
  },
  'mission-mining-locations': {
    positive: ['stanton_area18_mining_desc'],
    negative: ['items_commodities_agricium_desc'],
  },
  'mission-datacore-descriptions': {
    positive: ['mission_contract_delivery_desc'],
    negative: ['mission_contract_delivery_title'],
  },
  'mission-datacore-titles': {
    positive: ['mission_contract_delivery_title'],
    negative: ['mission_contract_delivery_desc'],
  },
};

async function loadRegisteredDescKeyMatchConfigs(): Promise<Map<string, DescKeyMatchConfig>> {
  const categories = await listCategories();
  const slugs = (Object.keys(categories) as Provider[]).flatMap((provider) => categories[provider]);
  const configs = new Map<string, DescKeyMatchConfig>();

  for (const slug of slugs) {
    const config = (await loadConfig(slug)) as ItemConfig | undefined;
    if (typeof config?.descKeyMatch === 'function') {
      configs.set(slug, { label: config.label, descKeyMatch: config.descKeyMatch });
    }
  }

  return configs;
}

describe('registered descKeyMatch predicates', () => {
  it('have representative positive and negative samples for every loadable item config', async () => {
    const configs = await loadRegisteredDescKeyMatchConfigs();
    assert.deepEqual([...configs.keys()].sort(), Object.keys(samplesBySlug).sort());

    for (const [slug, config] of configs) {
      const samples = samplesBySlug[slug];
      for (const key of samples.positive) {
        assert.equal(config.descKeyMatch(key.toLowerCase()), true, `${slug} should match ${key}`);
      }
      for (const key of samples.negative) {
        assert.equal(config.descKeyMatch(key.toLowerCase()), false, `${slug} should not match ${key}`);
      }
    }
  });
});

describe('descKeyMatch overlap diagnostics', () => {
  it('reports sample keys matched by multiple configs', async () => {
    const configs = await loadRegisteredDescKeyMatchConfigs();
    const overlaps = findDescKeyMatchOverlaps(
      [...configs.values()],
      ['item_Desc_COOL_ACOM_S01_Test', 'item_DescPOWR_AMRS_S1_Test', 'ui_MainMenu_Start'],
    );

    assert.deepEqual(overlaps, [
      { key: 'item_Desc_COOL_ACOM_S01_Test', labels: ['DataCore mission descriptions', 'DC Coolers'] },
      {
        key: 'item_DescPOWR_AMRS_S1_Test',
        labels: ['DataCore mission descriptions', 'DC Power Plants'],
      },
    ]);
  });

  it('logs overlap details for dry-run style diagnostics', () => {
    const warnings: Array<{ message: string; attributes: unknown }> = [];
    const configs = [
      { label: 'First', descKeyMatch: (key: string) => key.includes('desc') },
      { label: 'Second', descKeyMatch: (key: string) => key.endsWith('_desc') },
      { label: 'Unrelated', descKeyMatch: (key: string) => key.includes('title') },
    ];

    const overlaps = logDescKeyMatchOverlaps(configs, ['item_widget_desc'], {
      warn: (message, attributes) => warnings.push({ message, attributes }),
    });

    assert.deepEqual(overlaps, [{ key: 'item_widget_desc', labels: ['First', 'Second'] }]);
    assert.deepEqual(warnings, [
      {
        message: 'descKeyMatch overlap detected',
        attributes: { key: 'item_widget_desc', matches: 'First, Second', matchCount: 2 },
      },
    ]);
  });
});
