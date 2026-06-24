# ADR 007: DataCore Record Graph Fidelity And Cache Metadata

## Status

Proposed

## Context

DataCore refresh builds a record graph from the XML cache. That graph is used as both a relationship index and a
derived source artifact. Recent memory pressure showed that full-fidelity graph generation can exceed the default V8
heap, while compact graph generation can remove fields that some extractors still expect.

The previous cache hit path treated a reused XML cache plus an existing `record-graph.json` as enough evidence to use
the graph. That did not prove the graph matched the DCB, XML cache count, graph schema, generator version, or fidelity
mode.

## Decision

Treat the record graph as a versioned derived index with explicit fidelity:

- The graph has a schema version.
- The graph has a generator version.
- The graph records whether it was generated in compact or full fidelity mode.
- The graph cache is reusable only when its metadata matches the current DCB fingerprint and XML cache fingerprint.
- Extractors must declare which graph fidelity they require, or use XML rereads deliberately when compact graph data is
  insufficient.

## Consequences

### Positive

- Stale or incompatible graph files are rebuilt rather than silently trusted.
- Compact graph memory work becomes explicit instead of implicit.
- Future graph schema changes can be rolled out with cache invalidation.

### Negative

- Existing graph caches without metadata will be rebuilt.
- Some tests and extractors must be audited for full-fidelity assumptions.
- The graph may need a more nuanced projection model than a single compact/full switch.

## Follow-Up Work

1. Fix current compact graph extractor regressions.
2. Add memory and graph-size budget checks for DataCore cache refresh.
3. Decide whether to split graph projections by consumer instead of one global graph file.
4. Keep graph metadata stable enough for repeatable generated-data reviews.

