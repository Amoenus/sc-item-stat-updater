/**
 * Mission update config for SCMDB-derived mission descriptions.
 *
 * The CSV should include a localization key and the mission text to write
 * into `global.ini`. This module allows mission updates to be processed
 * through the existing updater engine.
 */
export default {
  label: 'SCMDB mission descriptions',
  csvFile: 'missions/scmdb-missions.csv',
  requiredColumns: ['Localization Key', 'Description'],
  descKeyMatch: (key) => /_desc|_description/i.test(key),
  buildValue(row) {
    return row['Description'] ?? row['Text'] ?? '';
  },
};
