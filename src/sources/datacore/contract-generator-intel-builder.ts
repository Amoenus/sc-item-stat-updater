import type {
  DataCoreContractGeneratorIntelRecord,
  DataCoreContractGeneratorRecord,
} from './types';

interface ReputationReward {
  amount: number;
  factionGuid?: string;
  scopeGuid?: string;
}

interface DescriptionIntelFacts {
  timeLimits: Set<number>;
  buyIns: Set<number>;
  reputationAmounts: Set<number>;
}

export function buildDataCoreContractGeneratorIntel(
  rows: DataCoreContractGeneratorRecord[],
  _options?: unknown,
): DataCoreContractGeneratorIntelRecord[] {
  const intelLinesByDescriptionKey = buildIntelLinesByDescriptionKey(rows);
  return rows.flatMap((row) => buildContractGeneratorIntelRows(row, intelLinesByDescriptionKey));
}

function buildContractGeneratorIntelRows(
  row: DataCoreContractGeneratorRecord,
  intelLinesByDescriptionKey: Map<string, string[]>,
): DataCoreContractGeneratorIntelRecord[] {
  const keys = descriptionKeys(row);

  return keys.flatMap(({ key, role }) => {
    const lines = intelLinesByDescriptionKey.get(key) ?? [];
    if (lines.length === 0) return [];
    return [
      {
        generatorClass: row.generatorClass,
        contractId: row.contractId,
        contractDebugName: row.contractDebugName,
        templateClass: row.templateClass,
        descriptionKey: key,
        descriptionKeyRole: role,
        contractIntel: lines.join(String.raw`\n`),
        timeLimit: formatRawNumberList(getFactsValue(intelLinesByDescriptionKey, key, 'timeLimits')),
        contractBuyInAmount: formatRawNumberList(getFactsValue(intelLinesByDescriptionKey, key, 'buyIns')),
        difficultyProfileClass: row.difficultyProfileClass,
        recordGuid: row.recordGuid,
        recordPath: row.recordPath,
      },
    ];
  });
}

const factsByDescriptionKeySymbol = Symbol('factsByDescriptionKey');

type IntelLinesByDescriptionKey = Map<string, string[]> & {
  [factsByDescriptionKeySymbol]?: Map<string, DescriptionIntelFacts>;
};

function buildIntelLinesByDescriptionKey(rows: DataCoreContractGeneratorRecord[]): IntelLinesByDescriptionKey {
  const factsByDescriptionKey = new Map<string, DescriptionIntelFacts>();
  const seen = new Set<string>();

  for (const row of rows) {
    const timeLimit = parsePositiveNumber(row.timeToComplete);
    const buyIn = parsePositiveNumber(row.contractBuyInAmount);
    const reputationAmounts = parseReputationRewards(row.successReputationRewards)
      .map((reward) => parsePositiveNumber(String(reward.amount)))
      .filter((amount): amount is number => amount !== undefined);
    for (const { key } of descriptionKeys(row)) {
      const seenKey = `${key}\0${row.contractId || row.contractDebugName || row.recordGuid}`;
      if (seen.has(seenKey)) continue;
      seen.add(seenKey);

      const facts = getOrCreateIntelFacts(factsByDescriptionKey, key);
      if (timeLimit) facts.timeLimits.add(timeLimit);
      if (buyIn) facts.buyIns.add(buyIn);
      for (const amount of reputationAmounts) facts.reputationAmounts.add(amount);
    }
  }

  const formatted = new Map<string, string[]>() as IntelLinesByDescriptionKey;
  formatted[factsByDescriptionKeySymbol] = factsByDescriptionKey;
  for (const [key, facts] of factsByDescriptionKey) {
    const lines = [
      formatVariantNumberLine('Time Limit', facts.timeLimits, formatTimeLimit),
      formatVariantNumberLine('Buy-in', facts.buyIns, formatUec),
      formatReputationLine(facts.reputationAmounts),
    ].filter(Boolean);
    if (lines.length > 0) formatted.set(key, lines);
  }

  return formatted;
}

function getOrCreateIntelFacts(
  factsByDescriptionKey: Map<string, DescriptionIntelFacts>,
  key: string,
): DescriptionIntelFacts {
  let facts = factsByDescriptionKey.get(key);
  if (!facts) {
    facts = { timeLimits: new Set<number>(), buyIns: new Set<number>(), reputationAmounts: new Set<number>() };
    factsByDescriptionKey.set(key, facts);
  }
  return facts;
}

function getFactsValue(
  linesByDescriptionKey: IntelLinesByDescriptionKey,
  key: string,
  field: keyof DescriptionIntelFacts,
): Set<number> {
  return linesByDescriptionKey[factsByDescriptionKeySymbol]?.get(key)?.[field] ?? new Set<number>();
}

function formatVariantNumberLine(
  label: string,
  values: Set<number>,
  formatter: (value: number) => string,
): string {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  if (sorted.length === 1) return `${label}: ${formatter(sorted[0])}`;
  return `${label} (by variant): ${sorted.map(formatter).join(' / ')}`;
}

function formatReputationLine(values: Set<number>): string {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  if (sorted.length === 1) return `Reputation Awarded: ${formatPlainNumber(sorted[0])}`;
  return `Reputation Awarded (by difficulty): ${sorted.map(formatPlainNumber).join(' / ')}`;
}

function formatRawNumberList(values: Set<number>): string {
  return [...values].sort((a, b) => a - b).join(' | ');
}

function parseReputationRewards(value: string): ReputationReward[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): ReputationReward[] => {
      if (!entry || typeof entry !== 'object') return [];
      const reward = entry as Partial<ReputationReward>;
      const amount = Number(reward.amount);
      return Number.isFinite(amount) ? [{ ...reward, amount }] : [];
    });
  } catch {
    return [];
  }
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

function formatPlainNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function formatTimeLimit(minutes: number): string {
  return Number.isInteger(minutes) ? `${minutes} min` : `${minutes.toFixed(1)} min`;
}
