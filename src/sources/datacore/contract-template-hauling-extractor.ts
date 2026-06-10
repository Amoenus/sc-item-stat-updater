import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import type {
  DataCoreContractTemplateHaulingOrderRecord,
  DataCoreRecordGraphLookup,
  DataCoreRecordNode,
} from './types';
import { loadXml } from './xml-parser';

const DEFAULT_CONTRACT_TEMPLATE_PATH_PREFIX = 'libs/foundry/records/contracts';
const DEFAULT_CARRYABLE_PATH_PREFIX = 'libs/foundry/records/entities/scitem/carryables';

export interface ExtractDataCoreContractTemplateHaulingOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  contractTemplatePathPrefix?: string;
  onProgress?: (current: number, total: number) => void;
  carryablePathPrefix?: string;
}

export async function extractDataCoreContractTemplateHaulingOrders(
  options: ExtractDataCoreContractTemplateHaulingOptions,
): Promise<DataCoreContractTemplateHaulingOrderRecord[]> {
  const resourceResolver = await buildCarryableResourceResolver(options);
  const records = options.graph
    .getByPathPrefix(options.contractTemplatePathPrefix ?? DEFAULT_CONTRACT_TEMPLATE_PATH_PREFIX)
    .filter((record) => record.rootType === 'ContractTemplate')
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: DataCoreContractTemplateHaulingOrderRecord[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    options.onProgress?.(i, records.length);
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore ContractTemplate XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const root = $(':root').first();
    if (!root.length) continue;

    root.find('ObjectiveToken').each((_, objective) => {
      const objectiveDebugName = $(objective).attr('debugName') ?? '';
      $(objective)
        .find('ObjectiveHandler_Hauling HaulingOrder_Resource')
        .each((orderIndex, order) => {
          const resourceGuid = $(order).attr('resource') ?? '';
          const minSCU = $(order).attr('minSCU') ?? '';
          const maxSCU = $(order).attr('maxSCU') ?? '';
          const maxContainerSize = $(order).attr('maxContainerSize') ?? '';
          const resolvedResource = resourceResolver.get(resourceGuid);
          const resourceClass = resolvedResource?.resourceClass ?? linkedClass(options.graph.getByRef(resourceGuid));
          const resourceNameKey = resolvedResource?.resourceNameKey ?? '';
          rows.push({
            templateClass: record.entityClass,
            objectiveDebugName,
            orderIndex: String(orderIndex + 1),
            resourceGuid,
            resourceClass,
            resourceNameKey,
            minSCU,
            maxSCU,
            maxContainerSize,
            orderSummary: '', // formatted later
            recordGuid: record.ref,
            recordPath: record.path,
          });
        });
    });
  }

  options.onProgress?.(records.length, records.length);
  return rows;
}

interface ResolvedHaulingResource {
  resourceClass: string;
  resourceNameKey: string;
}

async function buildCarryableResourceResolver(
  options: ExtractDataCoreContractTemplateHaulingOptions,
): Promise<Map<string, ResolvedHaulingResource>> {
  const resources = new Map<string, ResolvedHaulingResource>();
  const records = options.graph
    .getByPathPrefix(options.carryablePathPrefix ?? DEFAULT_CARRYABLE_PATH_PREFIX)
    .filter((record) => record.rootType === 'EntityClassDefinition')
    .sort((a, b) => a.path.localeCompare(b.path));

  for (const record of records) {
    const xmlPath = resolveChildPath(options.xmlCacheDir, record.path, 'DataCore carryable XML path');
    const xml = await fs.readFile(xmlPath, 'utf8');
    const $ = loadXml(xml);
    const resourceNameKey = firstLocalizationKey([
      $('SAttachableComponentParams AttachDef > Localization').first().attr('Name') ?? '',
      $('SCItemPurchasableParams').first().attr('displayName') ?? '',
      $('LocStringUserVariable[name="ItemName"]').first().attr('defaultValue') ?? '',
    ]);
    const resourceClass = resourceClassFromNameKey(resourceNameKey) || record.entityClass;

    $('ResourceContainerDefaultCompositionEntry[entry]').each((_, entry) => {
      const resourceGuid = $(entry).attr('entry') ?? '';
      if (!resourceGuid || resources.has(resourceGuid)) return;
      resources.set(resourceGuid, { resourceClass, resourceNameKey });
    });
  }

  return resources;
}

function linkedClass(record: DataCoreRecordNode | undefined): string {
  return record?.entityClass ?? '';
}

function firstLocalizationKey(values: string[]): string {
  for (const value of values) {
    const key = normalizeLocalizationKey(value);
    if (key && key !== 'LOC_EMPTY' && key !== 'LOC_PLACEHOLDER' && key !== 'LOC_UNINITIALIZED') return key;
  }
  return '';
}

function normalizeLocalizationKey(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
}

function resourceClassFromNameKey(nameKey: string): string {
  if (!nameKey.startsWith('items_commodities_')) return '';
  const slug = nameKey.slice('items_commodities_'.length);
  return slug.replace(/_([a-z0-9])/gi, (_, char: string) => char.toUpperCase());
}
