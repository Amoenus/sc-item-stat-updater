# As-Built Architecture Manifest

Run folder: `architecture_as_is/20260624_160217`

## Generated Files

| File | Why it exists | Produced by | Intended disposition |
| --- | --- | --- | --- |
| `architecture_as_is/20260624_160217/architecture_as_is.html` | Primary self-contained architecture audit report focused on workflow structure, cache ownership, generated artifacts, and data remapping. | Manual synthesis from repository inspection and safe commands. | Review; commit if this audit should be retained. |
| `architecture_as_is/20260624_160217/manifest.md` | Required run manifest for the as-built architecture skill. | Manual synthesis. | Review; commit with report if desired. |
| `architecture_as_is/20260624_160217/evidence/command-log.md` | Summarized evidence command log. | Manual synthesis from commands executed in this run. | Review; commit with report if desired. |
| `architecture_as_is/20260624_160217/diagrams/as-built-workflow.mmd` | Diagram source for the as-built workflow. It is not rendered in the HTML because renderer setup was not needed for this audit. | Manual Mermaid source. | Review; commit with report if desired. |

## Notes

- The report uses an inline ASCII workflow diagram rather than a rendered SVG. No Mermaid runtime, CDN, or external asset is required to read the HTML.
- The repository already had untracked `architecture_as_is/` content before this run; this run uses a new timestamped folder and does not overwrite prior reports.
- Existing dirty/generated files outside this run folder were not modified intentionally by this architecture audit.
