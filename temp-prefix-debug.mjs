import fs from 'node:fs/promises';
import { parseCSV } from './src/lib/io/csv-parser.js';
import { readIniFile } from './src/lib/io/ini-file.js';
import { buildReverseNameIndex } from './src/lib/key-resolver.js';
import { buildComponentDisplayName } from './src/lib/format/component-name-prefix.js';

const csv = await fs.readFile('./csv/erkul/quantum_drives.csv', 'utf-8');
const rows = parseCSV(csv);
const itemNames = ['Hemera', 'Khaos', 'Wayfare', 'Beacon', 'Vortex', 'ExoGen'];
const filtered = rows.filter((r) => itemNames.includes(r.Name));
const { lines } = await readIniFile('./global.ini');
const reverseIndex = buildReverseNameIndex(lines);
for (const r of filtered) {
  const locKey = reverseIndex.get(r.Name);
  console.log(r.Name, 'csvKey=', r['Localization Key'], 'resolvedKey=', locKey, 'display=', buildComponentDisplayName(r, rows));
}
