/**
 * ItemId value object representing the unique identifier for a Star Citizen item
 * Composed of entity class and manufacturer
 */
export class ItemId {
  constructor(
    readonly entityClass: string,
    readonly manufacturer: string
  ) {
    if (!entityClass || !entityClass.trim()) {
      throw new Error('ItemId requires a non-empty entityClass');
    }
    if (!manufacturer || !manufacturer.trim()) {
      throw new Error('ItemId requires a non-empty manufacturer');
    }
  }

  /**
   * Checks equality based on value, not reference
   */
  equals(other: ItemId): boolean {
    return this.entityClass === other.entityClass && 
           this.manufacturer === other.manufacturer;
  }

  /**
   * Returns string representation in format: EntityClass_Manufacturer
   */
  toString(): string {
    return `${this.entityClass}_${this.manufacturer}`;
  }

  /**
   * Creates ItemId from string representation
   */
  static fromString(idString: string): ItemId {
    const parts = idString.split('_');
    if (parts.length !== 2) {
      throw new Error(`Invalid ItemId format: ${idString}. Expected format: EntityClass_Manufacturer`);
    }
    return new ItemId(parts[0], parts[1]);
  }
}