# Add Source Version Lock And Coherence Checks

GitHub: #131

## Problem

DataCore and SCMDB latest version folders are selected independently. Diagnostics can warn later, but incoherent
source pairings can still enter prepared update flows.

## Acceptance Criteria

- Active source versions are represented in one manifest or lock.
- Mismatch handling distinguishes allowed mismatch, warning-only mismatch, and hard failure.
- Diagnostics explain selected source versions and refresh/pinning options.
- Tests cover matched, mismatched, missing, and explicitly pinned source versions.

