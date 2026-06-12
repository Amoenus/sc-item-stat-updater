import { AsyncLocalStorage } from 'node:async_hooks';

export type LogAttributes = Record<string, string | number | boolean | undefined | null>;

type LogLevelName = 'debug' | 'info' | 'warn' | 'error';
type SeverityText = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogLevel {
  name: LogLevelName;
  severity: number;
  text: SeverityText;
}

const LOG_LEVELS: Record<LogLevelName, LogLevel> = {
  debug: { name: 'debug', severity: 5, text: 'DEBUG' },
  info: { name: 'info', severity: 9, text: 'INFO' },
  warn: { name: 'warn', severity: 13, text: 'WARN' },
  error: { name: 'error', severity: 17, text: 'ERROR' },
};

const LEVEL_COLORS: Record<SeverityText, string> = {
  DEBUG: '\x1b[90m',
  INFO: '\x1b[36m',
  WARN: '\x1b[33m',
  ERROR: '\x1b[31m',
};
const RESET = '\x1b[0m';

let minSeverity = LOG_LEVELS.info.severity;
let useJson = false;
const loggerOutputSink = new AsyncLocalStorage<(line: string) => void>();

function formatAttributes(attributes?: LogAttributes): string {
  if (!attributes) return '';

  const parts = Object.entries(attributes)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`);

  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

function formatTextRecord(level: LogLevel, message: string, attributes?: LogAttributes): string {
  const color = LEVEL_COLORS[level.text];
  const time = new Date().toLocaleTimeString();
  return `${color}${time} [${level.text}]${RESET} ${message}${formatAttributes(attributes)}\n`;
}

function formatJsonRecord(logger: string, level: LogLevel, message: string, attributes?: LogAttributes): string {
  return `${JSON.stringify({
    timestamp: new Date().toISOString(),
    severity: level.text,
    body: message,
    attributes,
    logger,
  })}\n`;
}

export function setLogLevel(level: string): void {
  minSeverity = LOG_LEVELS[level as LogLevelName]?.severity ?? LOG_LEVELS.info.severity;
}

export function setJsonOutput(enabled: boolean): void {
  useJson = enabled;
}

export function getLogger(name: string) {
  function emit(level: LogLevel, message: string, attributes?: LogAttributes): void {
    if (level.severity < minSeverity) return;

    const formatted = useJson ? formatJsonRecord(name, level, message, attributes) : formatTextRecord(level, message, attributes);
    const sink = loggerOutputSink.getStore();
    if (sink) {
      sink(formatTaskOutput(level, message, attributes));
      return;
    }

    process.stderr.write(formatted);
  }

  return {
    debug: (message: string, attributes?: LogAttributes) => emit(LOG_LEVELS.debug, message, attributes),
    info: (message: string, attributes?: LogAttributes) => emit(LOG_LEVELS.info, message, attributes),
    warn: (message: string, attributes?: LogAttributes) => emit(LOG_LEVELS.warn, message, attributes),
    error: (message: string, attributes?: LogAttributes) => emit(LOG_LEVELS.error, message, attributes),
  };
}

export function withLoggerOutputSink<T>(sink: (line: string) => void, run: () => T): T {
  return loggerOutputSink.run(sink, run);
}

export function shutdownLogger(): Promise<void> {
  return Promise.resolve();
}

function formatTaskOutput(level: LogLevel, message: string, attributes?: LogAttributes): string {
  return `${level.text} ${message}${formatAttributes(attributes)}`;
}
