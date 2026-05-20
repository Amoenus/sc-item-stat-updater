Here's the compliance report. I'll go principle by principle, focusing on structure first.

---

## Tao of Node Compliance Report

### ✅ Compliant

**Structure by domain modules** — The project avoids MVC. items, extractor, artifact, local, and lib are domain- and responsibility-oriented. The bin → src layering maps cleanly to CLI (transport) → engine (business logic) → I/O (data access).

**Favor functions over classes** — All item configs are plain exported objects. No controller classes. registry.ts uses factory functions. Clean.

**Avoid callback-based APIs** — Entirely on `node:fs/promises`, `parseArgs`, and async/await throughout. No callback APIs in sight.

**Use a structured logger** — OpenTelemetry-backed logger in logger.ts with JSON mode and severity levels. Better than the article's recommended `winston`/`pino`.

**TypeScript** — Strict mode, `noImplicitReturns`, `noUnusedLocals`, `NodeNext` module resolution. Fully typed.

**Enforce consistency** — Biome replaces ESLint + Prettier with a single tool. Kebab-case file names, camelCase functions, PascalCase interfaces. Consistent throughout.

**Favor native methods** — `node:fs/promises`, `node:path`, `node:url`, `node:assert`, `node:test`, `parseArgs` from `node:util`. No unnecessary utility libraries (no lodash, etc.).

**Listen to process signals** — `registerUnhandledRejectionHandler` in cli.ts handles `unhandledRejection` and exits cleanly.

**Encapsulate configuration** — `resolveOptions()` in updater.ts centralizes config resolution. CLI flags parsed via `parseArgs` at the entry point, passed down as parameters.

**Pinned Node version** — Volta pins `node: 24.15.0` in package.json. Good.

---

### ⚠️ Issues (structural, then everything else)

#### 1. lib is a catch-all — the thing the article explicitly warns against

lib currently holds:
- The core engine: updater.ts
- Shared infrastructure: cli.ts, logger.ts, types.ts, `key-resolver.ts`
- A CSV write utility: csv.ts
- Two sub-folders: `format/` (formatting utilities) and `updates/` (8 domain-specific update operations)

The article calls this out directly: *"The utilities folder should be a toolbox that you can ideally lift and put in another project with minimal effort. If the logic in them is business-specific it means they should be a part of the domain layer."*

updates contains modules like component-titles.ts, `fps-title-tags.ts`, `missile-title-tags.ts` — these are pure domain business logic, not reusable utilities. They belong closer to the domain (e.g., `src/updates/` as a sibling to items), not buried inside `lib/`.

#### 2. local — premature nesting

`io/` contains only `local/`. There is no `io/remote/` or anything else. A wrapper folder containing one child folder adds navigation friction with no current benefit. Apply the co-location principle: flatten to io unless a second I/O provider actually exists.

#### 3. CSV read vs. write split across distant folders

- CSV reading: csv-parser.ts
- CSV writing: csv.ts

These are functionally related (both deal with CSV), different only in direction, but placed far apart with inconsistent naming conventions. The csv.ts write utility is only used by scraper bins. It should either live in local alongside the reader, or co-located with bin since that's its only consumer.

#### 4. schema not co-located with consumers

Per the co-location rule: put things where they're used.

- `scmdb.schemas.ts` → only imported by mining-parser.ts and mission-parser.ts
- `spviewer.schemas.ts` → only imported by scrape-spviewer.ts

Both schema files should live inside extractor (or alongside the scraper bin). A standalone schema folder for two files used in one place each violates co-location.

#### 5. shared — a folder for one file

shared contains only `weapon-matchers.ts`. The article's advice: co-locate unless multiple modules need it, in which case move it up a level. One file doesn't warrant its own subfolder. It could live directly in items or be absorbed into the item configs that use it.

#### 6. Dependency versions not pinned

The article says to pin exact versions. Currently:

```json
"dependencies": {
  "@opentelemetry/api-logs": "^0.215.0",   // ← caret
  "zod": "^4.4.3",                          // ← caret
  ...
},
"devDependencies": {
  "@biomejs/biome": "2.4.12",              // ✅ exact
  "typescript": "^6.0.3"                   // ← caret
}
```

Only Biome is pinned. Everything else uses `^`. The risk: a minor library update breaks behaviour silently. Drop the carets and rely on renovate.json (which you already have) to manage deliberate updates.

#### 7. Test coverage is thin

- updater.test.ts — tests only `validateRow`, skipping `runUpdate` entirely
- spviewer-html-parser.test.ts — tests the HTML parser

Nothing tests: the I/O layer (`ini-file.ts`, csv-parser.ts), item config `buildValue` functions, the artifact pipeline, or the 8 update modules in `lib/updates/`. The article strongly advocates for integration tests as the highest-value investment. There are none. This is the most significant gap.

---

### Summary table

| Area | Status | Note |
|---|---|---|
| Domain module structure | ✅ | Not MVC |
| Layer separation (CLI/logic/IO) | ✅ | Clean |
| TypeScript strict | ✅ | |
| Structured logging | ✅ | OpenTelemetry |
| Native Node APIs | ✅ | |
| No callbacks | ✅ | |
| Process signal handling | ✅ | `unhandledRejection` |
| Consistency (Biome) | ✅ | |
| Pinned Node version | ✅ | Volta |
| `lib/` as catch-all | ⚠️ | `updates/` is domain logic |
| `io/local/` nesting | ⚠️ | Only one child exists |
| CSV read/write co-location | ⚠️ | Split across `lib/` and `io/local/` |
| Schema co-location | ⚠️ | schema is distant from consumers |
| `shared/` folder for 1 file | ⚠️ | Over-grouped |
| Dependency pinning | ⚠️ | Only biome is pinned |
| Test coverage | ⚠️ | Very thin; no integration tests |
