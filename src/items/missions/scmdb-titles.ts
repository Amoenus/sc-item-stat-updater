/**
 * Mission update config for SCMDB-derived mission titles.
 *
 * Handles keys matching `/_title/i` — strips any existing BP/Chain tag suffix
 * and optionally appends a TitleNote.
 */
import { IniTag } from '../../localization/ini-tags';
import type { ItemConfig } from '../../lib/types';

function formatTitleNote(noteText: string): string {
  if (!noteText) {
    return '';
  }
  return /^\s/.test(noteText) ? noteText : ` ${noteText}`;
}

function rebuildTitleValue(oldValue: string, noteText: string | undefined, note: string): string {
  const normalizedOldValue = oldValue
    .replace(
      new RegExp(
        String.raw`(?:\s*(?:${IniTag.EM4.open}\[(?:Intro|BP(?: Chain)?)\]${IniTag.EM4.close}|\[(?:Intro|BP(?: Chain)?)\]))+\s*$`,
      ),
      '',
    )
    .trimEnd();
  return noteText ? `${normalizedOldValue}${note}` : normalizedOldValue;
}

export default {
  label: 'SCMDB mission titles',
  csvFile: 'missions/scmdb-missions.csv',
  requiredColumns: ['Localization Key', 'Description'],
  noInsert: true,
  descKeyMatch: (key) => /_title/i.test(key),
  getTargetKeys(row) {
    const key = row['Localization Key'] ?? '';
    return /_title/i.test(key) ? [key] : [];
  },
  buildValue(row, _flavorText, oldValue, _targetKey) {
    const description = row['Description'] ?? row['Text'] ?? '';
    const noteText = row['TitleNote'];
    const note = formatTitleNote(noteText ?? '');

    if (oldValue) {
      return rebuildTitleValue(oldValue, noteText, note);
    }

    return description + note;
  },
} satisfies ItemConfig;
