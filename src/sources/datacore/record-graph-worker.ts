import fs from 'node:fs/promises';
import type { CheerioAPI } from 'cheerio';
import { extractRecordNode, normalizedRecordPath } from './record-graph';
import type { DataCoreRecordNode } from './types';
import { loadXml } from './xml-parser';

export interface ParseRecordNodeOptions {
  xmlPath: string;
  xmlCacheDir: string;
}

export default async function parseRecordNode({
  xmlPath,
  xmlCacheDir,
}: ParseRecordNodeOptions): Promise<DataCoreRecordNode | null> {
  const xml = await fs.readFile(xmlPath, 'utf8');
  let $: CheerioAPI;
  try {
    $ = loadXml(xml);
  } catch {
    return null;
  }

  const root = $(':root').first();
  const rootElement = root[0];
  if (rootElement?.type !== 'tag') return null;

  return extractRecordNode($, rootElement, normalizedRecordPath(root, xmlPath, xmlCacheDir));
}
