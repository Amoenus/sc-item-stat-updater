#!/usr/bin/env bash
# extract_global_ini.sh
# Downloads the latest unp4k release and extracts Data/Localization/english/global.ini
# from the local Star Citizen Data.p4k file.
#
# Output: /mnt/c/Games/Roberts Space Industries/StarCitizen/LIVE/Data/Localization/english/global.ini

set -euo pipefail

# --- Environment detection ---
# Detect whether we're running in WSL or Git Bash / MSYS2
if command -v wslpath &>/dev/null; then
    ENV_TYPE="wsl"
    to_win() { wslpath -w "$1"; }
elif command -v cygpath &>/dev/null; then
    ENV_TYPE="gitbash"
    to_win() { cygpath -w "$1"; }
else
    echo "ERROR: Neither wslpath (WSL) nor cygpath (Git Bash) found. Cannot convert paths."
    exit 1
fi

# --- Paths ---
# SCRIPT_DIR is now inside Data/Localization/english/; LIVE_DIR is 3 levels up.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIVE_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# P4K_FILE: accept as first argument, env var, or default to Data.p4k in the LIVE directory
P4K_FILE="${1:-${P4K_FILE:-$LIVE_DIR/Data.p4k}}"
OUTPUT_DIR="$(dirname "$P4K_FILE")"
TOOL_DIR="$OUTPUT_DIR/unp4k"
TOOL_EXE=""   # resolved after download/find below
ZIP_PATH="$TOOL_DIR/unp4k.zip"

# Filter: tool matches by filename; use bare name to ensure it works.
# This extracts all locale global.ini files — english is what we need, others are harmless.
FILTER="global.ini"

# --- Helpers ---
log() { echo "[extract_global_ini] $*"; }

# --- Sanity check ---
if [[ ! -f "$P4K_FILE" ]]; then
    echo "ERROR: Data.p4k not found at: $P4K_FILE"
    exit 1
fi

# --- Download latest unp4k if needed ---
mkdir -p "$TOOL_DIR"

# Check GitHub for the latest release tag to decide if we need to (re)download
log "Checking latest unp4k release..."
LATEST_TAG=$(curl -fsSL -o /dev/null -w '%{url_effective}' \
    "https://github.com/dolkensp/unp4k/releases/latest" \
    | grep -oP '[^/]+$') || true

# New releases use versioned, platform-specific filenames: unp4k-win-x64-v{TAG}.zip
LATEST_URL="https://github.com/dolkensp/unp4k/releases/download/${LATEST_TAG}/unp4k-win-x64-${LATEST_TAG}.zip"

VERSION_FILE="$TOOL_DIR/version.txt"
CURRENT_TAG=""
[[ -f "$VERSION_FILE" ]] && CURRENT_TAG=$(cat "$VERSION_FILE")

EXISTING_EXE=$(find "$TOOL_DIR" -name "unp4k.exe" 2>/dev/null | head -1)
if [[ -z "$EXISTING_EXE" || "$CURRENT_TAG" != "$LATEST_TAG" ]]; then
    log "Downloading unp4k $LATEST_TAG ..."
    curl -fsSL -L "$LATEST_URL" -o "$ZIP_PATH"
    log "Extracting unp4k.zip ..."
    # Use Windows' built-in Expand-Archive via PowerShell so we stay self-contained
    powershell.exe -NoProfile -Command \
        "Expand-Archive -Force -Path '$(to_win "$ZIP_PATH")' -DestinationPath '$(to_win "$TOOL_DIR")'"
    # The exe may be nested in a subdirectory inside the zip; find it
    TOOL_EXE=$(find "$TOOL_DIR" -name "unp4k.exe" | head -1)
    if [[ -z "$TOOL_EXE" ]]; then
        echo "ERROR: unp4k.exe not found after extraction in $TOOL_DIR"
        exit 1
    fi
    echo "$LATEST_TAG" > "$VERSION_FILE"
    log "unp4k installed at: $TOOL_DIR"
else
    log "unp4k is already up-to-date ($CURRENT_TAG), skipping download."
    TOOL_EXE=$(find "$TOOL_DIR" -name "unp4k.exe" | head -1)
    if [[ -z "$TOOL_EXE" ]]; then
        echo "ERROR: unp4k.exe not found in $TOOL_DIR — delete version.txt to force re-download"
        exit 1
    fi
fi

# --- Run extraction ---
log "Extracting: $FILTER"
log "  Source : $P4K_FILE"
log "  Output : $OUTPUT_DIR"

# Remove stale copy first — unp4k silently skips existing files
RESULT="$OUTPUT_DIR/Data/Localization/english/global.ini"
if [[ -f "$RESULT" ]]; then
    log "Removing existing global.ini before fresh extraction..."
    rm -f "$RESULT"
fi

# Convert paths to Windows format for the .exe
W_P4K=$(to_win "$P4K_FILE")
W_OUT=$(to_win "$OUTPUT_DIR")
W_EXE=$(to_win "$TOOL_EXE")

# Tool extracts relative to cwd; cd to OUTPUT_DIR and pass only p4k + filter (no -o flag)
powershell.exe -NoProfile -Command \
    "Set-Location '${W_OUT}'; & '${W_EXE}' '${W_P4K}' '${FILTER}'"

# --- Verify ---
if [[ -f "$RESULT" ]]; then
    SIZE=$(wc -c < "$RESULT")
    log "SUCCESS: global.ini extracted (${SIZE} bytes)"
    log "  Path: $RESULT"
else
    echo "ERROR: Extraction completed but global.ini not found at expected path:"
    echo "  $RESULT"
    exit 1
fi
