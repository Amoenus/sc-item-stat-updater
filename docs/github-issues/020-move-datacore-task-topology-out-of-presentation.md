# Move DataCore Task Topology Out Of Presentation

GitHub: #133

## Problem

`src/presentation/datacore-task.ts` owns operationally meaningful raw fact groups, item type groups, and concurrency
display structure. Presentation code should render topology, not own it.

## Acceptance Criteria

- DataCore stage metadata lives in application/source plan data.
- Presentation code renders stage groups without owning dependency order.
- Tests cover stage ordering/dependencies separately from rendering.
- Existing CLI output remains readable.

