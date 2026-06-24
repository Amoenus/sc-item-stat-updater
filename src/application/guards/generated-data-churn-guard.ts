import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const GENERATED_DATA_GUARD_PATHS = ['csv', 'global.ini'] as const;

export type GeneratedDataOwnershipClass =
  | 'Committed artifact'
  | 'Rebuildable local cache'
  | 'Raw source snapshot'
  | 'Derived source output'
  | 'Diagnostic-only output'
  | 'Obsolete historical output';

export interface GeneratedDataOwnership {
  ownershipClass: GeneratedDataOwnershipClass;
  policy: string;
}

export interface GeneratedDataChange {
  status: string;
  path: string;
  ownership: GeneratedDataOwnership;
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
      return { status, path, ownership: classifyGeneratedDataPath(path) };
    })
    .filter(isWorktreeGeneratedDataChange);
}

export function formatGeneratedDataChurnMessage(changes: GeneratedDataChange[]): string {
  const changedPaths = changes
    .map((change) => `- ${change.status} ${change.path} [${change.ownership.ownershipClass}]`)
    .join('\n');
  const ownershipPolicies = [
    ...new Map(changes.map((change) => [change.ownership.ownershipClass, change.ownership.policy])).entries(),
  ]
    .map(([ownershipClass, policy]) => `- ${ownershipClass}: ${policy}`)
    .join('\n');
  return [
    'Generated-data churn detected after a no-write verification command.',
    '',
    changedPaths,
    '',
    'Ownership guidance:',
    ownershipPolicies,
    '',
    'Dry-run/help/test flows should not modify repository csv/ data or root global.ini.',
    'Use fixtures or temporary directories for intentional writes, or stage an intentional generated-data refresh before rerunning the guard.',
  ].join('\n');
}

export function classifyGeneratedDataPath(path: string): GeneratedDataOwnership {
  const normalizedPath = path.replaceAll('\\', '/');

  if (normalizedPath === 'global.ini') {
    return {
      ownershipClass: 'Committed artifact',
      policy: 'Commit only intentional localization artifact refreshes.',
    };
  }

  if (/^csv\/datacore\/\.(?:dcbcache|xmlcache)\//.test(normalizedPath)) {
    return {
      ownershipClass: 'Rebuildable local cache',
      policy: 'Do not commit by default; restore, remove, or explicitly exempt machine-local cache churn.',
    };
  }

  if (/^csv\/datacore\/[^/]+\/record-graph(?:\.metadata)?\.json$/.test(normalizedPath)) {
    return {
      ownershipClass: 'Derived source output',
      policy: 'Commit only intentional DataCore source-version refreshes with matching metadata.',
    };
  }

  if (/^csv\/datacore\/[^/]+\/.*\.datacore\.csv$/.test(normalizedPath)) {
    return {
      ownershipClass: 'Derived source output',
      policy: 'Commit only intentional DataCore source-version refreshes.',
    };
  }

  if (/^csv\/scmdb\/[^/]+\/(?:scmdb-versions|merged-|mining-data-|crafting_items-|mema-cache)/.test(normalizedPath)) {
    return {
      ownershipClass: 'Raw source snapshot',
      policy: 'Commit only intentional SCMDB source-version refreshes.',
    };
  }

  if (/^csv\/scmdb\/[^/]+\/.*(?:\.csv|\.json)$/.test(normalizedPath)) {
    return {
      ownershipClass: 'Derived source output',
      policy: 'Commit only intentional SCMDB bridge or fallback refreshes.',
    };
  }

  return {
    ownershipClass: 'Diagnostic-only output',
    policy: 'Commit only when tied to an active migration or audit; otherwise prune.',
  };
}

function isWorktreeGeneratedDataChange(change: GeneratedDataChange): boolean {
  if (change.status === '??') return true;
  return change.status[1] !== ' ';
}

async function findGeneratedDataChurn(repoRoot = process.cwd()): Promise<GeneratedDataChange[]> {
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
