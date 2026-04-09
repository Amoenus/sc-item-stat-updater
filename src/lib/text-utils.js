function nameKeyToDescKey(nameKey) {
  return nameKey.replace(/(item_)(Name|name|NAME)/, (m, prefix, word) => {
    if (word === 'name') return prefix + 'desc';
    if (word === 'NAME') return prefix + 'DESC';
    return prefix + 'Desc';
  });
}

function extractFlavorText(value) {
  const parts = value.split('\\n\\n');
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].trim();
    if (!lastPart.startsWith('--')) return lastPart;
  }
  return '';
}

module.exports = { nameKeyToDescKey, extractFlavorText };
