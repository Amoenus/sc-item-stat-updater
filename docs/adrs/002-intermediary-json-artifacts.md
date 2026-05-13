# ADR 002: Intermediary JSON Artifacts

## Status
Accepted

## Context
Currently, the extraction and transformation process is tightly coupled with writing the output directly to the local `.ini` file. As we plan to move from Phase 1 (a purely local CLI tool) to Phase 2 (a CI/CD pipeline powering a static web frontend), this tight coupling becomes a blocker. The CI/CD environment cannot access the end user's local `global.ini` file.

## Decision
The transformation phase must be strictly decoupled from file system modifications. Instead of mutating a file directly, the pipeline will generate an intermediary JSON artifact (`patch-data.json`).
* The extraction and transformation logic will output this JSON structure.
* This artifact acts as an explicit "manifest" containing exact Key/Value pairs intended for injection into an INI file.
* A separate "Loader" component will be responsible for taking this JSON artifact and applying it to the user's `global.ini`.

## Consequences
### Positive
* **Reusability:** The exact same extraction/transformation code can run locally via CLI (Phase 1) or inside a GitHub Action (Phase 2) without modification.
* **Separation of Concerns:** Clearly delineates data processing from file I/O operations.
* **Inspectability:** Developers and users can inspect the `patch-data.json` artifact to see precisely what changes are proposed before they are applied.

### Negative
* **Two-Step Process:** Requires an additional compilation/merging step to apply the generated JSON to the final text file.
