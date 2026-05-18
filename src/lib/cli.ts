import { inspect } from 'node:util';
import type { LogAttributes } from './logger.js';
import { setJsonOutput, setLogLevel } from './logger.js';

export interface IssueEntry {
  type?: string;
  key: string;
  reason: string;
}

type CliLogger = { error: (msg: string, attrs?: LogAttributes) => void };

export function registerUnhandledRejectionHandler(logger: CliLogger): void {
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { error: inspect(reason, { depth: 3 }) });
    process.exit(1);
  });
}

export function applyLogFlags(values: { verbose?: boolean; 'json-logs'?: boolean }): void {
  if (values.verbose) setLogLevel('debug');
  if (values['json-logs']) setJsonOutput(true);
}

export function printIssues(issues: IssueEntry[], heading = '\n⚠ Issues:'): void {
  if (issues.length === 0) return;
  console.log(heading);
  for (const issue of issues) {
    const tag = issue.type ? `${issue.type.toUpperCase()} | ` : '';
    console.log(`  ${tag}${issue.key} — ${issue.reason}`);
  }
}
