import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const GENERATED_DATA_GUARD_PATHS = ['csv', 'global.ini'] as const;

export interface GeneratedDataChange {
  status: string;
  path: string;
}

export class GeneratedDataChurnError extends Error {
  changes: GeneratedDataChange[];

  constructor(changes: GeneratedDataChange[]) {
    super(formatGeneratedDataChurnMessage(changes));
    this.name = 'GeneratedDataChurnError';
    this.changes = changes;
  }
}

export function parseGitPorcelainStatus(output: string): GeneratedDataChange[] {
  return output
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => {
      const status = line.slice(0, 2);
      const rawPath = line.slice(3);
      const path = rawPath.includes(' -> ') ? (rawPath.split(' -> ').at(-1) ?? rawPath) : rawPath;
      return { status, path };
    });
}

export function formatGeneratedDataChurnMessage(changes: GeneratedDataChange[]): string {
  const changedPaths = changes.map((change) => `- ${change.status} ${change.path}`).join('\n');
  return [
    'Generated-data churn detected after a no-write verification command.',
    '',
    changedPaths,
    '',
    'Dry-run/help/test flows should not modify repository csv/ data or root global.ini.',
    'Use fixtures or temporary directories for intentional writes, then rerun the guard.',
  ].join('\n');
}

export async function findGeneratedDataChurn(repoRoot = process.cwd()): Promise<GeneratedDataChange[]> {
  const { stdout } = await execFileAsync('git', ['status', '--porcelain', '--', ...GENERATED_DATA_GUARD_PATHS], {
    cwd: repoRoot,
  });
  return parseGitPorcelainStatus(stdout);
}

export async function assertNoGeneratedDataChurn(repoRoot = process.cwd()): Promise<void> {
  const changes = await findGeneratedDataChurn(repoRoot);
  if (changes.length > 0) {
    throw new GeneratedDataChurnError(changes);
  }
}
