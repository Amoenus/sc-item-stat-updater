import assert from 'node:assert/strict';
import test from 'node:test';
import { planScmdbOutputFiles } from './output-files';
import type { ScmdbOutputRows } from './outputs';

test('planScmdbOutputFiles omits empty row groups', () => {
  assert.deepEqual(planScmdbOutputFiles(emptyRows()), []);
});

test('planScmdbOutputFiles returns output descriptors in scraper write order', () => {
  const files = planScmdbOutputFiles({
    ...emptyRows(),
    missionRows: [{ 'Localization Key': 'mission_desc' }] as never,
    contractRows: [{ id: 'contract-1' }] as never,
    miningJournalRows: [{ 'Rarity Category': 'Insights' }] as never,
  });

  assert.deepEqual(
    files.map((file) => ({ fileName: file.fileName, section: file.section })),
    [
      { fileName: 'scmdb-missions.csv', section: 'missions' },
      { fileName: 'contracts.csv', section: 'root' },
      { fileName: 'mining-journal.csv', section: 'root' },
    ],
  );
  assert.equal(files[0].headers[0], 'Localization Key');
  assert.equal(files[1].headers[0], 'id');
  assert.equal(files[2].headers[0], 'Rarity Category');
});

function emptyRows(): ScmdbOutputRows {
  return {
    missionRows: [],
    contractRows: [],
    legacyRows: [],
    blueprintPoolRows: [],
    contractBlueprintRows: [],
    miningElementRows: [],
    miningJournalRows: [],
    miningLocationRows: [],
  };
}
