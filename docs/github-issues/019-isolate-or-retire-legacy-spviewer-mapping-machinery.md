# Isolate Or Retire Legacy SPViewer Mapping Machinery

GitHub: #132

## Problem

SPViewer is retired, but SPViewer-named mapping files and mapping-store resolution machinery still exist and can shape
update planning.

## Acceptance Criteria

- Active DataCore and mission categories cannot hit SPViewer mapping logic unless an explicit legacy mode is selected.
- Mapping files have an ownership policy: active legacy, diagnostic, historical, or removable.
- Tests cover active-category behavior and any retained legacy command.
- Docs stop presenting SPViewer mappings as normal active workflow state.

