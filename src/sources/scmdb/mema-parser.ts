import type { ScmdbMemaCacheDTO, ScmdbMergedDTO } from '../../schema/scmdb.schemas';

export function buildMemaRows(memaData: ScmdbMemaCacheDTO, mergedData: ScmdbMergedDTO): Record<string, string>[] {
  const rows: Record<string, string>[] = [];

  const contractMap = new Map<string, { rewardUEC: number | null; descriptionKey: string }>();
  for (const contract of mergedData.contracts) {
    if (contract.descriptionKey) {
      contractMap.set(contract.id, {
        rewardUEC: contract.rewardUEC,
        descriptionKey: contract.descriptionKey,
      });
    }
  }
  for (const contract of mergedData.legacyContracts) {
    if (contract.descriptionKey) {
      contractMap.set(contract.id, {
        rewardUEC: contract.rewardUEC,
        descriptionKey: contract.descriptionKey,
      });
    }
  }

  for (const entry of memaData) {
    if (entry.n === 0) continue; // Skip if no runs recorded

    const contractInfo = contractMap.get(entry.contract_id);
    if (!contractInfo) continue;

    const reward = contractInfo.rewardUEC;
    const memaUec = entry.rate_p50 && reward ? Math.round(entry.rate_p50 * reward) : null;

    rows.push({
      description_key: contractInfo.descriptionKey,
      mema_uec: memaUec ? memaUec.toString() : '',
      rate_p50: entry.rate_p50 ? entry.rate_p50.toString() : '',
      dur_avg: entry.dur_avg ? entry.dur_avg.toString() : '',
      avg_diff: entry.avg_diff ? entry.avg_diff.toString() : '',
      avg_sat: entry.avg_sat ? entry.avg_sat.toString() : '',
      runs: entry.n.toString(),
    });
  }

  return rows;
}
