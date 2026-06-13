import fs from 'node:fs/promises';
import type { Element } from 'domhandler';
import { resolveChildPath } from '../../io/local/path-conventions';
import { mapConcurrent } from './concurrency';
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
  const records = options.graph
    .getByPathPrefix(options.contractTemplatePathPrefix ?? DEFAULT_CONTRACT_TEMPLATE_PATH_PREFIX)
    .filter((record) => record.rootType === 'ContractTemplate')
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: DataCoreContractTemplateRecord[] = [];

  let completed = 0;
  const mapped = await mapConcurrent(
    records,
    async (record, index) => {
      const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore ContractTemplate XML path');
      const xml = await fs.readFile(xmlPath, 'utf8');
      const $ = loadXml(xml);
      const root = $(':root').first();
      if (!root.length) {
        completed++;
        options.onProgress?.(completed, records.length);
        return null;
      }

      const ownerGuid = root.attr('owner') ?? '';
      const contractClass = root.find('> contractClass > *').first();
      const contractClassType = contractClass[0]?.type === 'tag' ? contractClass[0].name : '';
      const additionalParams = contractClass.find('> additionalParams').first();
      const autoFinishSettings = contractClass.find('> autoFinishSettings').first();
      const contractDeadline = autoFinishSettings.find('> contractDeadline').first();
      const contractDisplayInfo = root.find('> contractDisplayInfo > ContractDisplayInfo').first();
      const displayTypeGuid = contractDisplayInfo.attr('type') ?? '';
      const locationTagGuids = uniqueStrings(
        root
          .find('MissionPropertyValue_Location Reference[value]')
          .toArray()
          .map((element) => $(element).attr('value') ?? ''),
      );

      const row = {
        templateClass: record.entityClass,
        contractClassType,
        ownerGuid,
        ownerClass: linkedClass(options.graph.getByRef(ownerGuid)),
        displayTypeGuid,
        displayTypeClass: linkedClass(options.graph.getByRef(displayTypeGuid)),
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
        objectiveDisplayKeys: readLocalizationAttrs($, root.find('ObjectiveToken > displayInfo').toArray(), [
          'shortDescription',
          'longDescription',
          'objectiveMarkerLabel',
        ]).join(' | '),
        travelObjectiveKeys: readLocalizationAttrs($, root.find('travelObjectiveInfo').toArray(), [
          'shortDescription',
          'longDescription',
          'objectiveMarkerLabel',
        ]).join(' | '),
        returnObjectiveKeys: readLocalizationAttrs($, root.find('returnObjectiveInfo').toArray(), [
          'shortDescription',
          'longDescription',
          'objectiveMarkerLabel',
        ]).join(' | '),
        overrideMissionDetailsKeys: readLocalizationAttrs($, root.find('overrideMissionDetailsDisplayInfo').toArray(), [
          'titleOverride',
          'descriptionOverride',
        ]).join(' | '),
        navPointNameKeys: readLocalizationAttrs($, root.find('NavPointSpawnInformation').toArray(), ['name']).join(
          ' | ',
        ),
        stringHashKeys: readLocalizationAttrs($, root.find('MissionPropertyValueOption_StringHash').toArray(), [
          'textId',
        ]).join(' | '),
        locationTagGuids: locationTagGuids.join(' | '),
        locationTagClasses: locationTagGuids.map((guid) => linkedClass(options.graph.getByRef(guid))).join(' | '),
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

function linkedClass(record: DataCoreRecordNode | undefined): string {
  return record?.entityClass ?? '';
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function localizationKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^@?LOC_(?:EMPTY|PLACEHOLDER|UNINITIALIZED)$/i.test(trimmed)) return '';
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}
