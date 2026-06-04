import type {
  ScmdbBlueprintPoolsDTO as BlueprintPoolsDTO,
  ScmdbContractDTO as ContractDTO,
  ScmdbFactionDTO as FactionDTO,
  ScmdbFactionRewardsDTO as FactionRewardsDTO,
} from '../../schema/scmdb.schemas';

export interface FactionRewardsContext {
  factionRewards: Map<string, string>;
  factionRewardsRaw: Map<string, string>;
}

export function buildFactionRewardsString(pool: FactionRewardsDTO[], factionNames: Map<string, string>): string {
  return pool
    .map(({ factionGuid, amount }) => {
      const name = factionNames.get(factionGuid) ?? factionGuid;
      const sign = amount >= 0 ? '+' : '';
      return `${name}: ${sign}${amount}`;
    })
    .join(String.raw`\n`);
}

/**
 * Pre-computes faction reputation reward strings for all contracts.
 */
export function buildFactionRewardsContext(
  factionRewardsPools: FactionRewardsDTO[][],
  factions: Record<string, FactionDTO>,
  contracts: ContractDTO[],
): FactionRewardsContext {
  const factionNames = new Map<string, string>();
  for (const [guid, faction] of Object.entries(factions)) {
    if (faction.name) factionNames.set(guid, faction.name);
  }

  const factionRewards = new Map<string, string>();
  const factionRewardsRaw = new Map<string, string>();

  for (const contract of contracts) {
    const index = contract.factionRewardsIndex;
    if (index == null || index === 0) continue;
    const pool = factionRewardsPools[index];
    if (!pool || pool.length === 0) continue;
    factionRewards.set(contract.id, buildFactionRewardsString(pool, factionNames));
    factionRewardsRaw.set(
      contract.id,
      JSON.stringify(pool.map(({ factionGuid, amount }) => ({ factionGuid, amount }))),
    );
  }

  return { factionRewards, factionRewardsRaw };
}

export function formatDirectRewardLine(reward: NonNullable<ContractDTO['itemRewards']>[number]): string {
  const qty = reward.amount && reward.amount > 1 ? ` x${reward.amount}` : '';
  return `- ${reward.name}${qty}`;
}

export function formatGroupRewardLines(reward: NonNullable<ContractDTO['itemRewards']>[number]): string[] {
  const lines: string[] = [];
  for (const group of reward.groups ?? []) {
    if (Number.isFinite(group.probability) && group.probability < 1) {
      lines.push(`${Math.round(group.probability * 100)}% chance \u2014 1 of ${group.items.length}:`);
    }
    for (const item of group.items) {
      const qty = item.amount > 1 ? ` x${item.amount}` : '';
      lines.push(`- ${item.name}${qty}`);
    }
  }
  return lines;
}

/**
 * Builds a formatted item reward list string for use in mission descriptions.
 */
export function buildItemRewardList(contract: ContractDTO): string {
  if (!contract.itemRewards?.length) return '';
  const lines: string[] = [];
  for (const reward of contract.itemRewards) {
    if (reward.name) {
      lines.push(formatDirectRewardLine(reward));
    } else {
      lines.push(...formatGroupRewardLines(reward));
    }
  }
  return lines.join(String.raw`\n`);
}

/**
 * Builds a blueprint reward list.
 */
export function buildBlueprintRewardList(contract: ContractDTO, blueprintPools: BlueprintPoolsDTO): string {
  if (!contract.blueprintRewards) return '';

  const formatChance = (chance: number): string | null => {
    if (!Number.isFinite(chance)) return null;
    return `${Math.round(chance * 100)}% chance`;
  };

  const sections = [];
  for (const entry of contract.blueprintRewards) {
    const pool = blueprintPools[entry.blueprintPool];
    if (!pool) continue;

    const itemNames = pool.blueprints.map((blueprint) => blueprint.name ?? null).filter((n): n is string => Boolean(n));

    if (itemNames.length === 0) continue;

    const chanceText = formatChance(entry.chance);
    const oneOfText = `1 of ${itemNames.length}`;
    const details = chanceText ? `${chanceText} — ${oneOfText}` : oneOfText;
    const itemLines = itemNames.map((name) => `- ${name}`).join(String.raw`\n`);
    sections.push([details, itemLines].join(String.raw`\n`));
  }

  return sections.join(String.raw`\n\n`);
}
