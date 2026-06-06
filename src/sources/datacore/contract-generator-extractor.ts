import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import type { DataCoreContractGeneratorRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_CONTRACT_GENERATOR_PATH_PREFIX = 'libs/foundry/records/contracts/contractgenerator';

export interface ExtractDataCoreContractGeneratorsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  contractGeneratorPathPrefix?: string;
}

export async function extractDataCoreContractGenerators(
  options: ExtractDataCoreContractGeneratorsOptions,
): Promise<DataCoreContractGeneratorRecord[]> {
  const records = options.graph
    .getByPathPrefix(options.contractGeneratorPathPrefix ?? DEFAULT_CONTRACT_GENERATOR_PATH_PREFIX)
    .filter((record) => record.rootType === 'ContractGenerator')
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: DataCoreContractGeneratorRecord[] = [];

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore ContractGenerator XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const root = $(':root').first();
    if (!root.length) continue;

    root.find('> generators > *').each((_, handlerElement) => {
      const handler = $(handlerElement);
      const handlerType = handlerElement.type === 'tag' ? handlerElement.name : '';
      const inheritedStringParams = readStringParamOverrides($, handler.find('> contractParams > stringParamOverrides'));

      for (const section of ['introContracts', 'contracts'] as const) {
        handler.find(`> ${section} > Contract`).each((__, contractElement) => {
          const contract = $(contractElement);
          const templateGuid = contract.attr('template') ?? '';
          const template = templateGuid ? options.graph.getByRef(templateGuid) : undefined;
          const contractStringParams = readStringParamOverrides($, contract.find('> paramOverrides > stringParamOverrides'));
          const stringParams = new Map([...inheritedStringParams, ...contractStringParams]);
          const generationParams = contract.find('> generationParams > *').first();
          const contractLifeTime = contract.find('> contractLifeTime > ContractLifeTime').first();
          const contractResults = contract.find('> contractResults').first();
          const difficulty = contractResults.find('> difficulty > ContractDifficulty').first();
          const titleVariantKeys = readStringHashKeys(
            $,
            contract.find('MissionProperty[missionVariableName="Mission_Title_StringHash"]'),
          );
          const descriptionVariantKeys = readStringHashKeys(
            $,
            contract.find('MissionProperty[missionVariableName="Mission_Description_StringHash"]'),
          );
          const locationTagGuids = readLocationTagGuids($, contract);

          rows.push({
            generatorClass: record.entityClass,
            handlerType,
            handlerDebugName: handler.attr('debugName') ?? '',
            handlerNotForRelease: handler.attr('notForRelease') ?? '',
            handlerWorkInProgress: handler.attr('workInProgress') ?? '',
            factionReputationGuid: handler.attr('factionReputation') ?? '',
            reputationScopeGuid: handler.attr('reputationScope') ?? '',
            contractSection: section,
            contractId: contract.attr('id') ?? '',
            contractDebugName: contract.attr('debugName') ?? '',
            contractNotForRelease: contract.attr('notForRelease') ?? '',
            contractWorkInProgress: contract.attr('workInProgress') ?? '',
            templateGuid,
            templateClass: linkedClass(template),
            titleKey: localizationKey(stringParams.get('Title') ?? ''),
            descriptionKey: localizationKey(stringParams.get('Description') ?? ''),
            contractorKey: localizationKey(stringParams.get('Contractor') ?? ''),
            titleVariantKeys: titleVariantKeys.join(' | '),
            descriptionVariantKeys: descriptionVariantKeys.join(' | '),
            stringParamOverrides: formatStringParams(stringParams),
            locationTagGuids: locationTagGuids.join(' | '),
            locationTagClasses: locationTagGuids.map((guid) => linkedClass(options.graph.getByRef(guid))).join(' | '),
            maxInstances: generationParams.attr('maxInstances') ?? '',
            maxInstancesPerPlayer: generationParams.attr('maxInstancesPerPlayer') ?? '',
            respawnTime: generationParams.attr('respawnTime') ?? '',
            respawnTimeVariation: generationParams.attr('respawnTimeVariation') ?? '',
            instanceLifeTime: contractLifeTime.attr('instanceLifeTime') ?? '',
            instanceLifeTimeVariation: contractLifeTime.attr('instanceLifeTimeVariation') ?? '',
            contractBuyInAmount: contractResults.attr('contractBuyInAmount') ?? '',
            timeToComplete: contractResults.attr('timeToComplete') ?? '',
            difficultyProfileGuid: difficulty.attr('difficultyProfile') ?? '',
            difficultyProfileClass: linkedClass(options.graph.getByRef(difficulty.attr('difficultyProfile') ?? '')),
            mechanicalSkill: difficulty.attr('mechanicalSkill') ?? '',
            mentalLoad: difficulty.attr('mentalLoad') ?? '',
            riskOfLoss: difficulty.attr('riskOfLoss') ?? '',
            gameKnowledge: difficulty.attr('gameKnowledge') ?? '',
            recordGuid: record.ref,
            recordPath: record.path,
          });
        });
      }
    });
  }

  return rows;
}

function readStringParamOverrides($: ReturnType<typeof loadXml>, root: ReturnType<ReturnType<typeof loadXml>>): Map<string, string> {
  const params = new Map<string, string>();
  root.find('> ContractStringParam[param]').each((_, element) => {
    const param = $(element).attr('param') ?? '';
    if (param) params.set(param, $(element).attr('value') ?? '');
  });
  return params;
}

function readStringHashKeys($: ReturnType<typeof loadXml>, root: ReturnType<ReturnType<typeof loadXml>>): string[] {
  const keys: string[] = [];
  root.find('MissionPropertyValueOption_StringHash[textId]').each((_, element) => {
    const key = localizationKey($(element).attr('textId') ?? '');
    if (key && !keys.includes(key)) keys.push(key);
  });
  return keys;
}

function readLocationTagGuids($: ReturnType<typeof loadXml>, root: ReturnType<ReturnType<typeof loadXml>>): string[] {
  const guids: string[] = [];
  root.find('MissionPropertyValue_Location Reference[value]').each((_, element) => {
    const guid = $(element).attr('value') ?? '';
    if (guid && !guids.includes(guid)) guids.push(guid);
  });
  return guids;
}

function formatStringParams(params: Map<string, string>): string {
  return [...params.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${localizationKey(value) || value}`)
    .join(' | ');
}

function linkedClass(record: DataCoreRecordNode | undefined): string {
  return record?.entityClass ?? '';
}

function localizationKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '@LOC_EMPTY' || trimmed === '@LOC_UNINITIALIZED') return '';
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}
