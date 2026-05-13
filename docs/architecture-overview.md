# Architecture Overview: sc-item-stat-updater

## Executive Summary

The application will evolve in two phases to optimize user experience, minimize upstream API abuse, and eliminate server hosting costs.

* **Phase 1 (The Foundation):** Refactor the existing Node.js PoC into a resilient, strictly typed, plugin-based local CLI application.
* **Phase 2 (The Web Portal):** Split the CLI’s execution. The "Extract/Transform" logic moves to a headless CI/CD pipeline, outputting static artifacts. The "Load" (INI merging) logic moves to a static GitHub Pages website using browser-native APIs.

---

## 1. System Context Diagram (Level 1)

### Phase 1: Local Execution Context

```text
[ User ] --(Executes)--> [ CLI Application (sc-item-stat-updater) ]
                                |               |
                          (Reads/Writes)    (Fetches)
                                |               |
                                v               v
                     [ Local global.ini ]   [ Upstream APIs (SPViewer/SCMDB) ]

```

### Phase 2: Static Web Context

```text
  [ GitHub Actions (CI/CD) ] --(Scheduled Cron)--> [ Upstream APIs ]
            |
      (Transforms & Commits)
            |
            v
  [ GitHub Pages (Static Host) ] <--(Fetches Artifact)-- [ User's Browser (Web App) ]
                                                                |
                                                          (Reads/Writes locally)
                                                                |
                                                                v
                                                        [ Local global.ini ]

```

---

## 2. Component Architecture (Level 2/3)

The system is designed with a strict boundary between Data Processing (Extraction/Transformation) and Data Application (Loading/Merging).

### 2.1 The Data Processing Domain (Shared Phase 1 & 2)

*This logic runs locally in Phase 1, and inside GitHub Actions in Phase 2.*

* **Extraction Engine (`/src/extractor`)**: Handles polite scraping. Implements rate-limiting, retry with exponential backoff, and local `.cache` checks.
* **Schema Validation Layer (`/src/schema`)**: Uses **Zod** to validate upstream JSON/CSV payloads before processing, halting execution immediately if the game's data structure changes.
* **Transformation Pipeline (`/src/transformers`)**: A plugin-based architecture (e.g., `MissileTransformer`, `QuantumDriveTransformer`) that normalizes game data into a unified, pre-calculated update manifest.
* **Artifact Generator (`/src/artifact`)**: Rather than writing directly to an INI file, the pipeline outputs an intermediary `patch-data.json` containing exact Key/Value pairs intended for injection.

### 2.2 The Application Domain (Phase 1: CLI)

* **Local I/O Manager (`/src/io/local`)**: Orchestrates safe file-system operations. Backs up `global.ini`, writes to a `.tmp` file, and performs an atomic rename.

### 2.3 The Application Domain (Phase 2: Web Frontend)

* **Static UI (React or Vanilla JS)**: A zero-dependency web interface hosted on GitHub Pages.
* **Browser I/O Manager (`/src/io/browser`)**: Utilizes the **HTML5 File API** to read the user's `global.ini` into browser memory.
* **Client-Side Compiler (`/src/compiler`)**: Merges the `patch-data.json` (fetched from GitHub Pages) with the user's local INI text.
* **Blob Exporter**: Triggers an automatic download of the modified `global.ini` back to the user's machine.

---

## 3. Data Flow Specification

### Phase 1 Flow: The Local Run

1. **Init:** User runs `npm start`.
2. **Extract:** Fetch game data, adhering to rate limits and caching.
3. **Validate:** Zod schemas verify structural integrity.
4. **Transform:** Plugins generate update strings.
5. **Stage:** Strings are compiled into an in-memory Artifact Object.
6. **Backup:** `global.ini` is copied to `/backups/`.
7. **Write:** Artifact Object is streamed into `global.ini.tmp`, replacing keys.
8. **Commit:** `global.ini.tmp` is renamed to `global.ini`.

### Phase 2 Flow A: The CI/CD "Backend" (Runs Daily)

1. **Trigger:** GitHub Actions cron job fires.
2. **Execute Pipeline:** Runs the Extract, Validate, and Transform steps from Phase 1.
3. **Artifact Creation:** Generates a highly optimized `patch-[version]-artifact.json`.
4. **Deploy:** Action commits the JSON artifact to the `gh-pages` branch.

### Phase 2 Flow B: The User Web Experience

1. **Visit:** User navigates to `your-repo.github.io/sc-updater`.
2. **Upload:** User clicks "Select File" and selects their local Star Citizen `global.ini`.
3. **Fetch:** The browser silently fetches the latest `patch-[version]-artifact.json` from the same server.
4. **Process (Local):** JavaScript in the browser parses the INI, finds the relevant keys, and replaces the strings. **(Zero server transmission of user files).**
5. **Download:** The browser prompts the user to save the newly generated `global.ini` over their old one.
