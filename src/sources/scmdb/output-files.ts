import type { ScmdbOutputRows } from './outputs';
import {
  SCMDB_BLUEPRINT_POOL_HEADERS,
  SCMDB_CONTRACT_BLUEPRINT_HEADERS,
  SCMDB_CONTRACT_HEADERS,
  SCMDB_MINING_ELEMENT_HEADERS,
  SCMDB_MINING_JOURNAL_HEADERS,
  SCMDB_MINING_LOCATION_HEADERS,
  SCMDB_MISSION_HEADERS,
} from './outputs';

export interface ScmdbOutputFile {
  fileName: string;
  section: 'root' | 'missions';
  rows: Record<string, unknown>[];
  headers: string[];
}

export function planScmdbOutputFiles(rows: ScmdbOutputRows): ScmdbOutputFile[] {
  const files: ScmdbOutputFile[] = [
    {
      fileName: 'scmdb-missions.csv',
      section: 'missions',
      rows: toCsvRows(rows.missionRows),
      headers: SCMDB_MISSION_HEADERS,
    },
    {
      fileName: 'contracts.csv',
      section: 'root',
      rows: toCsvRows(rows.contractRows),
      headers: SCMDB_CONTRACT_HEADERS,
    },
    {
      fileName: 'legacy-contracts.csv',
      section: 'root',
      rows: toCsvRows(rows.legacyRows),
      headers: SCMDB_CONTRACT_HEADERS,
    },
    {
      fileName: 'blueprint-pools.csv',
      section: 'root',
      rows: toCsvRows(rows.blueprintPoolRows),
      headers: SCMDB_BLUEPRINT_POOL_HEADERS,
    },
    {
      fileName: 'mining-elements.csv',
      section: 'root',
      rows: toCsvRows(rows.miningElementRows),
      headers: SCMDB_MINING_ELEMENT_HEADERS,
    },
    {
      fileName: 'mining-journal.csv',
      section: 'root',
      rows: toCsvRows(rows.miningJournalRows),
      headers: SCMDB_MINING_JOURNAL_HEADERS,
    },
    {
      fileName: 'mining-locations.csv',
      section: 'root',
      rows: toCsvRows(rows.miningLocationRows),
      headers: SCMDB_MINING_LOCATION_HEADERS,
    },
    {
      fileName: 'contract-blueprint-rewards.csv',
      section: 'root',
      rows: toCsvRows(rows.contractBlueprintRows),
      headers: SCMDB_CONTRACT_BLUEPRINT_HEADERS,
    },
  ];
  return files.filter((file) => file.rows.length > 0);
}

function toCsvRows<T extends object>(rows: T[]): Record<string, unknown>[] {
  return rows as Record<string, unknown>[];
}
