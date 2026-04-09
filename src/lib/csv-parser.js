const { parse } = require('csv-parse/sync');

function parseCSV(text) {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
  });
}

module.exports = { parseCSV };
