# PRD 002: Category Source Contract Registry

## Problem

Category source metadata is inferred in several places: item configs, preflight, diagnostics, provider matrix, category
listing, and documentation. Those paths can drift from each other.

## Goals

- Define one typed source contract per category.
- Generate inventory, preflight checks, provider matrix, and diagnostics from the same declarations.
- Make optional fallback sources explicit.
- Make DataCore, SCMDB, and legacy SPViewer source roles visible in one model.

## Non-Goals

- Changing category rendering text.
- Removing all custom loaders.
- Replacing every mission enrichment implementation.

## Requirements

1. Each category declares required, optional, fallback, diagnostic, and legacy source files explicitly.
2. `--list-categories`, `--provider-matrix`, preflight, and source freshness diagnostics use the same contract model.
3. Tests prevent undocumented source files from appearing in active category configs.
4. Docs can be generated or checked from the registry.

## Acceptance Criteria

- Adding a source file to a category requires one declaration, not parallel edits.
- Provider matrix and preflight agree on provider/fallback status.
- SCMDB bridge and fallback categories are labeled distinctly.
- Architecture guardrails fail when a category has an ambiguous or undeclared source contract.

## Open Questions

- Should raw fact datasets be represented as pseudo-categories in the same registry?
- Should extra update steps use the category registry or a separate step-source registry?
- How much custom loader metadata belongs in the contract versus the loader implementation?

