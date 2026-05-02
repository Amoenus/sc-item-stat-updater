#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const outDir = join(repoRoot, 'csv', 'scmdb');
const missionsOutDir = join(repoRoot, 'csv', 'missions');

mkdirSync(outDir, { recursive: true });
mkdirSync(missionsOutDir, { recursive: true });

function usage() {
  console.log(`Usage: node scrape-scmdb.js [options]

Options:
  --version <version>    Use a specific SCMDB merged version file
  --ptu                  Fetch the latest PTU SCMDB version instead of latest live
  --list-versions        List available SCMDB merged versions
  --raw                  Save only raw SCMDB JSON output
  --help                 Show this help message

Examples:
  node scrape-scmdb.js
  node scrape-scmdb.js --ptu
  node scrape-scmdb.js --version 4.8.0-ptu.11759767
  node scrape-scmdb.js --list-versions
`);
}

function toCsv(rows, headers) {
  const escape = (value) => {
    if (value === undefined || value === null) return '';
    const text = String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  const lines = [headers.map(escape).join(','), ...rows.map((row) => headers.map((col) => escape(row[col])).join(','))];
  return `${lines.join('\n')}\n`;
}

function flattenValue(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'SCMDB Scraper' } });
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

function writeOutput(fileName, content) {
  const path = join(outDir, fileName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
  console.log(`Saved ${fileName}`);
}

function writeMissionOutput(fileName, content) {
  const path = join(missionsOutDir, fileName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
  console.log(`Saved missions/${fileName}`);
}

function collectBlueprintChainData(contracts) {
  const contractById = new Map(contracts.map((contract) => [contract.id, contract]));
  const tagProviders = new Map();

  for (const contract of contracts) {
    if (!Array.isArray(contract.completionTags)) continue;
    for (const completionTag of contract.completionTags) {
      const tag = completionTag?.tag;
      if (typeof tag !== 'string') continue;
      const list = tagProviders.get(tag) ?? [];
      list.push(contract.id);
      tagProviders.set(tag, list);
    }
  }

  const isBlueprintReward = new Map();
  const blueprintChainDepth = new Map();

  const queue = [];

  const getRequiredTags = (contract) => {
    const prerequisites = contract.prerequisites;
    if (!prerequisites || typeof prerequisites !== 'object') return [];
    const completedTags = prerequisites.completedContractTags;
    if (!completedTags || typeof completedTags !== 'object') return [];
    return Array.isArray(completedTags.tags)
      ? completedTags.tags.filter((tag) => typeof tag === 'string')
      : [];
  };

  for (const contract of contracts) {
    const reward = Array.isArray(contract.blueprintRewards) && contract.blueprintRewards.length > 0;
    if (reward) {
      isBlueprintReward.set(contract.id, true);
      blueprintChainDepth.set(contract.id, 0);
      const requiredTags = getRequiredTags(contract);
      for (const tag of requiredTags) {
        for (const providerId of tagProviders.get(tag) ?? []) {
          queue.push({ contractId: providerId, depth: 1 });
        }
      }
    }
  }

  while (queue.length > 0) {
    const { contractId, depth } = queue.shift();
    const currentDepth = blueprintChainDepth.get(contractId);
    if (currentDepth !== undefined && currentDepth <= depth) {
      continue;
    }
    blueprintChainDepth.set(contractId, depth);
    const contract = contractById.get(contractId);
    if (!contract) continue;
    const requiredTags = getRequiredTags(contract);
    for (const tag of requiredTags) {
      for (const providerId of tagProviders.get(tag) ?? []) {
        if (providerId === contractId) continue;
        queue.push({ contractId: providerId, depth: depth + 1 });
      }
    }
  }

  return { isBlueprintReward, blueprintChainDepth };
}

function buildContractRow(contract, chainData) {
  const isBlueprintReward = chainData.isBlueprintReward.get(contract.id) === true;
  const depth = chainData.blueprintChainDepth.get(contract.id);
  return {
    id: contract.id,
    debugName: contract.debugName,
    category: contract.category,
    missionType: contract.missionType,
    missionTypeKey: contract.missionTypeKey,
    title: contract.title,
    titleKey: contract.titleKey,
    description: contract.description,
    descriptionKey: contract.descriptionKey,
    descriptionLocKey: contract.descriptionLocKey,
    rewardUEC: contract.rewardUEC,
    timeToComplete: contract.timeToComplete,
    canBeShared: contract.canBeShared,
    illegal: contract.illegal,
    factionGuid: contract.factionGuid,
    locations: flattenValue(contract.locations),
    destinations: flattenValue(contract.destinations),
    prerequisites: flattenValue(contract.prerequisites),
    tokenSubstitutions: flattenValue(contract.tokenSubstitutions),
    minStanding: flattenValue(contract.minStanding),
    maxStanding: flattenValue(contract.maxStanding),
    blueprintRewards: flattenValue(contract.blueprintRewards),
    isBlueprintReward: isBlueprintReward ? 'true' : 'false',
    isBlueprintChainPrerequisite: depth > 0 ? 'true' : 'false',
    blueprintChainDepth: depth !== undefined ? String(depth) : '',
  };
}

function buildBlueprintPoolRows(blueprintPools) {
  return Object.entries(blueprintPools || {}).map(([id, pool]) => ({
    id,
    name: pool.name,
    source: pool.source,
    blueprints: flattenValue(pool.blueprints),
  }));
}

function buildContractBlueprintRows(contracts, blueprintPools) {
  return (contracts || []).flatMap((contract) => {
    if (!Array.isArray(contract.blueprintRewards)) return [];
    return contract.blueprintRewards.map((entry) => ({
      contractId: contract.id,
      debugName: contract.debugName,
      title: contract.title,
      blueprintPoolId: entry.blueprintPool,
      poolName: entry.poolName,
      chance: entry.chance,
      trigger: entry.trigger,
      blueprintSource: blueprintPools?.[entry.blueprintPool]?.source,
      blueprintItems: flattenValue(blueprintPools?.[entry.blueprintPool]?.blueprints),
    }));
  });
}

function buildBlueprintRewardList(contract, blueprintPools) {
  if (!Array.isArray(contract.blueprintRewards)) return '';
  const names = new Set();
  for (const entry of contract.blueprintRewards) {
    const pool = blueprintPools?.[entry.blueprintPool];
    if (!pool || !Array.isArray(pool.blueprints)) continue;
    for (const blueprint of pool.blueprints) {
      if (blueprint && typeof blueprint.name === 'string') {
        names.add(blueprint.name);
      }
    }
  }
  return names.size > 0 ? Array.from(names).map((name) => `- ${name}`).join(String.raw`\n`) : '';
}

function normalizeLocalizationKey(key) {
  if (!key || typeof key !== 'string') return '';
  return key.startsWith('@') ? key.slice(1) : key;
}

function isLiveVersion(version) {
  return /\blive\b/i.test(version) || /-live\./i.test(version);
}

function isPtuVersion(version) {
  return /\bptu\b/i.test(version) || /-ptu\./i.test(version);
}

function buildMissionRows(contracts, chainData, blueprintPools) {
  return (contracts || []).flatMap((contract) => {
    const rows = [];
    const blueprintReward = chainData.isBlueprintReward.get(contract.id) === true;
    const blueprintChain = chainData.blueprintChainDepth.get(contract.id) > 0;
    const titleKey = normalizeLocalizationKey(contract.titleKey || '');
    const descKey = normalizeLocalizationKey(contract.descriptionLocKey || contract.descriptionKey || '');
    let titleTag = '';
    let descTag = '';
    if (blueprintReward) {
      titleTag = ' <EM4>[BP]</EM4>';
      descTag = '[BP Reward]';
    } else if (blueprintChain) {
      titleTag = ' <EM4>[BP Chain]</EM4>';
      descTag = '[BP Chain]';
    }
    const rewardList = blueprintReward ? buildBlueprintRewardList(contract, blueprintPools) : '';
    const descriptionNote = descTag + (rewardList ? String.raw`\n\n${rewardList}` : '');

    if (titleKey && contract.title) {
      rows.push({
        'Localization Key': titleKey,
        Description: contract.title,
        TitleNote: titleTag,
        Note: '',
        RewardList: '',
      });
    }

    if (descKey && contract.description) {
      rows.push({
        'Localization Key': descKey,
        Description: contract.description,
        Note: descriptionNote,
        TitleNote: '',
        RewardList: rewardList,
      });
    }

    return rows;
  }).filter(Boolean);
}

async function main() {
  const args = process.argv.slice(2);
  const versionArgIndex = args.indexOf('--version');
  const ptu = args.includes('--ptu');
  const listVersions = args.includes('--list-versions');
  const rawOnly = args.includes('--raw');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    usage();
    process.exit(0);
  }

  const versionsUrl = 'https://scmdb.net/data/versions.json';
  const versions = await fetchJson(versionsUrl);

  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error('Unable to read SCMDB versions list');
  }

  if (listVersions) {
    console.log('Available SCMDB versions:');
    for (const entry of versions) {
      console.log(`  ${entry.version} -> ${entry.file}`);
    }
    console.log('');
    console.log('By default this scraper uses the latest live SCMDB version. Use --ptu to fetch the latest PTU version.');
    process.exit(0);
  }

  let selected = null;
  if (versionArgIndex !== -1) {
    const requested = args[versionArgIndex + 1];
    if (!requested) {
      throw new Error('--version requires a value');
    }
    selected = versions.find((entry) => entry.version === requested);
    if (!selected) {
      throw new Error(`Version not found: ${requested}`);
    }
  } else if (ptu) {
    selected = versions.find((entry) => isPtuVersion(entry.version));
    if (!selected) {
      throw new Error('No PTU SCMDB version available');
    }
  } else {
    selected = versions.find((entry) => isLiveVersion(entry.version));
    if (!selected) {
      selected = versions[0];
    }
  }

  console.log(`Using SCMDB version ${selected.version}`);

  const mergedUrl = `https://scmdb.net/data/${selected.file}`;
  const mergedData = await fetchJson(mergedUrl);
  const rawFileName = `${selected.file}`;
  writeOutput(rawFileName, JSON.stringify(mergedData, null, 2));

  if (rawOnly) {
    return;
  }

  const chainData = collectBlueprintChainData(Array.isArray(mergedData.contracts) ? mergedData.contracts : []);
  const contractRows = Array.isArray(mergedData.contracts)
    ? mergedData.contracts.map((contract) => buildContractRow(contract, chainData))
    : [];
  const legacyRows = Array.isArray(mergedData.legacyContracts)
    ? mergedData.legacyContracts.map((contract) => buildContractRow(contract, chainData))
    : [];
  const missionRows = buildMissionRows(mergedData.contracts, chainData, mergedData.blueprintPools);
  const blueprintPoolRows = buildBlueprintPoolRows(mergedData.blueprintPools);
  const contractBlueprintRows = buildContractBlueprintRows(mergedData.contracts, mergedData.blueprintPools);

  if (missionRows.length) {
    writeMissionOutput('scmdb-missions.csv', toCsv(missionRows, ['Localization Key', 'Description', 'TitleNote', 'Note', 'RewardList']));
  }

  if (contractRows.length) {
    const headers = [
      'id', 'debugName', 'category', 'missionType', 'missionTypeKey', 'title', 'titleKey',
      'description', 'descriptionKey', 'descriptionLocKey', 'rewardUEC', 'timeToComplete',
      'canBeShared', 'illegal', 'factionGuid', 'locations', 'destinations',
      'prerequisites', 'tokenSubstitutions', 'minStanding', 'maxStanding', 'blueprintRewards',
      'isBlueprintReward', 'isBlueprintChainPrerequisite', 'blueprintChainDepth',
    ];
    writeOutput('contracts.csv', toCsv(contractRows, headers));
  }

  if (legacyRows.length) {
    const headers = [
      'id', 'debugName', 'category', 'missionType', 'missionTypeKey', 'title', 'titleKey',
      'description', 'descriptionKey', 'descriptionLocKey', 'rewardUEC', 'timeToComplete',
      'canBeShared', 'illegal', 'factionGuid', 'locations', 'destinations',
      'prerequisites', 'tokenSubstitutions', 'minStanding', 'maxStanding', 'blueprintRewards',
      'isBlueprintReward', 'isBlueprintChainPrerequisite', 'blueprintChainDepth',
    ];
    writeOutput('legacy-contracts.csv', toCsv(legacyRows, headers));
  }

  if (blueprintPoolRows.length) {
    writeOutput('blueprint-pools.csv', toCsv(blueprintPoolRows, ['id', 'name', 'source', 'blueprints']));
  }

  if (contractBlueprintRows.length) {
    writeOutput('contract-blueprint-rewards.csv', toCsv(contractBlueprintRows, [
      'contractId', 'debugName', 'title', 'blueprintPoolId', 'poolName', 'chance', 'trigger', 'blueprintSource', 'blueprintItems',
    ]));
  }

  console.log('SCMDB scrape complete. Outputs are in csv/scmdb/');
}

try {
  await main();
} catch (err) {
  console.error('ERROR:', err.message);
  process.exit(1);
}
