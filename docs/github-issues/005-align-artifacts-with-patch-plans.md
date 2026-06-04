# Align Artifacts With Patch Plans

## Type

Task

## Labels

`architecture`, `artifacts`, `schema`

## Depends On

- 001: Define Core Pipeline Types
- 003: Split Updater Into Planning And Application

## Problem

Artifacts currently represent patch data, but they are not clearly modeled as serialized patch plans. This creates a conceptual gap between in-memory planning and artifact generation/loading.

## Goal

Make artifacts the serialized form of a patch plan plus metadata.

## Proposed Location

Eventually:

```text
src/artifacts/
  artifact.ts
  artifact.schema.ts
```

Current `src/artifact` can remain until the final folder cleanup.

## Implementation Notes

- Keep schema validation with Zod.
- Decide whether artifact entries should remain a map or become an array of `PatchEntry`.
- If retaining a map for compactness/backward compatibility, document how it maps to `PatchPlan`.
- Ensure issue shapes align with `UpdateIssue`.
- Keep `bin/apply-artifact.ts` working.

## Acceptance Criteria

- Artifact docs/schema explain the relationship to `PatchPlan`.
- Artifact read/write functions can convert to and from in-memory patch plans.
- Existing artifact consumers still work.
- Artifact schema tests or typecheck coverage verify the expected shape.

## Test Plan

- Run `npm run typecheck`.
- Run `npm test`.
- Generate an artifact from a dry run if local source data is available.
- Apply a generated artifact to a fixture or test INI file.
