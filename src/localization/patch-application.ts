import type { PatchEntry, PatchPlan } from '../pipeline/types';

export interface LocalizationPatchEntry extends PatchEntry {
  /**
   * Application-only hint for duplicate/suffixed INI keys. This must stay out
   * of serialized artifacts and the core PatchEntry contract.
   */
  existingLineIndex?: number;
}

export interface LocalizationPatchPlan extends PatchPlan {
  entries: LocalizationPatchEntry[];
}

export interface PatchApplicationResult {
  lines: string[];
  appliedCount: number;
  missingCount: number;
  patches: Record<string, string>;
  missingKeys: string[];
  newLines: string[];
}

export interface ApplyPatchPlanOptions {
  insertMissing?: boolean;
  insertionIndex?: number;
}

export function applyLocalizationLinePatch(
  lines: string[],
  lineIndex: number,
  oldLine: string,
  foundKey: string,
  newValue: string,
  patches: Record<string, string>,
): void {
  const eqIdx = oldLine.indexOf('=');
  const lineKey = eqIdx > -1 ? oldLine.substring(0, eqIdx) : foundKey;
  lines[lineIndex] = `${lineKey}=${newValue}`;
  patches[foundKey] = newValue;
}

export function insertLocalizationEntries(lines: string[], newLines: string[], insertionIndex: number): void {
  if (newLines.length === 0) return;
  newLines.sort((a, b) => a.localeCompare(b));
  if (insertionIndex > -1) {
    for (let i = 0; i < newLines.length; i++) lines.splice(insertionIndex + 1 + i, 0, newLines[i]);
  } else {
    lines.push(...newLines);
  }
}

export function applyPatchPlanToIniLines(
  inputLines: string[],
  index: Record<string, number>,
  plan: LocalizationPatchPlan,
  options: ApplyPatchPlanOptions = {},
): PatchApplicationResult {
  const lines = [...inputLines];
  const patches: Record<string, string> = {};
  const missingKeys: string[] = [];
  const newLines: string[] = [];
  let appliedCount = 0;

  for (const entry of plan.entries) {
    const lineIndex = entry.existingLineIndex ?? index[entry.key];
    if (lineIndex == null) {
      missingKeys.push(entry.key);
      if (options.insertMissing) {
        newLines.push(`${entry.key}=${entry.value}`);
      }
      continue;
    }

    const oldLine = lines[lineIndex];
    const eqIdx = oldLine.indexOf('=');
    const oldValue = eqIdx > -1 ? oldLine.substring(eqIdx + 1) : '';
    if (oldValue !== entry.value) {
      applyLocalizationLinePatch(lines, lineIndex, oldLine, entry.key, entry.value, patches);
      appliedCount++;
    }
  }

  insertLocalizationEntries(lines, newLines, options.insertionIndex ?? -1);

  return {
    lines,
    appliedCount,
    missingCount: missingKeys.length,
    patches,
    missingKeys,
    newLines,
  };
}
