# Domain-Driven Design Improvement Plan for sc-item-stat-updater

## Current State Analysis

The sc-item-stat-updater application already exhibits some DDD-inspired patterns:
- **Bounded Contexts**: Separate directories for datacore, missions, and spviewer item types
- **Value Objects**: The stat-builder pattern creates immutable description objects
- **Repository Pattern**: The registry dynamically loads item configurations
- **Entities**: Item configurations represent domain concepts with identity

However, there are opportunities to deepen the DDD implementation to better align with strategic design principles and tactical patterns.

## Strategic Design Improvements

### 1. Clarify Bounded Contexts
**Current**: Item types are grouped by source (datacore, missions, spviewer) but business domain boundaries are not explicit.

**Target**: Define explicit bounded contexts based on business capabilities:
- **Item Catalog Context**: Managing Star Citizen item definitions and properties
- **Data Extraction Context**: Transforming raw game data into usable formats
- **INI Management Context**: Updating Star Citizen configuration files
- **Validation Context**: Ensuring data integrity and consistency

**Actions**:
- Create explicit context mapping document
- Refactor directory structure to reflect bounded contexts
- Establish clear interfaces between contexts
- Document shared kernel and anti-corruption layers where needed

### 2. Establish Ubiquitous Language
**Current**: Technical terms mixed with domain terms (e.g., "csvFile", "descKeyMatch", "buildValue").

**Target**: Develop and enforce a shared language between developers and domain experts (Star Citizen players/data analysts).

**Key Domain Terms to Standardize**:
- `Item` → Represents any Star Citizen entity (ship, weapon, component, etc.)
- `ItemType` → Classification of items (Weapon, Shield, PowerPlant, etc.)
- `ItemIdentifier` → Unique identifier for an item (entity class + manufacturer)
- `ItemStats` → Collection of measurable properties (damage, health, radius, etc.)
- `DescriptionTemplate` → Format for how item stats appear in-game
- `DataSource` → Origin of item data (SCMDB, SPViewer, DataForge)
- `UpdateOperation` → Process of modifying game configuration files

**Actions**:
- Create ubiquitous language glossary
- Rename variables, methods, and classes to use domain terms
- Update documentation and comments
- Ensure code reflects domain concepts (e.g., `Item.Builder` instead of `stat()`)

### 3. Define Clear Context Boundaries
**Current**: Some leakage between contexts (e.g., extractors know about INI format specifics).

**Target**: Apply the Dependency Rule strictly - inner domains should not know about outer infrastructure.

**Actions**:
- Identify and eliminate outward dependencies in domain layer
- Create explicit interfaces (ports) for external interactions
- Implement adapters (adapters) for infrastructure concerns
- Ensure domain models have zero dependencies on infrastructure packages

## Tactical Design Improvements

### 1. Refactor Item Model as True Domain Entity
**Current**: Item configurations are data-driven but lack rich behavior.

**Target**: Transform item configurations into rich domain models with behavior.

**Actions**:
- Create `Item` entity class with:
  - Identity (ItemId)
  - Attributes (name, type, manufacturer, etc.)
  - Stats collection (value object)
  - Domain methods (`calculateDamagePerSecond()`, `isCompatibleWith()`, etc.)
- Move validation logic into entity (invariants)
- Replace anemic configuration objects with proper entities
- Make entities immutable where appropriate (using `readonly` and `init`)

### 2. Implement Proper Aggregate Roots
**Current**: No explicit aggregate boundaries; updates happen per-item-type.

**Target**: Define aggregates where consistency boundaries make sense.

**Analysis**: 
- Individual items likely don't need complex consistency rules with other items
- However, item types within a category (e.g., all bombs) might share validation rules
- Consider whether "ItemType" or "ItemCategory" should be aggregate roots

**Actions**:
- Identify true consistency requirements (e.g., "all missiles of same manufacturer must follow naming conventions")
- Define aggregate roots where business invariants span multiple entities
- Implement repository pattern for aggregate access
- Ensure all external access goes through aggregate roots

### 3. Enhance Value Objects
**Current**: Some value-like objects exist (stat builder output) but lack proper VO semantics.

**Target**: Identify and properly implement value objects.

**Candidate Value Objects**:
- `ItemId` (entity class + manufacturer combination)
- `ItemStats` (collection of named numeric values)
- `DamageProfile` (physical/energy/distortion components)
- `Coordinates` (position data)
- `Version` (game version numbers)
- `FilePath` (with validation)

**Actions**:
- Extract value objects from primitives
- Implement equality based on value, not reference
- Make immutable where appropriate
- Add validation in constructors
- Provide meaningful string representations
- Replace primitive obsession with proper VO types

### 4. Apply Repository Pattern Properly
**Current**: Registry loads configurations but mixes concerns.

**Target**: Implement true repository pattern for aggregate access.

**Actions**:
- Define repository interfaces in domain layer (e.g., `IItemRepository`)
- Move query methods to repositories
- Implement infrastructure-specific repositories
- Keep repositories focused on aggregate root access
- Add specification pattern for complex queries

