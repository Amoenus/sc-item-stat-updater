# Architecture Overview: sc-item-stat-updater

## Purpose

`sc-item-stat-updater` enriches Star Citizen's `global.ini` with additional quality-of-life information for in-game text. The application should always start from a fresh `global.ini` extracted from the installed game files, enrich it with data from game files and selected web sources, keep the updated repo copy available for review and commits, and deploy the enriched file back into the game folder.

The project is evolving toward a Clean Pipeline Architecture. The core model is a staged data pipeline, not a heavy DDD entity model.

## Architectural Decision

The application is organized around the shape of the work:

1. Acquire raw inputs.
2. Normalize source-specific data into stable internal records.
3. Plan localization patches.
4. Apply patches to `global.ini`.
5. Deploy the enriched file to the repo and game folder.

This keeps extraction, enrichment decisions, and file mutation separate. Extraction code must not directly update `global.ini`; it produces source data. Enrichment code must not scrape or write files; it produces patch plans. Application/use-case code composes the steps.

## System Flow

```text
Game install
  -> extract fresh global.ini
  -> extract game-file data

SCMDB website
  -> download/scrape enriched web data

Optional legacy sources
  -> SPViewer comparison data

Normalized source datasets
  -> enrichment planners
  -> patch plan / artifact
  -> apply to repo global.ini
  -> deploy enriched global.ini to game folder
```

## Responsibility Areas

### Acquisition

Acquisition gets raw data from the outside world.

Examples:

- Extract `global.ini` from `Data.p4k`.
- Extract `Data/Game2.dcb` from `Data.p4k` into the repo-owned DCB cache, then extract DataCore/game-file records from that cached DCB.
- Download SCMDB JSON/CSV-derived data.
- Scrape SPViewer data when it is useful as legacy comparison or audit input.

Acquisition code knows about external tools, network access, cache directories, file discovery, and source-specific retrieval mechanics.

### Normalization

Normalization converts raw source formats into stable internal records.

Examples:

- DataCore XML becomes typed component-stat records.
- SCMDB merged JSON becomes typed mission, mining, commodity, and crafting records.
- SPViewer tables become typed item-stat records for legacy comparison flows.

Source quirks belong here. Later stages should not need to know whether a value came from XML attributes, CSV columns, nested SCMDB JSON, or scraped HTML.

### Planning

Planning decides what should change in `global.ini`.

Examples:

- Build enriched item description values.
- Add SCMDB insights to mission text.
- Add mining journal/location details.
- Generate title/tag/label fixes.

Planning produces a patch plan: intended localization key/value changes plus issues. It should not write files.

### Application

Application applies a patch plan to INI text safely.

Examples:

- Read and index localization keys.
- Preserve UTF-8 BOM, comments, and INI variants such as gender/plural suffixes.
- Update existing keys or insert missing keys in deterministic locations.
- Produce dry-run summaries and issue reports.

### Deployment

Deployment moves files into the right place after enrichment.

Examples:

- Keep the repo's `global.ini` updated so changes can be reviewed and committed.
- Back up the previous file where appropriate.
- Copy the enriched `global.ini` back into the game folder.

## Source Layout

The implemented source layout is:

```text
src/
  application/      # Use cases and workflow orchestration
  artifact/         # Patch artifact generation/loading/application
  enrichment/       # Item config contracts, stat formatting, and extra update steps
  extractor/        # Parser internals reused by source facades
  infrastructure/   # Logging and CSV serialization infrastructure
  io/local/         # Local filesystem IO helpers and path conventions
  items/            # Item and mission enrichment rule modules
  localization/     # INI parsing/application, key resolution, and localization text helpers
  pipeline/         # Core pipeline data contracts
  presentation/     # CLI argument and presentation helpers
  schema/           # Runtime schemas
  sources/          # DataCore, SCMDB, and SPViewer source acquisition/normalization
```

DataCore and SCMDB expose source-boundary modules under `src/sources/*`. SPViewer remains a legacy comparison source and exposes its HTML parser facade and dataset types under `src/sources/spviewer`, but it is no longer part of active batch provider selection.

## Core Concepts

