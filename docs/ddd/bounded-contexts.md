# Bounded Context Map for sc-item-stat-updater

This document defines the explicit bounded contexts for the sc-item-stat-updater application based on business capabilities.

## Bounded Contexts

### 1. Item Catalog Context
**Responsibility**: Managing Star Citizen item definitions and properties

**Core Responsibilities**:
- Maintaining canonical item definitions
- Managing item types and classifications
- Storing manufacturer information
- Defining item properties and characteristics
- Validating item data integrity

**Key Entities**:
- Item (Aggregate Root)
- ItemId (Value Object)
- ItemType (Enumeration)
- Manufacturer (Value Object)
- ItemStats (Value Object)

**Interfaces**:
- Provides item data to other contexts via repositories
- Receives validation requests from Validation Context
- Sends item change events to other contexts

**Shared Kernel**: None (pure domain context)

**Anti-Corruption Layer**: Protects against DataSource-specific formats

### 2. Data Extraction Context
**Responsibility**: Transforming raw game data into usable formats

**Core Responsibilities**:
- Extracting data from various sources (SCMDB, SPViewer, DataForge)
- Converting source-specific formats to domain-neutral representations
- Performing initial data validation and cleaning
- Handling source-specific quirks and inconsistencies
- Mapping external identifiers to internal ItemIds

**Key Entities**:
- ExtractedItem (Data Transfer Object)
- SourceMapping (Value Object)
- ExtractionResult (Value Object)
- DataSource (Enumeration)

**Interfaces**:
- Consumes raw data from external sources
- Produces domain items for Item Catalog Context
- Sends extraction events to Validation Context
- Receives source configuration from Infrastructure

**Shared Kernel**: Item identifiers with Item Catalog Context

**Anti-Corruption Layer**: Translates between external formats and internal domain model

### 3. INI Management Context
**Responsibility**: Updating Star Citizen configuration files

**Core Responsibilities**:
- Reading and parsing INI configuration files
- Locating specific item sections within INI files
- Generating updated INI content with modified item stats
- Preserving file formatting and comments where possible
- Creating backups before modifications
- Validating INI syntax after updates

**Key Entities**:
- IniFile (Value Object)
- IniSection (Value Object)
- IniProperty (Value Object)
- BackupMetadata (Value Object)
- UpdateOperation (Domain Event)

**Interfaces**:
- Consumes processed items from Data Extraction Context
- Produces updated files for presentation layer
- Sends update events to Validation Context
- Receives file system access from Infrastructure

**Shared Kernel**: File paths with Infrastructure Context

**Anti-Corruption Layer**: Protects domain logic from INI format specifics

### 4. Validation Context
**Responsibility**: Ensuring data integrity and consistency

**Core Responsibilities**:
- Validating item data against business rules
- Checking cross-item consistency (e.g., manufacturer naming conventions)
- Ensuring required fields are present and within expected ranges
- Validating relationships between item properties
- Providing validation feedback to other contexts
- Maintaining validation rule sets

**Key Entities**:
- ValidationRule (Value Object)
- ValidationResult (Value Object)
- ValidationSeverity (Enumeration)
- BusinessInvariant (Value Object)

**Interfaces**:
- Receives items from Item Catalog Context for validation
- Receives extracted data from Data Extraction Context for pre-validation
- Receives update proposals from INI Management Context for post-validation
- Sends validation events to all other contexts
- Provides validation status to presentation layer

**Shared Kernel**: Item identifiers with Item Catalog Context
**Shared Kernel**: Validation patterns with Infrastructure Context (logging, monitoring)

**Anti-Corruption Layer**: Not applicable (pure validation context)

## Context Relationships

```
[Item Catalog] <--shared kernel--> [Data Extraction]
      |                                |
      |uses items for validation       |provides extracted items
      v                                v
[Validation Context] <--shared kernel--> [INI Management]
      |                                |
      |validates updates               |applies validated updates
      |                                |
      v                                v
[Presentation Layer] <- uses all contexts for CLI/workflow orchestration
```

## Communication Patterns

### Synchronous Communication
- Item Catalog provides repositories for other contexts to query items
- Validation Context provides validators that other contexts call
- INI Management provides file operations that presentation layer calls

### Asynchronous Communication (Domain Events)
- Item Data Extracted: Published by Data Extraction Context when new items are available
- Item Validation Failed/Passed: Published by Validation Context after validation
- Description Updated: Published by INI Management Context when files are modified
- Backup Created: Published by INI Management Context before file modifications
- Update Completed: Published by INI Management Context when update finishes
- Validation Rule Changed: Published by Validation Context when rules are updated

## Shared Kernel Definitions

### Item Identifier Sharing
The ItemId value object is shared between Item Catalog and Data Extraction contexts to ensure consistent identification of items across boundaries.

### File Path Sharing
File path value objects are shared between INI Management and Infrastructure contexts to ensure consistent file access patterns.

## Anti-Corruption Layers

Each context that interfaces with external systems or other bounded contexts implements an anti-corruption layer:

1. **Data Extraction Context**: Adapters that convert SCMDB/SPViewer/DataForge formats to domain-neutral ExtractedItem objects
2. **INI Management Context**: Adapters that convert between domain items and INI-specific formats
3. **Presentation Layer**: Controllers that translate between CLI arguments and application use cases

## Implementation Guidelines

1. **Dependencies Flow Inward**: Outer contexts may depend on inner contexts, but never vice versa
2. **Shared Kernel Only for Truly Shared Concepts**: Only share what is absolutely necessary across contexts
3. **Explicit Interfaces**: Define clear interfaces (TypeScript interfaces) for cross-context communication
4. **Event-Driven Integration**: Use domain events for loose coupling where possible
5. **Context Mapping Documentation**: Keep this document updated as the system evolves

## Next Steps

1. Implement the directory structure reflecting these bounded contexts
2. Move existing code into appropriate context folders
3. Define interfaces between contexts
4. Implement anti-corruption layers
5. Set up domain event publishing and handling