import fs from 'node:fs/promises';
import { resolveChildPath } from '../../io/local/path-conventions';
import type {
  DataCoreContractTemplateHaulingOrderRecord,
  DataCoreRecordGraphLookup,
  DataCoreRecordNode,
} from './types';
import { loadXml } from './xml-parser';

const DEFAULT_CONTRACT_TEMPLATE_PATH_PREFIX = 'libs/foundry/records/contracts';

export interface ExtractDataCoreContractTemplateHaulingOptions {
  xmlCacheDir: string;
  graph: DataCoreRecordGraphLookup;
  contractTemplatePathPrefix?: string;
}

export async function extractDataCoreContractTemplateHaulingOrders(
  options: ExtractDataCoreContractTemplateHaulingOptions,
): Promise<DataCoreContractTemplateHaulingOrderRecord[]> {
  const records = options.graph
    .getByPathPrefix(options.contractTemplatePathPrefix ?? DEFAULT_CONTRACT_TEMPLATE_PATH_PREFIX)
    .filter((record) => record.rootType === 'ContractTemplate')
    .sort((a, b) => a.path.localeCompare(b.path));
  const rows: DataCoreContractTemplateHaulingOrderRecord[] = [];

  for (const record of records) {
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
          const resourceClass = linkedClass(options.graph.getByRef(resourceGuid));
          rows.push({
            templateClass: record.entityClass,
            objectiveDebugName,
            orderIndex: String(orderIndex + 1),
            resourceGuid,
            resourceClass,
            minSCU,
            maxSCU,
            maxContainerSize,
            orderSummary: formatOrderSummary({ resourceClass, resourceGuid, minSCU, maxSCU, maxContainerSize }),
            recordGuid: record.ref,
            recordPath: record.path,
          });
        });
    });
  }

  return rows;
}

function linkedClass(record: DataCoreRecordNode | undefined): string {
  return record?.entityClass ?? '';
}

function formatOrderSummary(order: {
  resourceClass: string;
  resourceGuid: string;
  minSCU: string;
  maxSCU: string;
  maxContainerSize: string;
}): string {
  const resource = order.resourceClass || order.resourceGuid;
  const amount =
    order.minSCU && order.maxSCU
      ? `${formatRange(order.minSCU, order.maxSCU)} SCU`
      : order.minSCU
        ? `${order.minSCU} SCU`
        : '';
  const container = Number(order.maxContainerSize) > 0 ? `, max ${formatNumber(order.maxContainerSize)} SCU` : '';
  return `${amount ? `${amount} ` : ''}${resource}${container}`;
}

function formatRange(min: string, max: string): string {
  return min === max ? formatNumber(min) : `${formatNumber(min)}-${formatNumber(max)}`;
}

function formatNumber(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : value;
}
