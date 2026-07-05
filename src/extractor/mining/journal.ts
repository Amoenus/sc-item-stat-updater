import type {
  ScmdbMiningDataDTO as MiningDataDTO,
  ScmdbMiningJournalRowDTO as MiningJournalRowDTO,
} from '../../schema/scmdb.schemas.js';
import { ScmdbMiningJournalRowSchema } from '../../schema/scmdb.schemas.js';
import { buildRefineryHint } from './elements.js';
import { DIFFICULTY_SCORE, deriveMiningDifficulty, deriveVolatilityNote } from './metrics.js';

export function buildMiningJournalRows(miningData: MiningDataDTO): MiningJournalRowDTO[] {
  const rarityMap: Record<string, string[]> = {};
  for (const el of Object.values(miningData.mineableElements || {})) {
    const rarity = (el.rarity || 'Unknown').toLowerCase();
    const cat = rarity.charAt(0).toUpperCase() + rarity.slice(1);
    if (!rarityMap[cat]) rarityMap[cat] = [];
    rarityMap[cat].push(el.name);
  }
  const journal: MiningJournalRowDTO[] = [];
  for (const [cat, list] of Object.entries(rarityMap)) {
    list.sort((a, b) => a.localeCompare(b));
    journal.push(
      ScmdbMiningJournalRowSchema.parse({
        'Rarity Category': cat,
        'Element List': list.join('\n'),
        'Insight Summary': '',
      }),
    );
  }
  const elements = Object.values(miningData.mineableElements || {});
  const hardest = elements
    .toSorted((a, b) => DIFFICULTY_SCORE[deriveMiningDifficulty(b)] - DIFFICULTY_SCORE[deriveMiningDifficulty(a)])
    .slice(0, 5)
    .map((el) => `${el.name} (${deriveMiningDifficulty(el)})`);
  const volatile = elements
    .toSorted(
      (a, b) =>
        (b.explosionMultiplier ?? 0) +
        (b.instability ?? 0) / 100 -
        ((a.explosionMultiplier ?? 0) + (a.instability ?? 0) / 100),
    )
    .slice(0, 5)
    .map((el) => `${el.name} (${deriveVolatilityNote(el)})`);
  const refineryStandouts = elements
    .map((el) => ({ name: el.name, hint: buildRefineryHint(el.name, miningData) }))
    .filter((entry) => entry.hint)
    .slice(0, 5)
    .map((entry) => `${entry.name}: ${entry.hint}`);
  const insightLines = [
    hardest.length ? `Hardest: ${hardest.join(', ')}` : '',
    volatile.length ? `Most Volatile: ${volatile.join(', ')}` : '',
    refineryStandouts.length ? `Refinery Standouts: ${refineryStandouts.join('; ')}` : '',
  ].filter(Boolean);
  if (insightLines.length) {
    journal.unshift(
      ScmdbMiningJournalRowSchema.parse({
        'Rarity Category': 'Insights',
        'Element List': '',
        'Insight Summary': insightLines.join('\n'),
      }),
    );
  }
  return journal;
}
