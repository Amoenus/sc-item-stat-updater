const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/application/use-cases/run-datacore-scrape.ts');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  {
    search: `import { buildDataCoreContractGeneratorIntel } from '../../sources/datacore/contract-generator-intel-builder';`,
    replace: `import { buildDataCoreContractGeneratorIntel } from '../../sources/datacore/contract-generator-intel-builder';\nimport { buildDataCoreContractHaulingSummary } from '../../sources/datacore/contract-hauling-summary-builder';`
  },
  {
    search: `  DataCoreContractTemplateHaulingOrderRecord,`,
    replace: `  DataCoreContractHaulingSummaryRecord,\n  DataCoreContractTemplateHaulingOrderRecord,`
  },
  {
    search: `export interface DataCoreScrapeContractGeneratorIntelResult {\n  rows: number;\n  csvFile: string;\n}`,
    replace: `export interface DataCoreScrapeContractGeneratorIntelResult {\n  rows: number;\n  csvFile: string;\n}\n\nexport interface DataCoreScrapeContractHaulingSummaryResult {\n  rows: number;\n  csvFile: string;\n}`
  },
  {
    search: `  buildContractGeneratorIntel?: typeof buildDataCoreContractGeneratorIntel;`,
    replace: `  buildContractGeneratorIntel?: typeof buildDataCoreContractGeneratorIntel;\n  buildContractHaulingSummary?: typeof buildDataCoreContractHaulingSummary;`
  },
  {
    search: `  onContractGeneratorIntelExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;`,
    replace: `  onContractGeneratorIntelExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;\n  onContractHaulingSummaryExtracted?: (rows: number, csvFile: string, dryRun: boolean) => void;`
  },
  {
    search: `  contractGeneratorIntelResult: DataCoreScrapeContractGeneratorIntelResult;`,
    replace: `  contractGeneratorIntelResult: DataCoreScrapeContractGeneratorIntelResult;\n  contractHaulingSummaryResult: DataCoreScrapeContractHaulingSummaryResult;`
  },
  {
    search: `const CONTRACT_GENERATOR_INTEL_CSV_FILE = 'contract-generator-intel.datacore.csv';`,
    replace: `const CONTRACT_GENERATOR_INTEL_CSV_FILE = 'contract-generator-intel.datacore.csv';\nconst CONTRACT_HAULING_SUMMARY_CSV_FILE = 'contract-hauling-summary.datacore.csv';`
  },
  {
    search: `const CONTRACT_GENERATOR_INTEL_HEADERS = [\n  'Generator Class',\n  'Contract ID',\n  'Contract Debug Name',\n  'Template Class',\n  'Description Key',\n  'Description Key Role',\n  'Contract Intel',\n  'Time Limit',\n  'Contract Buy In Amount',\n  'Difficulty Profile Class',\n  'Record GUID',\n  'Record Path',\n];`,
    replace: `const CONTRACT_GENERATOR_INTEL_HEADERS = [\n  'Generator Class',\n  'Contract ID',\n  'Contract Debug Name',\n  'Template Class',\n  'Description Key',\n  'Description Key Role',\n  'Contract Intel',\n  'Time Limit',\n  'Contract Buy In Amount',\n  'Difficulty Profile Class',\n  'Record GUID',\n  'Record Path',\n];\nconst CONTRACT_HAULING_SUMMARY_HEADERS = [\n  'Generator Class',\n  'Contract ID',\n  'Contract Debug Name',\n  'Template Class',\n  'Description Key',\n  'Description Key Role',\n  'Hauling Summary',\n  'Record GUID',\n  'Record Path',\n];`
  },
  {
    search: `  const buildContractGeneratorIntel = options.buildContractGeneratorIntel ?? buildDataCoreContractGeneratorIntel;`,
    replace: `  const buildContractGeneratorIntel = options.buildContractGeneratorIntel ?? buildDataCoreContractGeneratorIntel;\n  const buildContractHaulingSummary = options.buildContractHaulingSummary ?? buildDataCoreContractHaulingSummary;`
  },
  {
    search: `  const contractGeneratorIntelResult = await writeContractGeneratorIntelCsv(contractGeneratorIntelRows, {\n    outputBase,\n    dryRun,\n  });\n  options.onContractGeneratorIntelExtracted?.(\n    contractGeneratorIntelResult.rows,\n    contractGeneratorIntelResult.csvFile,\n    dryRun,\n  );`,
    replace: `  const contractGeneratorIntelResult = await writeContractGeneratorIntelCsv(contractGeneratorIntelRows, {\n    outputBase,\n    dryRun,\n  });\n  options.onContractGeneratorIntelExtracted?.(\n    contractGeneratorIntelResult.rows,\n    contractGeneratorIntelResult.csvFile,\n    dryRun,\n  );\n\n  const contractHaulingSummaryRows = buildContractHaulingSummary(contractGeneratorRows, contractTemplateHaulingRows);\n  const contractHaulingSummaryResult = await writeContractHaulingSummaryCsv(contractHaulingSummaryRows, {\n    outputBase,\n    dryRun,\n  });\n  options.onContractHaulingSummaryExtracted?.(\n    contractHaulingSummaryResult.rows,\n    contractHaulingSummaryResult.csvFile,\n    dryRun,\n  );`
  },
  {
    search: `      [contractGeneratorIntelResult.csvFile, contractGeneratorIntelResult],`,
    replace: `      [contractGeneratorIntelResult.csvFile, contractGeneratorIntelResult],\n      [contractHaulingSummaryResult.csvFile, contractHaulingSummaryResult],`
  },
  {
    search: `    contractGeneratorIntelResult,`,
    replace: `    contractGeneratorIntelResult,\n    contractHaulingSummaryResult,`
  },
  {
    search: `async function writeContractGeneratorIntelCsv(`,
    replace: `async function writeContractHaulingSummaryCsv(\n  rows: DataCoreContractHaulingSummaryRecord[],\n  options: { outputBase: string; dryRun: boolean },\n): Promise<DataCoreScrapeContractHaulingSummaryResult> {\n  const csvFile = CONTRACT_HAULING_SUMMARY_CSV_FILE;\n  const filePath = path.join(options.outputBase, csvFile);\n\n  if (!options.dryRun) {\n    const records = rows.map((row) => [\n      row.generatorClass,\n      row.contractId,\n      row.contractDebugName,\n      row.templateClass,\n      row.descriptionKey,\n      row.descriptionKeyRole,\n      row.haulingSummary,\n      row.recordGuid,\n      row.recordPath,\n    ]);\n\n    const csvData = stringify(records, { header: true, columns: CONTRACT_HAULING_SUMMARY_HEADERS });\n    await fs.writeFile(filePath, csvData, 'utf8');\n  }\n\n  return { rows: rows.length, csvFile };\n}\n\nasync function writeContractGeneratorIntelCsv(`
  }
];

let changed = false;
for (const r of replacements) {
  if (content.includes(r.search)) {
    content = content.replace(r.search, r.replace);
    changed = true;
  } else {
    console.error("COULD NOT FIND:", r.search);
  }
}

if (changed) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Patched successfully.");
}
