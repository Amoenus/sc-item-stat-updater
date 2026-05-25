import { SeverityNumber } from '@opentelemetry/api-logs';
import { ExportResultCode } from '@opentelemetry/core';
import type { ReadableLogRecord } from '@opentelemetry/sdk-logs';
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';

export type LogAttributes = Record<string, string | number | boolean | undefined | null>;

let minSeverity: SeverityNumber = SeverityNumber.INFO;
let useJson = false;

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: '\x1b[90m', // gray
  INFO: '\x1b[36m', // cyan
  WARN: '\x1b[33m', // yellow
  ERROR: '\x1b[31m', // red
};
const RESET = '\x1b[0m';

function formatRecord(record: ReadableLogRecord): string {
  const color = LEVEL_COLORS[record.severityText ?? ''] ?? '';
  const time = new Date().toLocaleTimeString();
  const attrs = record.attributes;
  let detail = '';
  if (attrs) {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(attrs)) {
      if (v != null && v !== '') parts.push(`${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
    }
    if (parts.length) detail = ` (${parts.join(', ')})`;
  }
  return `${color}${time} [${record.severityText}]${RESET} ${typeof record.body === 'object' ? JSON.stringify(record.body) : String(record.body)}${detail}\n`;
}

class ConsoleStderrExporter {
  export(records: ReadableLogRecord[], resultCallback: (result: { code: number }) => void): void {
    for (const record of records) {
      if (useJson) {
        const entry = {
          timestamp: new Date().toISOString(),
          severity: record.severityText,
          body: record.body,
          attributes: record.attributes,
          logger: record.instrumentationScope?.name,
        };
        process.stderr.write(`${JSON.stringify(entry)}\n`);
      } else {
        process.stderr.write(formatRecord(record));
      }
    }
    resultCallback({ code: ExportResultCode.SUCCESS });
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

const provider = new LoggerProvider({
  processors: [new SimpleLogRecordProcessor(new ConsoleStderrExporter())],
});

export function setLogLevel(level: string): void {
  const levels: Record<string, SeverityNumber> = {
    debug: SeverityNumber.DEBUG,
    info: SeverityNumber.INFO,
    warn: SeverityNumber.WARN,
    error: SeverityNumber.ERROR,
  };
  minSeverity = levels[level] ?? SeverityNumber.INFO;
}

export function setJsonOutput(enabled: boolean): void {
  useJson = enabled;
}

export function getLogger(name: string) {
  const otelLogger = provider.getLogger(name);

  function emit(severityNumber: SeverityNumber, severityText: string, message: string, attributes?: LogAttributes) {
    if (severityNumber >= minSeverity) {
      otelLogger.emit({ severityNumber, severityText, body: message, attributes });
    }
  }

  return {
    debug: (msg: string, attrs?: LogAttributes) => emit(SeverityNumber.DEBUG, 'DEBUG', msg, attrs),
    info: (msg: string, attrs?: LogAttributes) => emit(SeverityNumber.INFO, 'INFO', msg, attrs),
    warn: (msg: string, attrs?: LogAttributes) => emit(SeverityNumber.WARN, 'WARN', msg, attrs),
    error: (msg: string, attrs?: LogAttributes) => emit(SeverityNumber.ERROR, 'ERROR', msg, attrs),
  };
}

export async function shutdownLogger() {
  await provider.shutdown();
}
