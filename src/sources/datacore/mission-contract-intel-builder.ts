import type { DataCoreMissionBrokerRecord, DataCoreMissionContractIntelRecord } from './types';

export function buildDataCoreMissionContractIntel(
  rows: DataCoreMissionBrokerRecord[],
): DataCoreMissionContractIntelRecord[] {
  return rows
    .map((row) => buildMissionContractIntelRow(row))
    .filter((row): row is DataCoreMissionContractIntelRecord => row !== null);
}

function buildMissionContractIntelRow(row: DataCoreMissionBrokerRecord): DataCoreMissionContractIntelRecord | null {
  const descriptionKey = row.descriptionKey.trim();
  if (!descriptionKey) return null;

  const reward = parsePositiveNumber(row.reward);
  const timeLimit = parsePositiveNumber(row.missionCompletionTime);
  const cooldown = hasPersonalCooldown(row) ? formatCooldownMinutes(Number(row.personalCooldownTime)) : '';
  const rewardText = reward ? formatCurrency(reward, row.currencyType) : '';
  const timeLimitText = timeLimit ? formatTimeLimit(timeLimit) : '';
  const lines = [
    rewardText ? `Reward: ${rewardText}` : '',
    timeLimitText ? `Time Limit: ${timeLimitText}` : '',
    cooldown ? `Cooldown: ${cooldown}` : '',
  ].filter(Boolean);

  if (lines.length === 0) return null;

  return {
    missionClass: row.missionClass,
    descriptionKey,
    contractIntel: lines.join(String.raw`\n`),
    cooldown,
    reward: reward ? String(reward) : '',
    rewardCurrency: row.currencyType,
    timeLimit: timeLimit ? String(timeLimit) : '',
    efficiency: '',
    missionDifficulty: row.missionDifficulty,
    recordGuid: row.recordGuid,
    recordPath: row.recordPath,
  };
}

function hasPersonalCooldown(row: DataCoreMissionBrokerRecord): boolean {
  return row.hasPersonalCooldown === '1' && parsePositiveNumber(row.personalCooldownTime) !== undefined;
}

function parsePositiveNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formatCurrency(value: number, currencyType: string): string {
  const currency = currencyType === 'UEC' || !currencyType ? 'aUEC' : currencyType;
  return `${Math.round(value).toLocaleString('en-US')} ${currency}`;
}

function formatTimeLimit(minutes: number): string {
  return Number.isInteger(minutes) ? `${minutes} min` : `${minutes.toFixed(1)} min`;
}

function formatCooldownMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}
