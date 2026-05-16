export function nameKeyToDescKey(nameKey: string): string {
  return nameKey.replace(/(item_)(Name|name|NAME)/i, (_m: string, prefix: string, word: string) => {
    if (word === 'name') return `${prefix}desc`;
    if (word === 'NAME') return `${prefix}DESC`;
    return `${prefix}Desc`;
  });
}

export function extractFlavorText(value: string): string {
  const parts = value.split('\\n\\n');
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].trim();
    if (!lastPart.startsWith('--')) return lastPart;
  }
  return '';
}
