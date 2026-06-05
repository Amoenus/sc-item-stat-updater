# Glossary

This glossary defines project terms for the enrichment pipeline. Prefer these terms in code, docs, issues, and commit messages.

## Core Terms

### global.ini

The Star Citizen localization file that contains key/value strings used by the game UI. This project enriches values in this file while preserving localization syntax and file encoding.

### Game Install

The local Star Citizen installation directory. The app reads source files from this location and deploys the enriched `global.ini` back into it.

### Source

Any place we acquire data from. Current and expected sources include game files/DataCore, SCMDB, and SPViewer.

### Source Dataset

A validated set of records from one source, version, and channel. Source datasets are the boundary between acquisition/normalization and enrichment planning.

### Acquisition

The stage that retrieves raw data from game files, local caches, command-line tools, or websites.

### Normalization

The stage that converts raw source-specific data into stable internal records.

### Enrichment

The project-specific logic that decides what extra information should be added to in-game text.

### Patch Plan

A proposed set of localization key/value changes plus issues. Patch plans are inspectable and testable before any file is written.

### Patch Entry

One planned localization update: a target key, replacement value, source, and reason.

### Application

The stage that applies a patch plan to INI text. It is responsible for preserving encoding, variants, comments, ordering, and deterministic output.

### Deployment

The stage that copies the enriched `global.ini` into its final destinations, including the repo copy and the game folder.

### Artifact

A JSON representation of a patch plan that can be saved, reviewed, published, or applied later.

## Source Terms

### DataCore

Game-file data extracted from Star Citizen files such as `Game2.dcb`. This is preferred for item stats when it provides the needed fields because it can be fresher than third-party data.

### SCMDB

The Star Citizen Metadata Database. This source provides organized and enriched data, including community or curated insights that pure game files may not provide.

### SPViewer

A third-party source previously used for item stats. It remains useful as a legacy comparison/audit source, but DataCore is the active item-stat provider.

## Localization Terms

### Localization Key

The left-hand side of a `global.ini` entry.

### Localization Value

The right-hand side of a `global.ini` entry.

### Flavor Text

Existing descriptive text that should usually be preserved when stat blocks are added or rebuilt.

### Variant Key

A localization key with a suffix such as plural or gender variants. Patch application must preserve and update variants correctly.
