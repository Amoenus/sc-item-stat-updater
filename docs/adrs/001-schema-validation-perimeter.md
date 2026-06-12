# ADR 001: Schema Validation Perimeter

## Status
Accepted

## Context
The application relies on data fetched from upstream sources such as SCMDB, plus structured data extracted from local game files. Third-party web data can change without any prior notice. If the data structure changes unexpectedly, the transformation logic might produce corrupted or incorrect `.ini` update strings. This would result in writing a malformed `global.ini` file for the user, potentially breaking their game configuration.

## Decision
We will use **Zod** to strictly validate all incoming data from external sources at runtime before any processing occurs.
* All API responses must be parsed through predefined Zod schemas.
* If validation fails, the process must halt immediately, throwing a descriptive error.
* Data should not be passed to the extraction or transformation pipelines without first passing schema validation.

## Consequences
### Positive
* **Fail Fast:** The system immediately aborts upon encountering unexpected data formats, preventing corrupted output.
* **Type Safety:** Zod integrates seamlessly with TypeScript (if adopted later) and provides structured, predictable data objects for the transformation pipelines.
* **Clear Errors:** Zod provides detailed error messages explaining exactly which fields failed validation, making it easier to debug when upstream APIs change.

### Negative
* **Maintenance Overhead:** Developers must keep the Zod schemas updated whenever the upstream APIs change intentionally.
* **Slight Performance Impact:** Runtime validation adds a small overhead to the data extraction phase, though this is negligible compared to network latency.
