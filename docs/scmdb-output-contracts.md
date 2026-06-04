# SCMDB Output Contracts

These SCMDB CSVs are downstream-facing artifacts. Column changes should be intentional and covered by tests.

## `legacy-contracts.csv`

`legacy-contracts.csv` uses the same contract row header contract as `contracts.csv`, in this exact order:

```text
id
debugName
category
missionType
missionTypeKey
title
titleKey
description
descriptionKey
descriptionLocKey
rewardUEC
timeToComplete
canBeShared
illegal
factionGuid
locations
destinations
prerequisites
tokenSubstitutions
minStanding
maxStanding
blueprintRewards
isBlueprintReward
isBlueprintChainPrerequisite
blueprintChainDepth
personalCooldownTime
rewardRepCalculated
factionRewards
factionRewardsRaw
shipEncounters
haulingOrders
itemRewards
completionTags
pyroRegion
buyIn
onceOnly
maxPlayersPerInstance
availableInPrison
canReacceptAfterAbandoning
canReacceptAfterFailing
hasPersonalCooldown
abandonedCooldownTime
hideInMobiGlas
systems
factionRewards_fail
requiredScenarios
isIntro
requiredIntros
linkedIntros
pickupCount
deliveryCount
propertyValues
```

The blueprint marker fields are part of this stable contract:

- `isBlueprintReward`: `true` only for direct blueprint reward contracts.
- `isBlueprintChainPrerequisite`: `true` for contracts that unlock, directly or indirectly, a blueprint reward contract.
- `blueprintChainDepth`: `0` for direct blueprint reward contracts, `1+` for prerequisite chain contracts, and empty for unrelated contracts.

Tests in `src/sources/scmdb/output-files.test.ts` and `src/sources/scmdb/outputs.test.ts` pin this contract. Update those tests alongside this document when changing downstream SCMDB CSV shape.
