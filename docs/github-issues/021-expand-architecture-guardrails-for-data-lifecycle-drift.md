# Expand Architecture Guardrails For Data Lifecycle Drift

GitHub: #134

## Problem

The current architecture guard is intentionally narrow. The audit found recurring drift risks around generated-data
lifecycle, category source contracts, cache metadata, and default source behavior.

## Acceptance Criteria

- Guardrails verify generated-data ownership table coverage for active path patterns.
- Guardrails verify category source contracts once the registry exists.
- Guardrails detect accidental SCMDB reintroduction into DataCore-only defaults after that migration lands.
- `npm run check:architecture` remains cheap enough for regular use.