### 5. Domain Events
**Current**: No explicit domain events; side effects happen inline.

**Target**: Use domain events to decouple side effects from domain logic.

**Candidate Events**:
- `ItemDataExtracted`
- `ItemValidationFailed`
- `DescriptionUpdated`
- `BackupCreated`
- `UpdateCompleted`

**Actions**:
- Identify domain events (things domain experts care about)
- Create event classes
- Implement event dispatching mechanism
- Move side effects (logging, notifications, etc.) to event handlers
- Ensure entities raise events when state changes

## Architectural Layering (Clean Architecture + DDD)

### Proposed Layer Structure:
```
src/
├── domain/                 # Pure domain model (no infrastructure deps)
│   ├── model/             # Entities, Value Objects, Domain Events
│   ├── repositories/      # Repository interfaces (ports)
│   ├── services/          # Domain services
│   └── specifications/    # Query specifications
│
├── application/           # Use cases, application services
│   ├── use-cases/         # Application-specific workflows
│   ├── dtos/              # Data transfer objects
│   └── exceptions/        # Application-specific exceptions
│
├── infrastructure/        # Technical implementations
│   ├── persistence/       # Repository implementations
│   ├── external/          # Third-party service integrations
│   ├── adapters/          # Adapters for external systems (ports to infrastructure)
│   └── shared/            # Cross-cutting concerns (logging, etc.)
│
└── presentation/          # Entry points, CLI, UI
    ├── cli/               # Command line interface
    └── controllers/       # HTTP controllers (if applicable)
```

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
1. Create ubiquitous language glossary
2. Define bounded context map
3. Set up proposed directory structure
4. Move existing domain concepts to new structure
5. Create basic repository interfaces

### Phase 2: Core Domain Model (Weeks 3-4)
1. Implement Item entity with proper identity
2. Create value objects (ItemId, ItemStats, etc.)
3. Implement domain events
4. Add domain services for complex business logic
5. Write unit tests for domain layer

### Phase 3: Application Layer (Weeks 5-6)
1. Define use cases for update workflows
2. Create application services
3. Implement DTOs for data transfer
4. Move orchestrator logic from bin/ to application layer
5. Add application-level validation

### Phase 4: Infrastructure Adaptation (Weeks 7-8)
1. Implement repository interfaces
2. Adapt existing extractors to infrastructure adapters
3. Move file I/O to persistence layer
4. Adapt CLI to presentation layer
5. Ensure all dependencies point inward

### Phase 5: Refinement & Validation (Weeks 9-10)
1. Run existing tests to ensure no regression
2. Add comprehensive domain-level tests
3. Review ubiquitous language usage
4. Validate bounded context boundaries
5. Performance optimization if needed

## Specific Code Improvements

### 1. Refactor Stat Builder to Proper Value Object
**Current**: `stat()` function returns mutable builder pattern.

**Improvement**:
```typescript
// domain/model/value-objects/ItemStats.ts
export class ItemStats {
  private readonly lines: string[];
  
  private constructor(lines: string[]) {
    this.lines = lines;
  }
  
  static create(): ItemStatsBuilder {
    return new ItemStatsBuilder();
  }
  
  addLine(label: string, value: string): ItemStats {
    const newLines = [...this.lines, `${label}: ${value}`];
    return new ItemStats(newLines);
  }
  
  section(title: string): ItemStats {
    const newLines = [...this.lines, '', title];
    return new ItemStats(newLines);
  }
  
  build(flavorText?: string): string {
    let result = this.lines.join('\n');
    if (flavorText) {
      result += `\n\n${flavorText}`;
    }
    return result;
  }
  
  toString(): string {
    return this.build();
  }
}

export class ItemStatsBuilder {
  private lines: string[] = [];
  
  line(label: string, value: string): this {
    this.lines.push(`${label}: ${value}`);
    return this;
  }
  
  // ... other methods return this for chaining
  
  build(): ItemStats {
    return new ItemStats([...this.lines]);
  }
}
```

### 2. Create Item Entity
**Current**: Configuration objects are anemic.

**Improvement**:
```typescript
// domain/model/entities/Item.ts
export class ItemId {
  constructor(
    readonly entityClass: string,
    readonly manufacturer: string
  ) {
    if (!entityClass || !manufacturer) {
      throw new Error('ItemId requires entityClass and manufacturer');
    }
  }
  
  equals(other: ItemId): boolean {
    return this.entityClass === other.entityClass && 
           this.manufacturer === other.manufacturer;
  }
  
  toString(): string {
    return `${this.entityClass}_${this.manufacturer}`;
  }
}

export class Item {
  constructor(
    readonly id: ItemId,
    readonly type: ItemType,
    readonly stats: ItemStats,
    readonly description?: string
  ) {
    // Invariant: bombs must have explosion radius
    if (type === ItemType.Bomb && !stats.hasExplosionRadius()) {
      throw new Error('Bomb items must have explosion radius');
    }
  }
  
  withStats(newStats: ItemStats): Item {
    return new Item(this.id, this.type, newStats, this.description);
  }
  
  // Domain methods
  isWeapon(): boolean {
    return [ItemType.Gun, ItemType.Missile, ItemType.Turret].includes(this.type);
  }
  
  getTotalDamage(): number {
    // Calculate from stats...
    return 0;
  }
}

// domain/model/enums/ItemType.ts
export enum ItemType {
  Bomb = 'Bomb',
  Cooler = 'Cooler',
  Emp = 'Emp',
  // ... other types
  PowerPlant = 'PowerPlant',
  QuantumDrive = 'QuantumDrive',
  Shield = 'Shield',
  WeaponAttachment = 'WeaponAttachment'
}
```

