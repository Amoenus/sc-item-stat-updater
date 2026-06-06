import type { DataCoreContractGeneratorIntelRecord, DataCoreContractGeneratorRecord } from './types';

export function buildDataCoreContractGeneratorIntel(
  rows: DataCoreContractGeneratorRecord[],
): DataCoreContractGeneratorIntelRecord[] {
  return rows.flatMap((row) => buildContractGeneratorIntelRows(row));
}

function buildContractGeneratorIntelRows(row: DataCoreContractGeneratorRecord): DataCoreContractGeneratorIntelRecord[] {
  const timeLimit = parsePositiveNumber(row.timeToComplete);
  const buyIn = parsePositiveNumber(row.contractBuyInAmount);
  const lines = [
    timeLimit ? `Time Limit: ${formatTimeLimit(timeLimit)}` : '',
    buyIn ? `Buy-in: ${formatUec(buyIn)}` : '',
  ].filter(Boolean);

  if (lines.length === 0) return [];

  return descriptionKeys(row).map(({ key, role }) => ({
    generatorClass: row.generatorClass,
    contractId: row.contractId,
    contractDebugName: row.contractDebugName,
    templateClass: row.templateClass,
    descriptionKey: key,
    descriptionKeyRole: role,
    contractIntel: lines.join(String.raw`\n`),
    timeLimit: timeLimit ? String(timeLimit) : '',
    contractBuyInAmount: buyIn ? String(buyIn) : '',
    difficultyProfileClass: row.difficultyProfileClass,
    recordGuid: row.recordGuid,
    recordPath: row.recordPath,
  }));
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
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

function parsePositiveNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formatUec(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} aUEC`;
}

function formatTimeLimit(minutes: number): string {
  return Number.isInteger(minutes) ? `${minutes} min` : `${minutes.toFixed(1)} min`;
}
