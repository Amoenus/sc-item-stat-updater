import type {
  DataCoreContractGeneratorRecord,
  DataCoreContractHaulingSummaryRecord,
  DataCoreContractTemplateHaulingOrderRecord,
} from './types';

export function buildDataCoreContractHaulingSummary(
  generators: DataCoreContractGeneratorRecord[],
  haulingOrders: DataCoreContractTemplateHaulingOrderRecord[],
): DataCoreContractHaulingSummaryRecord[] {
  const ordersByTemplate = new Map<string, DataCoreContractTemplateHaulingOrderRecord[]>();
  for (const order of haulingOrders) {
    let orders = ordersByTemplate.get(order.recordGuid);
    if (!orders) {
      orders = [];
      ordersByTemplate.set(order.recordGuid, orders);
    }
    orders.push(order);
  }

  return generators.flatMap((row) => {
    const orders = ordersByTemplate.get(row.templateGuid);
    if (!orders || orders.length === 0) return [];

    const haulingSummary = `Order: ${orders.map(formatOrderSummary).join(' + ')}`;

    return descriptionKeys(row).map(({ key, role }) => ({
      generatorClass: row.generatorClass,
      contractId: row.contractId,
      contractDebugName: row.contractDebugName,
      templateClass: row.templateClass,
      descriptionKey: key,
      descriptionKeyRole: role,
      haulingSummary,
      recordGuid: row.recordGuid,
      recordPath: row.recordPath,
    }));
  });
}

function descriptionKeys(row: DataCoreContractGeneratorRecord): Array<{ key: string; role: string }> {
  const keys: Array<{ key: string; role: string }> = [];
  const primary = normalizeKey(row.descriptionKey);
  if (primary) keys.push({ key: primary, role: 'primary' });

  for (const variant of splitPipe(row.descriptionVariantKeys)) {
    const key = normalizeKey(variant);
    if (key && !keys.some((entry) => entry.key === key)) keys.push({ key, role: 'variant' });
  }

  return keys;
}

function splitPipe(value: string): string[] {
  return value
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '@LOC_EMPTY' || trimmed === '@LOC_UNINITIALIZED') return '';
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

function formatOrderSummary(order: DataCoreContractTemplateHaulingOrderRecord): string {
  const resource = order.resourceNameKey ? `@${order.resourceNameKey}` : order.resourceClass || order.resourceGuid;
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