### 3. Define Repository Interface
**Current**: Direct file access in extractors.

**Improvement**:
```typescript
// domain/repositories/IItemRepository.ts
export interface IItemRepository {
  findById(id: ItemId): Promise<Item | null>;
  findByType(type: ItemType): Promise<Item[]>;
  save(item: Item): Promise<void>;
  delete(id: ItemId): Promise<void>;
  exists(id: ItemId): Promise<boolean>;
  
  // Query methods
  findByManufacturer(manufacturer: string): Promise<Item[]>;
  findWithStatsGreaterThan(statName: string, value: number): Promise<Item[]>;
}

// infrastructure/persistence/ItemFileRepository.ts
export class ItemFileRepository implements IItemRepository {
  constructor(
    private readonly fileReader: IFileReader,
    private readonly itemMapper: IItemMapper
  ) {}
  
  async findById(id: ItemId): Promise<Item | null> {
    const rawData = await this.fileReader.readItemData(id);
    if (!rawData) return null;
    return this.itemMapper.toDomain(rawData);
  }
  
  // ... other implementations
}
```

### 4. Apply Anti-Corruption Layer
**Current**: Extractors directly parse game format specifics.

**Improvement**:
```typescript
// application/services/ItemExtractorService.ts
export class ItemExtractorService {
  constructor(
    private readonly scmdbAdapter: IScmdbAdapter,
    private readonly spviewerAdapter: ISpviewerAdapter,
    private readonly itemRepository: IItemRepository
  ) {}
  
  async extractAndSaveItems(source: DataSource): Promise<void> {
    const rawItems = await this.extractRawItems(source);
    const domainItems = await this.convertToDomainItems(rawItems);
    await this.itemRepository.saveAll(domainItems);
  }
  
  private async extractRawItems(source: DataSource): Promise<RawItem[]> {
    switch (source) {
      case DataSource.SCMDB:
        return await this.scmdbAdapter.extract();
      case DataSource.SPViewer:
        return await this.spviewerAdapter.extract();
      case DataSource.DataForge:
        return await this.dataforgeAdapter.extract();
      default:
        throw new Error(`Unsupported data source: ${source}`);
    }
  }
}

// infrastructure/adapters/ScmdbAdapter.ts
export class ScmdbAdapter implements IScmdbAdapter {
  async extract(): Promise<RawItem[]> {
    // Knows about SCMDB format, but translates to domain-neutral RawItem
    const rawData = await this.fetchScmdbData();
    return this.parseScmdbFormat(rawData);
  }
}
```

## Expected Benefits

1. **Improved Maintainability**: Clear separation of concerns makes changes easier to isolate
2. **Better Alignment with Business**: Ubiquitous language ensures developers and domain experts communicate effectively
3. **Enhanced Testability**: Domain layer can be tested without infrastructure dependencies
4. **Increased Flexibility**: Infrastructure can change (different file formats, databases) without affecting core logic
5. **Reduced Coupling**: Dependencies flow inward, making the system more resilient to change
6. **Clearer Responsibilities**: Each layer has a single, well-defined purpose

## Risks and Mitigations

1. **Risk**: Over-engineering for a relatively simple tool
   **Mitigation**: Start with the most valuable bounded contexts and expand incrementally

2. **Risk**: Performance overhead from additional abstractions
   **Mitigation**: Measure performance and optimize only where needed; value objects and entities have minimal overhead

3. **Risk**: Team unfamiliarity with DDD concepts
   **Mitigation**: Provide training, start small, use code reviews to spread knowledge

4. **Risk**: Disruption to existing workflows
   **Mitigation**: Maintain backward compatibility during transition; use strangler fig pattern

## Success Metrics

1. **Domain Purity**: Percentage of domain classes with zero infrastructure dependencies
2. **Ubiquitous Language Adoption**: Reduction in technical jargon in domain code
3. **Test Coverage**: Increase in domain layer unit test coverage
4. **Change Impact**: Reduction in files modified for typical feature changes
5. **Onboarding Time**: Time for new developers to understand core domain concepts

## Next Steps

1. Review this plan with stakeholders
2. Create ubiquitous language glossary as first concrete deliverable
3. Set up proposed directory structure
4. Begin refactoring highest-value bounded context (likely item catalog)