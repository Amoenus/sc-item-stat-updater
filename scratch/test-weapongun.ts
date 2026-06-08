import { parse } from 'csv-parse/sync';
import fs from 'fs';
import weaponGuns from '../src/items/datacore/weapon-guns';
import { nameKeyToDescKey } from '../src/enrichment/desc-key-matchers';

const csv = fs.readFileSync('csv/datacore/4.8.1-live.11875683/weapongun.datacore.csv', 'utf8');
const records = parse(csv, { columns: true });
const row = records.find((r: any) => r['Entity Class'] === 'kbar_ballisticcannon_s1');
console.log('Row:', row);
console.log('Target Keys:', weaponGuns.default.getTargetKeys(row, nameKeyToDescKey));
