## 2024-05-15 - SCMDB Parsing Extraction

Learning: The `bin/scrape-scmdb.js` file contained massive monolithic extraction functions for building mission and blueprint pool rows. This violated single responsibility principles by tightly coupling file IO (fetching and writing SCMDB data) with domain transformation logic (mapping SCMDB entities to our internal CSV structures). Extracted this mapping logic into a new shared module `src/lib/scmdb/mission-parser.js`.
Action: Extracted `buildMissionRows`, `buildContractRow`, `buildBlueprintPoolRows`, `buildContractBlueprintRows`, and `collectBlueprintChainData` into a standalone, pure mapper file with strict JSDoc typing (`ScmdbContractDTO`, etc.).
