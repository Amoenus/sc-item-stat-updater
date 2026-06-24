# Unify Category Source Contracts

GitHub: #129

## Problem

Category source metadata is inferred in parallel by configs, inventory, provider matrix, preflight, diagnostics, docs,
and some extra update steps. These views can drift.

## Acceptance Criteria

- Required, optional, fallback, diagnostic, and legacy source files are declared in one model.
- `--list-categories`, `--provider-matrix`, preflight, and source freshness diagnostics agree on source status.
- Active categories cannot have ambiguous source ownership.
- Custom loaders still work while exposing their source files through the contract.

## Related Docs

- `docs/prds/002-category-source-contract-registry.md`
- `architecture_as_is/20260624_160217/architecture_as_is.html`

