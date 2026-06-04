# Add Architecture Guardrails

## Type

Task

## Labels

`architecture`, `quality`, `tests`

## Depends On

- 012: Clean Up `lib`, `items`, And Folder Layout

## Problem

After the rewrite, future changes could easily drift back toward mixed responsibilities unless the repo has lightweight guardrails.

## Goal

Add tests, scripts, or documentation checks that make the intended boundaries easy to maintain.

## Possible Guardrails

- A dependency-boundary test that prevents source acquisition modules from importing localization patch application.
- A test that verifies CLI scripts do not import low-level parser internals directly.
- A lightweight architecture README in each major folder.
- A docs checklist for adding new data sources or enrichment planners.
- A `check:architecture` script if the rules become concrete enough.

## Implementation Notes

- Start with simple tests or scripts. Avoid overbuilding.
- Prefer rules that catch real mistakes over abstract purity.
- Make failures actionable with clear messages.

## Acceptance Criteria

- At least one automated guardrail protects a high-value boundary.
- Docs explain how to add a new source provider.
- Docs explain how to add a new enrichment planner.
- `npm run check:ci` or another documented command runs the guardrail.

## Test Plan

- Run `npm run typecheck`.
- Run `npm test`.
- Run the new guardrail command.

## Progress

Architecture guardrail slice on 2026-06-04:

- Added `scripts/check-architecture.ts`.
- Added `npm run check:architecture`.
- The guardrail parses TypeScript imports and prevents `src/sources` modules from importing localization application/updater mutation code.
- Updated `docs/architecture-overview.md` with checklists for adding source providers and enrichment planners.

Verification:

- `npm run check:architecture`
- `npm run typecheck`
- `npm test`
- `npx biome lint scripts/check-architecture.ts package.json docs/architecture-overview.md docs/github-issues/013-add-architecture-guardrails.md docs/implementation-plan.md`

Closure review:

- Automated guardrail protects a high-value boundary by preventing source modules from importing localization application/updater mutation code.
- `docs/architecture-overview.md` explains how to add a new source provider.
- `docs/architecture-overview.md` explains how to add a new enrichment planner.
- `npm run check:architecture` is the documented guardrail command.
