/**
 * Compatibility re-export for older imports.
 * CLI presentation helpers now live in `src/presentation/cli`.
 */
export {
  applyLogFlags,
  printIssues,
  registerUnhandledRejectionHandler,
} from '../presentation/cli';
export type { IssueEntry } from '../presentation/cli';
