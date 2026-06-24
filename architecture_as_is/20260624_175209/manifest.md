# Architecture/reporting manifest

- Repository: `C:\Git\sc-item-stat-updater`
- Branch: `master`
- Snapshot: `20260624_175209`
- Report: `architecture_as_is.html`
- Focus: file organization, logical separation, code duplication, single responsibility, file generation churn, and mapping mismatch/drift.
- Method: read-only static inspection plus existing guardrail commands.

## Artifacts

- `architecture_as_is.html` - self-contained architecture/reporting snapshot.
- `evidence/command-log.md` - commands and notable observations used by the report.

## Scope Notes

- This report was produced after the implementation issue sweep for `#127` through `#134`.
- It does not mutate generated `csv/` data or attempt a new generated-data refresh.
- Findings distinguish observed repository facts from inferred risk where the evidence is indirect.
