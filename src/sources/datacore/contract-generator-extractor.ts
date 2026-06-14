import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import { mapConcurrent } from './concurrency';
import { normalizeDataCoreUsableLocalizationKey } from './normalization';
import { queryDataCoreRecords } from './record-graph-query';
import {
  graphGuidReferences,
  graphLocalizationKeys,
  graphLocalizationKeyWithFallback,
  hasGraphLocalizationReference,
  linkedGraphRecordEntityClass,
  uniqueGraphGuidReference,
} from './record-graph-relations';
import type { DataCoreContractGeneratorRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_CONTRACT_GENERATOR_PATH_PREFIX = 'libs/foundry/records/contracts/contractgenerator';

export interface ExtractDataCoreContractGeneratorsOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  contractGeneratorPathPrefix?: string;
  onProgress?: (current: number, total: number) => void;
}

export async function extractDataCoreContractGenerators(
  options: ExtractDataCoreContractGeneratorsOptions,
): Promise<DataCoreContractGeneratorRecord[]> {
  const records = queryDataCoreRecords(options.graph, {
    pathPrefix: options.contractGeneratorPathPrefix ?? DEFAULT_CONTRACT_GENERATOR_PATH_PREFIX,
    rootType: 'ContractGenerator',
    unique: true,
  });
  const rows: DataCoreContractGeneratorRecord[] = [];

  let completed = 0;
  const mapped = await mapConcurrent(
    records,
    async (record) => {
      const chunkRows: DataCoreContractGeneratorRecord[] = [];
      const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore ContractGenerator XML path');
      const xml = await fs.readFile(xmlPath, 'utf8');
      const $ = loadXml(xml);
      const root = $(':root').first();
      if (!root.length) {
        completed++;
        options.onProgress?.(completed, records.length);
        return chunkRows;
      }

      root.find('> generators > *').each((_, handlerElement) => {
        const handler = $(handlerElement);
        const handlerType = handlerElement.type === 'tag' ? handlerElement.name : '';
        const inheritedStringParams = readStringParamOverrides(
          $,
          handler.find('> contractParams > stringParamOverrides'),
        );

        for (const section of ['introContracts', 'contracts'] as const) {
          handler
            .find(`> ${section} > *`)
            .filter((_, element) => {
              const contract = $(element);
              return Boolean(contract.attr('id') && contract.attr('template'));
            })
            .each((__, contractElement) => {
              const contract = $(contractElement);
              const contractId = contract.attr('id') ?? '';
              const templateGuid = graphGuidReference(
                record,
                [contractTemplateAttribute(contractId)],
                contract.attr('template') ?? '',
              );
              const template = templateGuid ? options.graph.getByRef(templateGuid) : undefined;
              const contractStringParams = readStringParamOverrides(
                $,
                contract.find('> paramOverrides > stringParamOverrides'),
              );
              const stringParams = new Map([...inheritedStringParams, ...contractStringParams]);
              const generationParams = contract.find('> generationParams > *').first();
              const contractLifeTime = contract.find('> contractLifeTime > ContractLifeTime').first();
              const contractResults = contract.find('> contractResults').first();
              const difficulty = contractResults.find('> difficulty > ContractDifficulty').first();
              const successReputationRewards: { amount: number; factionGuid: string; scopeGuid: string }[] = [];
              const failureReputationRewards: { amount: number; factionGuid: string; scopeGuid: string }[] = [];
              contractResults.find('> contractResults > ContractResult_LegacyReputation').each((_, repElement) => {
                const rep = $(repElement);
                const missionResults = rep
                  .find('> missionResults > Bool')
                  .map((_, el) => $(el).attr('value') === '1')
                  .get();
                rep.find('> contractResultReputationAmounts').each((_, amountElement) => {
                  const amountEl = $(amountElement);
                  const factionGuid = graphGuidReference(
                    record,
                    ['factionReputation'],
                    amountEl.attr('factionReputation') ?? '',
                  );
                  const scopeGuid = graphGuidReference(
                    record,
                    ['reputationScope'],
                    amountEl.attr('reputationScope') ?? '',
                  );
                  const rewardGuid = graphGuidReference(record, ['reward'], amountEl.attr('reward') ?? '');
                  if (rewardGuid && (missionResults[0] || missionResults[1] || missionResults[2])) {
                    const rewardRecord = options.graph.getByRef(rewardGuid);
                    let amount = 0;
                    if (rewardRecord) {
                      try {
                        const xmlPath = resolveChildPath(
                          options.xmlCacheDir,
                          rewardRecord.path,
                          'DataCore SReputationRewardAmount XML path',
                        );
                        const xml = readFileSync(xmlPath, 'utf8');
                        const reward$ = loadXml(xml);
                        amount = Number(reward$(':root').first().attr('reputationAmount') ?? 0);
                      } catch {}
                    }
                    if (amount !== 0) {
                      const rewardObj = { amount, factionGuid, scopeGuid };
                      if (missionResults[0]) successReputationRewards.push(rewardObj);
                      if (missionResults[1] || missionResults[2]) failureReputationRewards.push(rewardObj);
                    }
                  }
                });
              });
              const titleVariantKeys = readGraphStringHashKeysWithFallback(
                record,
                [contractStringHashAttribute(contract.attr('id') ?? '', 'Mission_Title_StringHash')],
                readStringHashKeys($, contract.find('MissionProperty[missionVariableName="Mission_Title_StringHash"]')),
              );
              const descriptionVariantKeys = readGraphStringHashKeysWithFallback(
                record,
                [contractStringHashAttribute(contract.attr('id') ?? '', 'Mission_Description_StringHash')],
                readStringHashKeys(
                  $,
                  contract.find('MissionProperty[missionVariableName="Mission_Description_StringHash"]'),
                ),
              );
              const blueprintRewards = readBlueprintRewards($, contractResults);
              const locationTagGuids = readGraphLocationTagGuidsWithFallback(
                record,
                contractId,
                readLocationTagGuids($, contract),
              );
              const factionReputationGuid = graphGuidReference(
                record,
                ['factionReputation'],
                handler.attr('factionReputation') ?? '',
              );
              const reputationScopeGuid = graphGuidReference(
                record,
                ['reputationScope'],
                handler.attr('reputationScope') ?? '',
              );
              const difficultyProfileGuid = graphGuidReference(
                record,
                ['difficultyProfile'],
                difficulty.attr('difficultyProfile') ?? '',
              );

              chunkRows.push({
                generatorClass: record.entityClass,
                handlerType,
                handlerDebugName: handler.attr('debugName') ?? '',
                handlerNotForRelease: handler.attr('notForRelease') ?? '',
                handlerWorkInProgress: handler.attr('workInProgress') ?? '',
                factionReputationGuid,
                reputationScopeGuid,
                contractSection: section,
                contractId,
                contractDebugName: contract.attr('debugName') ?? '',
                contractNotForRelease: contract.attr('notForRelease') ?? '',
                contractWorkInProgress: contract.attr('workInProgress') ?? '',
                templateGuid,
                templateClass: linkedGraphRecordEntityClass(template),
                titleKey: readGraphContractStringParamWithFallback(
                  record,
                  contractId,
                  'Title',
                  stringParams.get('Title') ?? '',
                ),
                descriptionKey: readGraphContractStringParamWithFallback(
                  record,
                  contractId,
                  'Description',
                  stringParams.get('Description') ?? '',
                ),
                contractorKey: readGraphContractStringParamWithFallback(
                  record,
                  contractId,
                  'Contractor',
                  stringParams.get('Contractor') ?? '',
                ),
                titleVariantKeys: titleVariantKeys.join(' | '),
                descriptionVariantKeys: descriptionVariantKeys.join(' | '),
                stringParamOverrides: formatStringParams(record, contractId, stringParams),
                locationTagGuids: locationTagGuids.join(' | '),
                locationTagClasses: locationTagGuids
                  .map((guid) => linkedGraphRecordEntityClass(options.graph.getByRef(guid)))
                  .join(' | '),
                successReputationRewards: successReputationRewards.length
                  ? JSON.stringify(successReputationRewards)
                  : '',
                failureReputationRewards: failureReputationRewards.length
                  ? JSON.stringify(failureReputationRewards)
                  : '',
                maxInstances: generationParams.attr('maxInstances') ?? '',
                maxInstancesPerPlayer: generationParams.attr('maxInstancesPerPlayer') ?? '',
                respawnTime: generationParams.attr('respawnTime') ?? '',
                respawnTimeVariation: generationParams.attr('respawnTimeVariation') ?? '',
                instanceLifeTime: contractLifeTime.attr('instanceLifeTime') ?? '',
                instanceLifeTimeVariation: contractLifeTime.attr('instanceLifeTimeVariation') ?? '',
                contractBuyInAmount: contractResults.attr('contractBuyInAmount') ?? '',
                timeToComplete: contractResults.attr('timeToComplete') ?? '',
                difficultyProfileGuid,
                difficultyProfileClass: linkedGraphRecordEntityClass(options.graph.getByRef(difficultyProfileGuid)),
                mechanicalSkill: difficulty.attr('mechanicalSkill') ?? '',
                mentalLoad: difficulty.attr('mentalLoad') ?? '',
                riskOfLoss: difficulty.attr('riskOfLoss') ?? '',
                gameKnowledge: difficulty.attr('gameKnowledge') ?? '',
                blueprintRewardPoolGuids: blueprintRewards.map((reward) => reward.blueprintPool).join(','),
                blueprintRewards: blueprintRewards.length ? JSON.stringify(blueprintRewards) : '',
                requiredCompletedContractTags: contract
                  .find('ContractPrerequisite_CompletedContractTags requiredCompletedContractTags Reference[value]')
                  .map((_, el) => $(el).attr('value'))
                  .get()
                  .filter(Boolean)
                  .join(','),
                completionTags: contractResults
                  .find('ContractResult_CompletionTags completionTags ContractResult_CompletionTag[tag]')
                  .map((_, el) => $(el).attr('tag'))
                  .get()
                  .filter(Boolean)
                  .join(','),
                recordGuid: record.ref,
                recordPath: record.path,
              });
            });
        }
      });

      completed++;
      options.onProgress?.(completed, records.length);
      return chunkRows;
    },
    50,
  );

  rows.push(...mapped.flat());

  options.onProgress?.(records.length, records.length);
  return rows;
}

