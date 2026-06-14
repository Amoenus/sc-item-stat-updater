import { inspect } from 'node:util';
import type { LogAttributes } from '../infrastructure/logger';
import { setJsonOutput, setLogLevel, shutdownLogger } from '../infrastructure/logger';

export interface IssueEntry {
  type?: string;
  key: string;
  reason: string;
}

export interface CommandIO {
  cwd: string;
  stdout: Pick<NodeJS.WriteStream, 'write' | 'isTTY'>;
  stderr: Pick<NodeJS.WriteStream, 'write' | 'isTTY'>;
}

export type CommandRunner = (argv: string[], io?: CommandIO) => Promise<number>;

type CliLogger = { error: (msg: string, attrs?: LogAttributes) => void };

export function defaultCommandIO(): CommandIO {
  return {
    cwd: process.cwd(),
    stdout: process.stdout,
    stderr: process.stderr,
  };
}

export function writeLine(io: CommandIO, message = ''): void {
  io.stdout.write(`${message}\n`);
}

export function writeErrorLine(io: CommandIO, message = ''): void {
  io.stderr.write(`${message}\n`);
}

export async function runCliCommand(runner: CommandRunner, argv: string[]): Promise<number> {
  try {
    return await runner(argv, defaultCommandIO());
  } finally {
    await shutdownLogger();
  }
}

export function registerUnhandledRejectionHandler(logger: CliLogger): void {
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { error: inspect(reason, { depth: 3 }) });
    process.exitCode = 1;
  });
}

export function applyLogFlags(values: { verbose?: boolean; 'json-logs'?: boolean }): void {
  if (values.verbose) setLogLevel('debug');
  if (values['json-logs']) setJsonOutput(true);
}

export function isNpmConfigFlagEnabled(name: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const normalizedName = name.replaceAll('-', '_');
  return env[`npm_config_${normalizedName}`]?.toLowerCase() === 'true';
}

function printIssues(issues: IssueEntry[], heading = '\nIssues:'): void {
  printIssuesTo(defaultCommandIO(), issues, heading);
}

export function printIssuesTo(io: CommandIO, issues: IssueEntry[], heading = '\nIssues:'): void {
  if (issues.length === 0) return;
  writeLine(io, heading);
  for (const issue of issues) {
    const tag = issue.type ? `${issue.type.toUpperCase()} | ` : '';
    writeLine(io, `  ${tag}${issue.key} - ${issue.reason}`);
  }
}
