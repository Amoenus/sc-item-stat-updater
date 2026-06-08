import path from 'node:path';
import fs from 'node:fs/promises';
import { ensureToolsInstalled, resolveLiveDir } from '../src/io/local/unp4k-tool';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';

const execFileAsync = promisify(execFile);

async function main() {
  const liveDir = resolveLiveDir(process.cwd());
  const tools = await ensureToolsInstalled(path.join(liveDir, 'unp4k'), console.log);
  const p4kPath = path.join(liveDir, 'Data.p4k');

  const outDir = path.join(process.cwd(), 'scratch', 'subsumption-test');
  await fs.mkdir(outDir, { recursive: true });

  console.log('Extracting Subsumption XMLs...');
  await execFileAsync(tools.unp4k, [p4kPath, '*Libs/Subsumption/Missions/PU/Missions/KillShip/KillShip.xml'], { cwd: outDir });

  console.log('Unforging XMLs...');
  const xmlPath = path.join(outDir, 'Data', 'Libs', 'Subsumption', 'Missions', 'PU', 'Missions', 'KillShip', 'KillShip.xml');
  await execFileAsync(tools.unforge, [xmlPath], { cwd: outDir });

  console.log('Done!');
}

main().catch(console.error);
