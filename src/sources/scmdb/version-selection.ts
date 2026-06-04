export type ScmdbVersionEntry = { version: string; file: string };

export interface SelectScmdbVersionOptions {
  version?: string;
  ptu?: boolean;
}

export function isLiveVersion(version: string): boolean {
  return /\blive\b/i.test(version) || /-live\./i.test(version);
}

export function isPtuVersion(version: string): boolean {
  return /\bptu\b/i.test(version) || /-ptu\./i.test(version);
}

export function selectScmdbVersion(
  versions: ScmdbVersionEntry[],
  options: SelectScmdbVersionOptions = {},
): ScmdbVersionEntry {
  if (options.version) {
    const found = versions.find((entry) => entry.version === options.version);
    if (!found) throw new Error(`Version not found: ${options.version}`);
    return found;
  }

  if (options.ptu) {
    const found = versions.find((entry) => isPtuVersion(entry.version));
    if (!found) throw new Error('No PTU SCMDB version available');
    return found;
  }

  const liveVersion = versions.find((entry) => isLiveVersion(entry.version)) ?? versions[0];
  if (!liveVersion) throw new Error('No SCMDB versions available');
  return liveVersion;
}
