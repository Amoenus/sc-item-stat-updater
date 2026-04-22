const TAG_WRAPPER = (tag) => `<EM4>${tag}</EM4>`;

export function getNamePrefix(value) {
  const str = String(value);
  const bracketMatch = str.match(/^\[(IR|CS|EM)\]\s*/);
  if (bracketMatch) return bracketMatch[0];
  const slashPrefixMatch = str.match(/^(?:Civ|Mil|Ind|Cmp|Sth|-[^ /]*)?(?:\/[^ ]+)+ +/);
  return slashPrefixMatch ? slashPrefixMatch[0] : '';
}

export function preserveNamePrefix(oldValue, newValue) {
  const desiredPrefix = getNamePrefix(newValue);
  if (!desiredPrefix) return String(newValue);

  const original = String(oldValue).trim();
  if (!original) return String(newValue);

  const currentPrefix = getNamePrefix(original);
  if (currentPrefix === desiredPrefix) return original;

  const body = currentPrefix ? original.slice(currentPrefix.length).trimStart() : original;
  if (!body) return String(newValue);

  return `${desiredPrefix}${body}`;
}

export function ensurePrefix(text, prefix, options = {}) {
  const separator = options.separator ?? ' ';
  const trimmed = String(text).trim();
  const normalized = String(prefix).trim();
  if (!normalized) return trimmed;
  if (!trimmed) return `${normalized}`;
  if (trimmed.startsWith(`${normalized}${separator}`) || trimmed === normalized) return text;
  return `${normalized}${separator}${trimmed}`;
}

export function ensureSuffix(text, suffix, options = {}) {
  const separator = options.separator ?? ' ';
  const trimmed = String(text).trim();
  const normalized = String(suffix).trim();
  if (!normalized) return trimmed;
  if (!trimmed) return `${normalized}`;
  if (trimmed.endsWith(`${separator}${normalized}`) || trimmed === normalized) return text;
  return `${trimmed}${separator}${normalized}`;
}

export function normalizeTagSuffix(text, tag, options = {}) {
  const wrapper = options.wrapper ?? TAG_WRAPPER;
  const tagRegex = options.tagRegex ?? new RegExp(`\\s*${escapeRegExp(wrapper(tag))}$`, 'i');
  const cleaned = String(text).replace(tagRegex, '').trim();
  if (!tag) return cleaned;
  return ensureSuffix(cleaned, wrapper(tag), { separator: ' ' });
}

export function appendSection(text, sectionHeadingRegex, newSection) {
  const original = String(text);
  if (!newSection) {
    return original.replace(sectionHeadingRegex, '').trimEnd();
  }

  if (sectionHeadingRegex.test(original)) {
    return original.replace(sectionHeadingRegex, newSection);
  }

  return `${original.trim()}${newSection}`;
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
