#!/usr/bin/env bash
# update-global-ini.sh
# Full pipeline: extract global.ini from Data.p4k, optionally scrape fresh data,
# then apply all stat updates.
#
# Usage:
#   ./update-global-ini.sh [options]
#
# Options:
#   --scrape        Run scrape:scmdb and scrape:spviewer before updating
#   --dry-run       Pass --dry-run through to update-all (no file writes)
#   --ptu           Use PTU scraped data
#   --verbose, -v   Enable verbose logging
#   --help, -h      Show this message

set -euo pipefail

SCRAPE=false
UPDATE_ARGS=()

for arg in "$@"; do
    case "$arg" in
        --scrape)        SCRAPE=true ;;
        --dry-run)       UPDATE_ARGS+=("--dry-run") ;;
        --ptu)           UPDATE_ARGS+=("--ptu") ;;
        --verbose|-v)    UPDATE_ARGS+=("--verbose") ;;
        --help|-h)
            sed -n '/^# Usage:/,/^[^#]/p' "$0" | grep '^#' | sed 's/^# \?//'
            exit 0
            ;;
        *)
            echo "ERROR: Unknown option: $arg" >&2
            exit 1
            ;;
    esac
done

log() { echo "[update-global-ini] $*"; }

# --- Step 1: Extract ---
log "=== Step 1: Extracting global.ini ==="
bash "$(dirname "${BASH_SOURCE[0]}")/extract_global_ini.sh"

# --- Step 2: Scrape (optional) ---
if [[ "$SCRAPE" == "true" ]]; then
    log "=== Step 2: Scraping SCMDB ==="
    npm run scrape:scmdb

    log "=== Step 2b: Scraping SPViewer ==="
    npm run scrape:spviewer
else
    log "=== Step 2: Skipping scrape (pass --scrape to enable) ==="
fi

# --- Step 3: Apply updates ---
log "=== Step 3: Applying stat updates ==="
npm run update -- "${UPDATE_ARGS[@]+"${UPDATE_ARGS[@]}"}"

log "=== Done ==="