function readBlueprintRewards(
  $: ReturnType<typeof loadXml>,
  root: ReturnType<ReturnType<typeof loadXml>>,
): Array<{ blueprintPool: string; chance: number; trigger: string; type: string }> {
  return root
    .find('BlueprintRewards[blueprintPool]')
    .map((_, element) => {
      const reward = $(element);
      return {
        blueprintPool: reward.attr('blueprintPool') ?? '',
        chance: Number(reward.attr('chance') ?? 1) || 1,
        trigger: reward.attr('trigger') ?? '',
        type: element.type === 'tag' ? element.name : '',
      };
    })
    .get()
    .filter((reward) => Boolean(reward.blueprintPool));
}

function readStringParamOverrides(
  $: ReturnType<typeof loadXml>,
  root: ReturnType<ReturnType<typeof loadXml>>,
): Map<string, string> {
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

function formatStringParams(record: DataCoreRecordNode, contractId: string, params: Map<string, string>): string {
  return [...params.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${formatContractStringParamValue(record, contractId, key, value)}`)
    .join(' | ');
}

function readGraphStringHashKeysWithFallback(
  record: DataCoreRecordNode,
  attributes: string[],
  fallbackKeys: string[],
): string[] {
  if (attributes.some((attribute) => !attribute)) return fallbackKeys;
  const graphKeys = graphLocalizationKeys(record, attributes);
  if (graphKeys.length > 0 || hasGraphLocalizationReference(record, attributes)) {
    return [...graphKeys].sort((a, b) => a.localeCompare(b));
  }
  return fallbackKeys;
}

function readGraphLocationTagGuidsWithFallback(
  record: DataCoreRecordNode,
  contractId: string,
  fallbackGuids: string[],
): string[] {
  const attribute = contractLocationTagAttribute(contractId);
  if (!attribute) return fallbackGuids;
  const graphGuids = graphGuidReferences(record, [attribute]);
  return graphGuids.length > 0 ? graphGuids : fallbackGuids;
}

function contractStringHashAttribute(contractId: string, missionVariableName: string): string {
  const trimmed = contractId.trim();
  return trimmed ? `contract:${trimmed}:${missionVariableName}.textId` : '';
}

function contractLocationTagAttribute(contractId: string): string {
  const trimmed = contractId.trim();
  return trimmed ? `contract:${trimmed}:MissionLocation.Reference.value` : '';
}

function contractTemplateAttribute(contractId: string): string {
  const trimmed = contractId.trim();
  return trimmed ? `contract:${trimmed}:template` : '';
}

function readGraphContractStringParamWithFallback(
  record: DataCoreRecordNode,
  contractId: string,
  param: string,
  fallback: string,
): string {
  const attribute = contractStringParamAttribute(contractId, param);
  if (!attribute) return localizationKey(fallback);
  return graphLocalizationKeyWithFallback(record, [attribute], fallback);
}

function formatContractStringParamValue(
  record: DataCoreRecordNode,
  contractId: string,
  param: string,
  fallback: string,
): string {
  const attribute = contractStringParamAttribute(contractId, param);
  if (attribute && hasGraphLocalizationReference(record, [attribute])) {
    return graphLocalizationKeyWithFallback(record, [attribute], fallback);
  }
  return localizationKey(fallback) || fallback;
}

function contractStringParamAttribute(contractId: string, param: string): string {
  const trimmedContractId = contractId.trim();
  const trimmedParam = param.trim();
  return trimmedContractId && trimmedParam ? `contract:${trimmedContractId}:ContractStringParam.${trimmedParam}` : '';
}

function graphGuidReference(record: DataCoreRecordNode, attributes: string[], fallback: string): string {
  return uniqueGraphGuidReference(record, attributes, fallback);
}

function localizationKey(value: string): string {
  return normalizeDataCoreUsableLocalizationKey(value);
}
