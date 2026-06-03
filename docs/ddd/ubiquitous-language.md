# Ubiquitous Language for sc-item-stat-updater

This document defines the shared vocabulary between developers and domain experts (Star Citizen players/data analysts) for the sc-item-stat-updater project.

## Core Domain Concepts

### Item
Represents any Star Citizen entity (ship, weapon, component, etc.) that has measurable statistics and can be configured in the game.

*Examples:* Mustang Alpha, Size 2 Power Plant, Shield Generator, Gatling Gun

### ItemType
Classification of items based on their function or category in the game.

*Valid Types:* Bomb, Cooler, Emp, Gun, Missile, PowerPlant, QuantumDrive, Shield, Turret, WeaponAttachment, etc.

### ItemIdentifier (ItemId)
Unique identifier for an item composed of its entity class and manufacturer.

*Format:* `{EntityClass}_{Manufacturer}`
*Examples:* `SCItem_Aegis`, `SCItem_RSI`, `WeaponAttachment_MkVIII`

### ItemStats
Collection of measurable properties that define an item's capabilities in-game.

*Examples:* Damage values, health/radius, cooling capacity, power output, quantum drive speed

### DescriptionTemplate
Format for how item stats appear in-game tooltips and UI.

*Examples:* "DPS: {damagePerSecond}", "Cooling Capacity: {coolingValue}", "Shield Health: {shieldHealth}"

### DataSource
Origin of item data used by the updater.

*Valid Sources:* 
- SCMDB (Star Citizen Metadata Database)
- SPViewer (Star Citizen Viewer)
- DataForge (Game data extraction)

### UpdateOperation
Process of modifying Star Citizen configuration files with updated item information.

*Components:* Backup creation, data extraction, validation, file modification, cleanup

### ValidationContext
Ensuring data integrity and consistency throughout the update process.

*Checks:* Required fields present, values within expected ranges, cross-reference consistency

## Supporting Concepts

### EntityClass
The base classification of an item in Star Citizen's data structure.

*Examples:* SCItem, WeaponAttachment, Shield, PowerPlant

### Manufacturer
The company or faction that produces the item in the Star Citizen universe.

*Examples:* Aegis, RSI, Drake, Kruger, Origin

### StatLine
A single line in an item's description consisting of a label and value.

*Examples:* "Damage: 25", "Cooling Rate: 120", "Shield HP: 1500"

### SectionHeader
A logical grouping of related stats in an item's description.

*Examples:* "Offensive Stats", "Defensive Capabilities", "Power Requirements"

### FlavorText
Optional descriptive text that appears in item descriptions, often providing lore or usage notes.

*Example:* "A reliable power plant for mid-sized vessels"

### Backup
A copy of the original configuration file made before modifications for safety and rollback purposes.

### ExtractedData
Raw item information retrieved from a data source before processing into domain objects.

### ProcessedData
Item information that has been validated, transformed, and is ready for application to configuration files.

## Relationships

- An Item has exactly one ItemIdentifier
- An Item has exactly one ItemType  
- An Item has exactly one ItemStats collection
- An Item may have an optional DescriptionTemplate
- ItemStats contains multiple StatLines
- StatLines may be grouped under SectionHeaders
- UpdateOperation processes Items from a specific DataSource
- ValidationContext ensures Item integrity throughout UpdateOperation

## Usage Guidelines

1. Use domain terms consistently in code, documentation, and discussions
2. Prefer domain terms over technical implementation terms (e.g., "Item" vs "data object")
3. When uncertain, consult this glossary to ensure alignment
4. New domain concepts should be added to this document with clear definitions
5. Code should reflect these concepts in class, method, and variable names

## Change Log

*Initial version created as part of DDD improvement initiative*