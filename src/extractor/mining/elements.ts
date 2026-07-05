import type {
  ScmdbMiningDataDTO as MiningDataDTO,
  ScmdbMiningElementRowDTO as MiningElementRowDTO,
} from '../../schema/scmdb.schemas.js';
import { ScmdbMiningElementRowSchema } from '../../schema/scmdb.schemas.js';
import { deriveClusterNote, deriveMiningDifficulty, deriveVolatilityNote } from './metrics.js';

export function formatQualityBands(bands: number[] | undefined): string {
  return bands?.length ? bands.map((band) => `${(band / 10).toFixed(1)}%`).join(' / ') : '';
}

export function buildRefineryHint(elementName: string, miningData: MiningDataDTO): string {
  const profiles = miningData.refineryProfiles ?? {};
  const refineries = Object.values(miningData.refineries ?? {});
  let bestBonus: number | null = null;
  let bestProfileIds: string[] = [];
  for (const [profileId, bonuses] of Object.entries(profiles)) {
    const bonus = bonuses[elementName];
    if (bonus === undefined) continue;
    if (bestBonus === null || bonus > bestBonus) {
      bestBonus = bonus;
      bestProfileIds = [profileId];
    } else if (bonus === bestBonus) {
      bestProfileIds.push(profileId);
    }
  }
  if (bestBonus === null || bestBonus <= 0) return '';
  const refineryNames = refineries
    .filter((refinery) => refinery.profileId && bestProfileIds.includes(refinery.profileId))
    .map((refinery) => refinery.name);
  const where =
    refineryNames.length === 1
      ? refineryNames[0]
      : refineryNames.length > 1
        ? `${refineryNames.length} refineries`
        : bestProfileIds[0];
  return `${where} (+${bestBonus})`;
}

export function buildMiningElementRows(miningData: MiningDataDTO): MiningElementRowDTO[] {
  const elements: MiningElementRowDTO[] = [];
  for (const [_id, el] of Object.entries(miningData.mineableElements || {})) {
    elements.push(
      ScmdbMiningElementRowSchema.parse({
        'Element Name': el.name,
        Rarity: el.rarity,
        'Ground Scan Signature': el.groundScanSignature,
        'FPS Scan Signature': el.fpsScanSignature,
        'Scan Signature': el.scanSignature,
        Resistance: el.resistance,
        Instability: el.instability,
        Density: el.density,
        'Optimal Window Midpoint': el.optimalWindowMidpoint,
        'Optimal Window Randomness': el.optimalWindowRandomness,
        'Optimal Window Thinness': el.optimalWindowThinness,
        'Explosion Multiplier': el.explosionMultiplier,
        'Cluster Factor': el.clusterFactor,
        'Quality Bands': formatQualityBands(el.qualityBands),
        'Material Name': el.materialName,
        'Mining Difficulty': deriveMiningDifficulty(el),
        'Volatility Note': deriveVolatilityNote(el),
        'Cluster Note': deriveClusterNote(el.clusterFactor),
        'Best Refinery': buildRefineryHint(el.name, miningData),
      }),
    );
  }
  return elements;
}
