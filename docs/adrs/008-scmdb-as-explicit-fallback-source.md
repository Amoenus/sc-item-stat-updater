# ADR 008: SCMDB As Explicit Fallback Source

## Status

Proposed

## Context

The project now describes DataCore as the authoritative first-party source. SCMDB remains useful for relationship,
mining, crafting, and mission joins that have not yet been reconstructed from game files.

The as-built audit found that SCMDB is no longer an active primary provider in the category matrix, but full source
refresh still defaults to refreshing both SCMDB and DataCore. Mining journal fallback and same-version SCMDB component
class lookup still exist. This creates ambiguity: SCMDB is both "retired/temporary" and still part of the default path.

## Decision

SCMDB should be modeled as an explicit fallback or bridge source, not an implicit default source.

Normal DataCore-first pipeline and cache refreshes should eventually run without SCMDB unless the user asks for bridge
or fallback regeneration. SCMDB-dependent behavior must be visible through diagnostics and source contracts.

## Consequences

### Positive

- Default pipeline semantics align with DataCore-first ownership.
- Remaining SCMDB dependencies become explicit migration work rather than background behavior.
- SCMDB network/source churn stops affecting normal DataCore refresh confidence.

### Negative

- Existing workflows that assume `cache` means DataCore plus SCMDB need migration messaging.
- Optional fallback behavior needs clear CLI flags and tests.
- Some generated source outputs may become historical or diagnostic-only.

## Follow-Up Work

1. Add an explicit SCMDB fallback/bridge refresh mode.
2. Change default `pipeline` and `cache` source selection only after release-note-level documentation.
3. Keep `--scmdb-audit` as the migration checklist.
4. Remove or isolate SCMDB class lookups from DataCore item scraping once DataCore can supply equivalent class data.

