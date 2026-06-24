# ADR 006: Generated Data Ownership And Cache Boundaries

## Status

Proposed

## Context

The as-built architecture audit found that `csv/` contains several different lifecycle classes:

1. Heavy rebuildable local caches such as DataCore DCB and XML extraction caches.
2. Raw upstream snapshots such as SCMDB JSON payloads.
3. Derived source outputs such as DataCore and SCMDB CSVs.
4. Record graph indexes and graph metadata.
5. Obsolete historical version outputs.

Those classes currently sit beside each other without a strong ownership contract. That makes review, cleanup,
generated-data churn detection, and accidental commits harder than they need to be.

## Decision

Adopt an explicit generated-data ownership model:

- Rebuildable local caches are machine-local acceleration state and should not be committed by default.
- Raw source snapshots are committed only when they are part of an intentional source-version refresh.
- Derived source outputs are committed only when reviewers can understand their source version and generator.
- Diagnostic outputs are committed only when tied to an active migration or audit.
- Obsolete historical outputs should be pruned or archived outside the active repo unless they are intentionally pinned.

`docs/generated-data-ownership.md` is the current ownership table and should become the source of truth until the
policy is enforced by code.

## Consequences

### Positive

- Generated-data reviews become about intentional lifecycle transitions rather than large unclassified diffs.
- Cache cleanup and `.gitignore` rules can be reasoned about from one policy.
- `check:no-generated-churn` can distinguish accidental writes from intentional source refreshes.

### Negative

- Some existing `csv/` paths may need migration, pruning, or explicit retention exceptions.
- Historical generated outputs may need to move out of normal source refresh paths.
- Tooling must learn the ownership classes before enforcement can be strict.

## Follow-Up Work

1. Teach churn checks and architecture checks about generated-data ownership classes.
2. Decide which existing `csv/` paths should stay tracked, move to cache-only, or be pruned.
3. Add source-version/generator metadata beside large derived artifacts.
4. Document the intentional generated-data refresh workflow.

