import fs from 'node:fs/promises';
import type { Element } from 'domhandler';
import { resolveChildPath } from '../../io/local/path-conventions';
import { mapConcurrent } from './concurrency';
import { normalizeDataCoreUsableLocalizationKey, uniqueSortedStrings } from './normalization';
import { queryDataCoreRecords } from './record-graph-query';
import {
  graphGuidReferences,
  graphLocalizationKeys,
  hasGraphLocalizationReference,
  linkedGraphRecordEntityClass,
  uniqueGraphGuidReference,
} from './record-graph-relations';
import type { DataCoreContractTemplateRecord, DataCoreRecordGraphLookup, DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

const DEFAULT_CONTRACT_TEMPLATE_PATH_PREFIX = 'libs/foundry/records/contracts';

export interface ExtractDataCoreContractTemplatesOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  contractTemplatePathPrefix?: string;
  onProgress?: (current: number, total: number) => void;
}

export async function extractDataCoreContractTemplates(
  options: ExtractDataCoreContractTemplatesOptions,
): Promise<DataCoreContractTemplateRecord[]> {
  const records = queryDataCoreRecords(options.graph, {
    pathPrefix: options.contractTemplatePathPrefix ?? DEFAULT_CONTRACT_TEMPLATE_PATH_PREFIX,
    rootType: 'ContractTemplate',
  });
  const rows: DataCoreContractTemplateRecord[] = [];

  let completed = 0;
  const mapped = await mapConcurrent(
    records,
    async (record) => {
      const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore ContractTemplate XML path');
      const xml = await fs.readFile(xmlPath, 'utf8');
      const $ = loadXml(xml);
      const root = $(':root').first();
      if (!root.length) {
        completed++;
        options.onProgress?.(completed, records.length);
        return null;
      }

      const ownerGuid = uniqueGraphGuidReference(record, ['ContractTemplate.owner'], root.attr('owner') ?? '');
      const contractClass = root.find('> contractClass > *').first();
      const contractClassType = contractClass[0]?.type === 'tag' ? contractClass[0].name : '';
      const additionalParams = contractClass.find('> additionalParams').first();
      const autoFinishSettings = contractClass.find('> autoFinishSettings').first();
      const contractDeadline = autoFinishSettings.find('> contractDeadline').first();
      const contractDisplayInfo = root.find('> contractDisplayInfo > ContractDisplayInfo').first();
      const displayTypeGuid = uniqueGraphGuidReference(
        record,
        ['contractDisplayInfo.type'],
        contractDisplayInfo.attr('type') ?? '',
      );
      const locationTagGuids = readGraphGuidRefsWithFallback(
        record,
        ['template:MissionLocation.Reference.value'],
        uniqueStrings(
          root
            .find('MissionPropertyValue_Location Reference[value]')
            .toArray()
            .map((element) => $(element).attr('value') ?? ''),
        ),
      );

      const row = {
        templateClass: record.entityClass,
        contractClassType,
        ownerGuid,
        ownerClass: linkedGraphRecordEntityClass(options.graph.getByRef(ownerGuid)),
        displayTypeGuid,
        displayTypeClass: linkedGraphRecordEntityClass(options.graph.getByRef(displayTypeGuid)),
        illegal: contractDisplayInfo.attr('illegal') ?? '',
        showLifeTimeInMobiGlas: contractDisplayInfo.attr('showLifeTimeInMobiGlas') ?? '',
        preShowObjectives: contractDisplayInfo.attr('preShowObjectives') ?? '',
        hasCompleteButton: additionalParams.attr('hasCompleteButton') ?? '',
        handlesAbandonRequest: additionalParams.attr('handlesAbandonRequest') ?? '',
        canBeShared: additionalParams.attr('canBeShared') ?? '',
        displayAlliedMarkers: additionalParams.attr('displayAlliedMarkers') ?? '',
        onlyOwnerCanComplete: additionalParams.attr('onlyOwnerCanComplete') ?? '',
        failIfSentToPrison: autoFinishSettings.attr('failIfSentToPrison') ?? '',
        failIfBecameCriminal: autoFinishSettings.attr('failIfBecameCriminal') ?? '',
        failIfLeavePrison: autoFinishSettings.attr('failIfLeavePrison') ?? '',
        missionCompletionTime: contractDeadline.attr('missionCompletionTime') ?? '',
        missionAutoEnd: contractDeadline.attr('missionAutoEnd') ?? '',
        missionResultAfterTimerEnd: contractDeadline.attr('missionResultAfterTimerEnd') ?? '',
        remainingTimeToShowTimer: contractDeadline.attr('remainingTimeToShowTimer') ?? '',
        objectiveCount: String(root.find('> objectiveTokens > ObjectiveToken').length),
        missionPropertyCount: String(root.find('MissionProperty').length),
        objectiveHandlerTypes: uniqueTagNames(root.find('ObjectiveToken > objectiveHandler > *').toArray()).join(' | '),
        objectiveHandlerModules: uniqueStrings(
          root
            .find('ObjectiveToken > objectiveHandler > *[module]')
            .toArray()
            .map((element) => $(element).attr('module') ?? ''),
        ).join(' | '),
        objectiveDisplayKeys: readGraphLocalizationAttrsWithFallback(
          record,
          [
            'objectiveDisplayInfo.shortDescription',
            'objectiveDisplayInfo.longDescription',
            'objectiveDisplayInfo.objectiveMarkerLabel',
          ],
          readLocalizationAttrs($, root.find('ObjectiveToken > displayInfo').toArray(), [
            'shortDescription',
            'longDescription',
            'objectiveMarkerLabel',
          ]),
        ).join(' | '),
        travelObjectiveKeys: readGraphLocalizationAttrsWithFallback(
          record,
          [
            'travelObjectiveInfo.shortDescription',
            'travelObjectiveInfo.longDescription',
            'travelObjectiveInfo.objectiveMarkerLabel',
          ],
          readLocalizationAttrs($, root.find('travelObjectiveInfo').toArray(), [
            'shortDescription',
            'longDescription',
            'objectiveMarkerLabel',
          ]),
        ).join(' | '),
        returnObjectiveKeys: readGraphLocalizationAttrsWithFallback(
          record,
          [
            'returnObjectiveInfo.shortDescription',
            'returnObjectiveInfo.longDescription',
            'returnObjectiveInfo.objectiveMarkerLabel',
          ],
          readLocalizationAttrs($, root.find('returnObjectiveInfo').toArray(), [
            'shortDescription',
            'longDescription',
            'objectiveMarkerLabel',
          ]),
        ).join(' | '),
        overrideMissionDetailsKeys: readGraphLocalizationAttrsWithFallback(
          record,
          ['titleOverride', 'descriptionOverride'],
          readLocalizationAttrs($, root.find('overrideMissionDetailsDisplayInfo').toArray(), [
            'titleOverride',
            'descriptionOverride',
          ]),
        ).join(' | '),
        navPointNameKeys: readGraphLocalizationAttrsWithFallback(
          record,
          ['NavPointSpawnInformation.name'],
          readLocalizationAttrs($, root.find('NavPointSpawnInformation').toArray(), ['name']),
        ).join(' | '),
        stringHashKeys: readGraphLocalizationAttrsWithFallback(
          record,
          ['textId'],
          readLocalizationAttrs($, root.find('MissionPropertyValueOption_StringHash').toArray(), ['textId']),
        ).join(' | '),
        locationTagGuids: locationTagGuids.join(' | '),
        locationTagClasses: locationTagGuids
          .map((guid) => linkedGraphRecordEntityClass(options.graph.getByRef(guid)))
          .join(' | '),
        recordGuid: record.ref,
        recordPath: record.path,
      };

      completed++;
      options.onProgress?.(completed, records.length);
      return row;
    },
    50,
  );

  rows.push(...(mapped.filter((r) => r !== null) as DataCoreContractTemplateRecord[]));

  options.onProgress?.(records.length, records.length);
  return rows;
}

