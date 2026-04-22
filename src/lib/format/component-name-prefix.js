// @ts-check

const CLASS_PREFIXES = new Map([
  ['competition', 'Cmp'],
  ['civilian', 'Civ'],
  ['industrial', 'Ind'],
  ['military', 'Mil'],
  ['stealth', 'Sth'],
]);

/**
 * Builds an SP component display name with a class/size/grade prefix.
 * @param {Record<string,string>} row
 * @param {Record<string,string>[]} [lookupRows]
 * @returns {string}
 */
export function buildComponentDisplayName(row, lookupRows = []) {
  const name = String(row['Name'] ?? '').trim();
  if (!name) return '';

  const size = String(row['Size'] ?? '').trim();
  const grade = String(row['Grade'] ?? '').trim();
  const rawClass = String(row['Class'] ?? '').trim();
  const className = resolveClassName(rawClass, name, lookupRows);

  const prefixParts = [];
  if (className) prefixParts.push(className);
  if (size) prefixParts.push(size);
  if (grade) prefixParts.push(grade);

  return prefixParts.length > 0 ? `${prefixParts.join('/')} ${name}` : name;
}

/**
 * Resolves the component class name from the row or lookup table.
 * @param {string} rawClass
 * @param {string} name
 * @param {Record<string,string>[]} lookupRows
 * @returns {string}
 */
function resolveClassName(rawClass, name, lookupRows) {
  const className = String(rawClass ?? '').trim();
  if (className && className !== '-') {
    return resolveClassCode(className);
  }

  if (!name || lookupRows.length === 0) {
    return className === '-' ? '-' : '';
  }

  const lookupRow = findLookupRowByName(name, lookupRows);
  if (!lookupRow) {
    return className === '-' ? '-' : '';
  }

  const fallbackClass = String(lookupRow['Class'] ?? '').trim();
  if (!fallbackClass) {
    return className === '-' ? '-' : '';
  }

  return resolveClassCode(fallbackClass);
}

/**
 * Finds a matching lookup row by the component name.
 * @param {string} name
 * @param {Record<string,string>[]} lookupRows
 * @returns {Record<string,string> | null}
 */
function findLookupRowByName(name, lookupRows) {
  const normalized = String(name ?? '').trim();
  if (!normalized) return null;

  for (const row of lookupRows) {
    if (String(row['Name'] ?? '').trim() === normalized) {
      return row;
    }
  }

  for (const row of lookupRows) {
    const displayName = String(row['Localization Display Name'] ?? '').trim();
    if (!displayName) continue;
    if (displayName === normalized || displayName.endsWith(` ${normalized}`)) {
      return row;
    }
  }

  return null;
}

/**
 * Normalizes a class name to a short prefix.
 * @param {string} className
 * @returns {string}
 */
function resolveClassCode(className) {
  const normalized = String(className ?? '').trim();
  if (!normalized) return '';
  const key = normalized.toLowerCase();
  if (CLASS_PREFIXES.has(key)) {
    return CLASS_PREFIXES.get(key) ?? normalized;
  }
  if (normalized === '-') {
    return '-';
  }
  return normalized.replace(/\s+/g, ' ').trim();
}
