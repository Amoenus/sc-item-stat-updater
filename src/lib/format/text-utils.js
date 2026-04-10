export function nameKeyToDescKey(nameKey) {
  return nameKey.replace(/(item_)(Name|name|NAME)/i, (_m, prefix, word) => {
    if (word === 'name') return `${prefix}desc`;
    if (word === 'NAME') return `${prefix}DESC`;
    return `${prefix}Desc`;
  });
}

export function extractFlavorText(value) {
  const parts = value.split('\\n\\n');
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].trim();
    if (!lastPart.startsWith('--')) return lastPart;
  }
  return '';
}
