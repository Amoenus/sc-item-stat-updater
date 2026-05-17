const fs = require('fs');
const path = 'bin/regen-mining-locations.ts';
let content = fs.readFileSync(path, 'utf8');

// I also need to expose buildLocationQualityNotes to keep the summary log of elevated quality floors. Let's add that to the imports
content = content.replace(/import \{ buildMiningLocationRows \} from '\.\.\/src\/extractor\/mining-parser\.js';/, `import { buildLocationQualityNotes, buildMiningLocationRows } from '../src/extractor/mining-parser.js';`);

// Now add the summary back right before return { outPath ... }
const newSummaryStr = `  // Show any quality overrides found
  const qualityNotesByLocation = buildLocationQualityNotes(miningData.qualityDistribution);
  if (qualityNotesByLocation.size > 0) {
    log('\\n-- Elevated quality floors detected --');
    for (const [loc, notes] of qualityNotesByLocation) {
      log(\`  \${loc}: \${notes.join('; ')}\`);
    }
  }

  return { outPath`;

content = content.replace(/  return \{ outPath/g, newSummaryStr);

fs.writeFileSync(path, content);