### Source Dataset

A validated collection of records from one provider/version/channel.

```ts
type SourceDataset<T> = {
  source: 'datacore' | 'scmdb' | 'spviewer';
  version: string;
  channel: 'live' | 'ptu';
  records: T[];
};
```

### Patch Plan

The planned changes to localization keys before they are applied to an INI file.

```ts
type PatchPlan = {
  entries: PatchEntry[];
  issues: UpdateIssue[];
};
```

### Patch Entry

One intended localization update.

```ts
type PatchEntry = {
  key: string;
  value: string;
  source: string;
  reason: string;
};
```

Duplicate and plural/gender suffix handling uses an application-only line-index hint on the localization application type `LocalizationPatchEntry`, not the core `PatchEntry` contract. This keeps persisted patch plans and artifacts independent from line positions while preserving current INI behavior.

### Patch Artifact

Patch artifacts currently keep the ADR 002 JSON shape for compatibility:

```ts
type PatchArtifact = {
  entries: Record<string, string>;
  issues: UpdateIssue[];
};
```

`entries` is the persisted projection of `PatchPlan.entries`, keyed by localization key. Localization application metadata such as `existingLineIndex` is intentionally not serialized. Code that needs the in-memory pipeline contract can convert artifact entries back into a `PatchPlan` with artifact-level default `source` and `reason` values.

## Boundary Rules

- Acquisition may read files, call tools, and fetch web data, but it must not mutate `global.ini`.
- Normalization may understand source-specific formats, but it must output stable internal records.
- Planning may read normalized records and existing localization context, but it must output patch plans instead of writing files.
- Application may mutate INI text, but it must not scrape or parse provider-specific source formats.
- CLI scripts should be thin adapters that parse arguments and call application use cases.
- Generic filesystem helpers belong under infrastructure; localization-aware INI behavior belongs under localization.

Run `npm run check:architecture` to enforce the current automated boundary rules. The guardrail is intentionally small: source modules must not import localization application or updater mutation code.

## Adding A Source Provider

When adding a source provider, keep acquisition and normalization separate from localization mutation:

1. Add provider-specific records and dataset aliases under `src/sources/<provider>/types.ts`.
2. Put fetch, scrape, cache, or tool-invocation logic under `src/sources/<provider>/acquisition.ts` or similarly named source modules.
3. Normalize provider data into stable records before application use cases consume it.
4. Keep provider modules independent from `global.ini` mutation, localization patch application, and application update-planning code.
5. Add a use case under `src/application/use-cases` when CLI or pipeline orchestration needs to run the provider.
6. Add focused tests for version selection, parsing, and output contracts before wiring the provider into a broad pipeline command.

## Adding An Enrichment Planner

When adding an enrichment planner or item rule, keep source shape knowledge and INI application responsibilities explicit:

1. Add item or mission rule modules under `src/items` and use `ItemConfig` from `src/enrichment/item-config`.
2. Use helpers from `src/enrichment` for stat formatting or enrichment-specific update behavior.
3. Build patch plans through application use cases instead of writing `global.ini` directly.
4. Keep localization-aware operations in `src/localization`; do not serialize application-only metadata into artifacts.
5. Register new categories in `src/items/registry.ts` and add preflight coverage for required source files.
6. Add focused tests for planner output and run `npm run check:architecture` before committing boundary-sensitive changes.

## Maintenance Strategy

1. Keep CLI scripts as adapters that parse arguments, render progress, and call application use cases.
2. Keep source-specific parsing and transformation behind source modules.
3. Keep localization mutation behavior under `src/localization`.
4. Keep generated patch artifacts free of application-only metadata.
5. Prefer focused tests around source contracts, patch planning, and INI application before changing behavior.
6. Run `npm run check:architecture`, `npm run typecheck`, and `npm test` before committing boundary-sensitive changes.

## Non-Goals

- Do not introduce full DDD aggregates, repositories, domain events, or rich entity models unless a concrete maintenance problem requires them.
- Do not make extraction code depend on localization mutation details.
- Do not optimize around a future web app at the expense of the local pipeline, which remains the primary workflow.
