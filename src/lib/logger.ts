/**
 * Compatibility re-export for older imports.
 * Logging infrastructure now lives in `src/infrastructure/logger`.
 */
export {
  getLogger,
  setJsonOutput,
  setLogLevel,
  shutdownLogger,
} from '../infrastructure/logger';
export type { LogAttributes } from '../infrastructure/logger';
