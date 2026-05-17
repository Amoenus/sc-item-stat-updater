const fs = require('fs');
const path = 'src/extractor/mining-parser.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/locRows\.sort\(\(a, b\) => a\['Location Name'\]\.localeCompare\(b\['Location Name'\]\)\);/g, `locRows.sort((a, b) => String(a['Location Name']).localeCompare(String(b['Location Name'])));`);

fs.writeFileSync(path, content);
