export function dataCoreManufacturerDisplayName(
  row: Record<string, string>,
  localizationValue: (key: string) => string,
): string {
  const nameKey = row['Manufacturer Name Key']?.trim();
  if (nameKey) {
    const displayName = localizationValue(nameKey);
    if (displayName) return displayName;
  }

  return row.Manufacturer ?? '';
}
