import fs from 'node:fs/promises';
import { parse } from 'csv-parse/sync';

async function main() {
  const datacoreCsv = await fs.readFile('csv/datacore/4.8.1-live.11875683/contract-hauling-summary.datacore.csv', 'utf8');
  const datacoreRecords = parse(datacoreCsv, { columns: true }) as any[];

  const scmdbCsv = await fs.readFile('csv/scmdb/4.8.1-live.11875683/missions/scmdb-missions.csv', 'utf8');
  const scmdbRecords = parse(scmdbCsv, { columns: true }) as any[];

  const scmdbHaulingMap = new Map<string, string>();
  for (const row of scmdbRecords) {
    if (row['HaulingSummary']) {
      scmdbHaulingMap.set(row['Localization Key'], row['HaulingSummary']);
    }
  }

  const iniStr = await fs.readFile('global.ini', 'utf8');
  const globalIni = new Map<string, string>();
  for (const line of iniStr.split('\n')) {
    const splitIndex = line.indexOf('=');
    if (splitIndex !== -1) {
      const key = line.slice(0, splitIndex).trim();
      const value = line.slice(splitIndex + 1).trim();
      globalIni.set(key, value);
    }
  }

  const datacoreHaulingMap = new Map<string, string>();
  for (const row of datacoreRecords) {
    let summary = row['Hauling Summary'];
    // Translate any @key strings
    summary = summary.replace(/@([A-Za-z0-9_]+)/g, (match: string, key: string) => {
      return globalIni.get(key) || match;
    });
    datacoreHaulingMap.set(row['Description Key'], summary);
  }

  let matchCount = 0;
  let mismatchCount = 0;
  let missingInDataCore = 0;

  for (const [key, scmdbValue] of scmdbHaulingMap.entries()) {
    const datacoreValue = datacoreHaulingMap.get(key);
    if (!datacoreValue) {
      missingInDataCore++;
      if (missingInDataCore <= 5) console.log(`Missing in DataCore: ${key} (SCMDB: ${scmdbValue})`);
      continue;
    }
    
    // Normalize string representation to handle spaces or formatting differences
    const normScmdb = scmdbValue.trim();
    const normDatacore = datacoreValue.trim();
    
    if (normScmdb === normDatacore) {
      matchCount++;
    } else {
      mismatchCount++;
      console.log(`Mismatch for ${key}:`);
      console.log(`  SCMDB:    ${normScmdb}`);
      console.log(`  DataCore: ${normDatacore}`);
    }
  }

  console.log(`\nComparison Summary:`);
  console.log(`  SCMDB Hauling Rows:  ${scmdbHaulingMap.size}`);
  console.log(`  DataCore Hauling:    ${datacoreHaulingMap.size}`);
  console.log(`  Matches:             ${matchCount}`);
  console.log(`  Mismatches:          ${mismatchCount}`);
  console.log(`  Missing in DataCore: ${missingInDataCore}`);
}

main().catch(console.error);
