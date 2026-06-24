# PRD 003: SCMDB Fallback Retirement

## Problem

SCMDB is described as a temporary bridge while DataCore becomes authoritative, but SCMDB refresh still participates in
default source refresh behavior. This creates ambiguous ownership and makes migration status harder to reason about.

## Goals

- Make SCMDB fallback behavior opt-in.
- Keep remaining SCMDB dependencies visible and testable.
- Remove SCMDB from default DataCore-first pipeline/cache flows when safe.
- Preserve explicit commands for bridge regeneration while fallback behavior remains.

## Non-Goals

- Removing all SCMDB code immediately.
- Removing historical SCMDB data before retention policy is decided.
- Changing DataCore source authority.

## Requirements

1. `--scmdb-audit` remains the checklist for remaining bridge dependencies.
2. Default `pipeline` and `cache` flows are changed only after docs and tests explain the migration.
3. SCMDB fallback generation has an explicit CLI flag or source target.
4. Mining journal and component-class fallback behavior are either migrated to DataCore or clearly marked optional.

## Acceptance Criteria

- `cache` and `pipeline` defaults match documented DataCore-first behavior.
- `cache:scmdb` and any new fallback/bridge command still work for explicit SCMDB refreshes.
- Provider matrix distinguishes active primary, optional fallback, diagnostic, historical, and retired sources.
- Tests cover default source selection and explicit SCMDB fallback selection.

## Open Questions

- Should `cache` become DataCore-only or should it keep `all` semantics behind an explicit `--all-sources` flag?
- How long should SCMDB raw snapshots remain tracked?
- Should SCMDB-derived diagnostics move under a separate output root?

