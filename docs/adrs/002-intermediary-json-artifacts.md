# ADR 002: Intermediary JSON Artifacts

## Status
Accepted

## Context
Currently, parts of the extraction and enrichment process are tightly coupled with writing the output directly to the local `.ini` file. This makes the pipeline harder to test and harder to reuse. It also makes intended changes harder to review before mutating `global.ini`.

## Decision
Patch planning must be decoupled from file mutation. Instead of requiring every enrichment path to mutate a file directly, the pipeline can generate an intermediary JSON artifact (`patch-data.json`).
* The planning logic outputs this JSON structure.
* This artifact acts as an explicit manifest containing exact key/value pairs intended for injection into an INI file.
* A separate application step is responsible for applying the artifact or in-memory patch plan to `global.ini`.

## Consequences
### Positive
* **Reusability:** The same patch planning logic can run locally, in CI, or in a future static client flow without changing the mutation logic.
* **Separation of Concerns:** Clearly delineates data processing from file I/O operations.
* **Inspectability:** Developers and users can inspect the `patch-data.json` artifact to see precisely what changes are proposed before they are applied.

### Negative
* **Two-Step Process:** Requires an additional compilation/merging step to apply the generated JSON to the final text file.
