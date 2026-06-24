# Enforce Generated-Data Ownership Classes

GitHub: #128

## Problem

Generated data under `csv/` has several lifecycles but one physical surface. Reviewable outputs, raw snapshots,
rebuildable caches, diagnostics, and obsolete historical outputs need different commit and cleanup policies.

## Acceptance Criteria

- Churn reports classify changed paths by ownership class.
- Rebuildable local caches are ignored, blocked, or explicitly exempted.
- Intentional generated refresh workflow is documented.
- Historical DataCore and SCMDB outputs have a retention decision.
- `npm run check:no-generated-churn` can produce a clean signal from a clean or intentionally staged baseline.

## Related Docs

- `docs/generated-data-ownership.md`
- `docs/adrs/006-generated-data-ownership-and-cache-boundaries.md`
- `docs/prds/001-source-cache-and-generated-data-architecture.md`

