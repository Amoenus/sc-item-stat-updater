import type { ContractRowDTO } from '../../schema/mission/mission-rows.schema.js';
import type { ScmdbContractDTO as ContractDTO } from '../../schema/scmdb.schemas';

export interface ChainDataDTO {
  isBlueprintReward: Map<string, boolean>;
  blueprintChainDepth: Map<string, number>;
}

export function buildTagProviders(contracts: ContractDTO[]): Map<string, string[]> {
  const tagProviders = new Map<string, string[]>();
  for (const contract of contracts) {
    if (!contract.completionTags) continue;
    for (const completionTag of contract.completionTags) {
      const tag = completionTag.tag;
      const list = tagProviders.get(tag) ?? [];
      list.push(contract.id);
      tagProviders.set(tag, list);
    }
  }
  return tagProviders;
}

export function getRequiredTags(contract: ContractDTO): string[] {
  return contract.prerequisites.completedContractTags?.tags ?? [];
}

export function seedBlueprintQueue(
  contracts: ContractDTO[],
  tagProviders: Map<string, string[]>,
  isBlueprintReward: Map<string, boolean>,
  blueprintChainDepth: Map<string, number>,
): Array<{ contractId: string; depth: number }> {
  const queue: Array<{ contractId: string; depth: number }> = [];
  for (const contract of contracts) {
    if (!contract.blueprintRewards || contract.blueprintRewards.length === 0) continue;
    isBlueprintReward.set(contract.id, true);
    blueprintChainDepth.set(contract.id, 0);
    for (const tag of getRequiredTags(contract)) {
      for (const providerId of tagProviders.get(tag) ?? []) {
        queue.push({ contractId: providerId, depth: 1 });
      }
    }
  }
  return queue;
}

export function enqueuePrerequisites(
  contractId: string,
  depth: number,
  contract: ContractDTO,
  tagProviders: Map<string, string[]>,
  queue: Array<{ contractId: string; depth: number }>,
): void {
  for (const tag of getRequiredTags(contract)) {
    for (const providerId of tagProviders.get(tag) ?? []) {
      if (providerId === contractId) continue;
      queue.push({ contractId: providerId, depth: depth + 1 });
    }
  }
}

export function propagateChainDepths(
  queue: Array<{ contractId: string; depth: number }>,
  contractById: Map<string, ContractDTO>,
  blueprintChainDepth: Map<string, number>,
  tagProviders: Map<string, string[]>,
): void {
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    const { contractId, depth } = item;
    const currentDepth = blueprintChainDepth.get(contractId);
    if (currentDepth !== undefined && currentDepth <= depth) continue;
    blueprintChainDepth.set(contractId, depth);
    const contract = contractById.get(contractId);
    if (!contract) continue;
    enqueuePrerequisites(contractId, depth, contract, tagProviders, queue);
  }
}

/**
 * Collects chain data for blueprint missions.
 */
export function collectBlueprintChainData(contracts: ContractDTO[]): ChainDataDTO {
  const contractById = new Map(contracts.map((contract) => [contract.id, contract]));
  const tagProviders = buildTagProviders(contracts);
  const isBlueprintReward = new Map<string, boolean>();
  const blueprintChainDepth = new Map<string, number>();
  const queue = seedBlueprintQueue(contracts, tagProviders, isBlueprintReward, blueprintChainDepth);
  propagateChainDepths(queue, contractById, blueprintChainDepth, tagProviders);
  return { isBlueprintReward, blueprintChainDepth };
}

export function buildBlueprintRowFields(
  contractId: string,
  chainData: ChainDataDTO,
): Pick<ContractRowDTO, 'isBlueprintReward' | 'isBlueprintChainPrerequisite' | 'blueprintChainDepth'> {
  const isBlueprintReward = chainData.isBlueprintReward.get(contractId) === true;
  const depth = chainData.blueprintChainDepth.get(contractId);
  return {
    isBlueprintReward: isBlueprintReward ? 'true' : 'false',
    isBlueprintChainPrerequisite: depth !== undefined && depth > 0 ? 'true' : 'false',
    blueprintChainDepth: depth === undefined ? '' : String(depth),
  };
}
