## 2025-05-14 - Scraper Decoupling
Learning: The `bin/scrape-scmdb.js` file functioned as a massive procedural God-class handling both raw SCMDB JSON downloading, directory setup, CSV file I/O, and complex domain mapping for missions/blueprints.
Action: Extracted all domain mapping, traversal (blueprint chain depths), and array generation (mission rows) into a distinct, typed module `src/lib/scmdb/mission-parser.js`. I/O layers must remain purely concerned with CLI args and writing to disk, relying on pure parser functions containing standard `@typedef`s to replace undocumented generic object graphs.

## 2025-05-16 - Extracted Zod Inferred Types
Learning: Manual interface definitions in parser modules (`src/extractor/mission-parser.ts`, `src/extractor/mining-parser.ts`) were prone to drift, loose types, and explicit `any` usage. Zod schemas already existed in `src/schema/scmdb.schemas.ts` for boundary validation but weren't being utilized for internal typing.
Action: Use `z.infer` to extract and export strict DTO types directly from Zod schemas and share them across the extraction pipeline. This establishes a single source of truth and eliminates `any` type loopholes.
