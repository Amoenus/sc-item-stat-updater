# PRD 001: Source Cache And Generated Data Architecture

## Problem

The repository cannot reliably distinguish intentional source refreshes from accidental generated-data churn because
caches, raw snapshots, derived outputs, graph indexes, and historical outputs share the same `csv/` surface.

## Goals

- Make every generated path's ownership class visible.
- Prevent stale or incompatible DataCore graph/cache reuse.
- Make generated-data churn checks actionable from a dirty or intentionally staged baseline.
- Reduce accidental commits of large rebuildable local caches.

## Non-Goals

- Rewriting all source extractors.
- Removing SCMDB in the same change.
- Replacing the current `csv/` layout in one migration.

## Requirements

1. Every generated-data path pattern has an ownership class.
2. DataCore record graph reuse validates DCB fingerprint, XML cache fingerprint/count, graph schema version, generator
   version, and fidelity mode.
3. Churn checks can report generated-data changes by ownership class.
4. Documentation explains the intentional source refresh workflow.
5. Tests cover graph cache hit and miss behavior.

## Acceptance Criteria

- `docs/generated-data-ownership.md` is complete for active `csv/` path patterns.
- `npm run typecheck` passes.
- Graph metadata tests prove valid cache reuse and stale metadata rebuild.
- A clean baseline can run `npm run check:no-generated-churn` after no-write commands.

## Open Questions

- Should rebuildable caches move outside `csv/` entirely?
- Which historical version folders are worth retaining in the repo?
- Should graph indexes be split by consumer projection?

