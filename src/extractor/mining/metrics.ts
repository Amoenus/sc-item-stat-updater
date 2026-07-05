export function deriveMiningDifficulty(el: {
  resistance?: number;
  instability?: number;
  optimalWindowThinness?: number;
  optimalWindowRandomness?: number;
  explosionMultiplier?: number;
}): string {
  const score =
    (el.resistance ?? 0) * 2 +
    (el.instability ?? 0) / 350 +
    (el.optimalWindowThinness ?? 0) / 2 +
    (el.optimalWindowRandomness ?? 0) * 2 +
    (el.explosionMultiplier ?? 0) / 5;
  if (score >= 6) return 'Extreme';
  if (score >= 4.8) return 'Volatile';
  if (score >= 3.6) return 'Difficult';
  if (score >= 2.2) return 'Moderate';
  return 'Easy';
}

export const DIFFICULTY_SCORE: Record<string, number> = {
  Easy: 1,
  Moderate: 2,
  Difficult: 3,
  Volatile: 4,
  Extreme: 5,
};

export function deriveVolatilityNote(el: { instability?: number; explosionMultiplier?: number }): string {
  const instability = el.instability ?? 0;
  const explosion = el.explosionMultiplier ?? 0;
  if (explosion >= 8 || instability >= 650) return 'Extreme fracture risk';
  if (explosion >= 5 || instability >= 450) return 'High explosion risk';
  if (instability >= 250) return 'Unstable charge behavior';
  return 'Low volatility';
}

export function deriveClusterNote(clusterFactor: number | undefined): string {
  if (clusterFactor === undefined) return '';
  if (clusterFactor >= 0.65) return 'Cluster-prone';
  if (clusterFactor >= 0.3) return 'Occasional clusters';
  return 'Isolated';
}