function uniqueTagNames(elements: Element[]): string[] {
  return uniqueStrings(elements.map((element) => (element.type === 'tag' ? element.name : '')));
}

function readLocalizationAttrs($: ReturnType<typeof loadXml>, elements: Element[], attributes: string[]): string[] {
  return uniqueStrings(
    elements.flatMap((element) => attributes.map((attribute) => localizationKey($(element).attr(attribute) ?? ''))),
  );
}

function readGraphLocalizationAttrsWithFallback(
  record: DataCoreRecordNode,
  attributes: string[],
  fallbackKeys: string[],
): string[] {
  const graphKeys = graphLocalizationKeys(record, attributes);
  if (graphKeys.length > 0 || hasGraphLocalizationReference(record, attributes)) return uniqueStrings(graphKeys);
  return fallbackKeys;
}

function readGraphGuidRefsWithFallback(
  record: DataCoreRecordNode,
  attributes: string[],
  fallbackGuids: string[],
): string[] {
  const graphGuids = graphGuidReferences(record, attributes);
  return graphGuids.length > 0 ? uniqueStrings(graphGuids) : fallbackGuids;
}

function uniqueStrings(values: string[]): string[] {
  return uniqueSortedStrings(values);
}

function localizationKey(value: string): string {
  return normalizeDataCoreUsableLocalizationKey(value);
}
