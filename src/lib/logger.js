import { SeverityNumber } from '@opentelemetry/api-logs';
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';

let minSeverity = SeverityNumber.INFO;
let useJson = false;

const LEVEL_COLORS = {
  DEBUG: '\x1b[90m',  // gray
  INFO:  '\x1b[36m',  // cyan
  WARN:  '\x1b[33m',  // yellow
  ERROR: '\x1b[31m',  // red
};
const RESET = '\x1b[0m';

class ConsoleStderrExporter {
  export(records, resultCallback) {
    for (const record of records) {
      if (useJson) {
        const entry = {
          timestamp: new Date().toISOString(),
          severity: record.severityText,
          body: record.body,
          attributes: record.attributes,
          logger: record.instrumentationScope?.name,
        };
        process.stderr.write(JSON.stringify(entry) + '\n');
      } else {
        const color = LEVEL_COLORS[record.severityText] || '';
        const time = new Date().toLocaleTimeString();
        const attrs = record.attributes;
        let detail = '';
        if (attrs) {
          const parts = [];
          for (const [k, v] of Object.entries(attrs)) {
            if (v !== undefined && v !== null && v !== '') parts.push(`${k}=${v}`);
          }
          if (parts.length) detail = ` (${parts.join(', ')})`;
        }
        process.stderr.write(`${color}${time} [${record.severityText}]${RESET} ${record.body}${detail}\n`);
      }
    }
    resultCallback({ code: 0 });
  }
  shutdown() { return Promise.resolve(); }
}

const provider = new LoggerProvider();
provider.addLogRecordProcessor(
  new SimpleLogRecordProcessor(new ConsoleStderrExporter())
);

export function setLogLevel(level) {
  const levels = {
    debug: SeverityNumber.DEBUG,
    info: SeverityNumber.INFO,
    warn: SeverityNumber.WARN,
    error: SeverityNumber.ERROR,
  };
  minSeverity = levels[level] ?? SeverityNumber.INFO;
}

export function setJsonOutput(enabled) {
  useJson = enabled;
}

export function getLogger(name) {
  const otelLogger = provider.getLogger(name);

  function emit(severityNumber, severityText, message, attributes) {
    if (severityNumber >= minSeverity) {
      otelLogger.emit({ severityNumber, severityText, body: message, attributes });
    }
  }

  return {
    debug: (msg, attrs) => emit(SeverityNumber.DEBUG, 'DEBUG', msg, attrs),
    info:  (msg, attrs) => emit(SeverityNumber.INFO, 'INFO', msg, attrs),
    warn:  (msg, attrs) => emit(SeverityNumber.WARN, 'WARN', msg, attrs),
    error: (msg, attrs) => emit(SeverityNumber.ERROR, 'ERROR', msg, attrs),
  };
}

export async function shutdownLogger() {
  await provider.shutdown();
}
