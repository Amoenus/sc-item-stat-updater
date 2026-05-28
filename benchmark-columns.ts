import { performance } from 'perf_hooks';

function validateColumnsOld(rows: Record<string, string>[], requiredColumns: string[] | undefined) {
  if (!requiredColumns || rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  const missing = requiredColumns.filter((col: string) => !columns.includes(col));
  if (missing.length > 0) {
    // throw new Error(`schema mismatch`);
  }
}

function validateColumnsNew(rows: Record<string, string>[], requiredColumns: string[] | undefined) {
  if (!requiredColumns || rows.length === 0) return;
  const columns = new Set(Object.keys(rows[0]));
  const missing = requiredColumns.filter((col: string) => !columns.has(col));
  if (missing.length > 0) {
    // throw new Error(`schema mismatch`);
  }
}

const rows = [{} as Record<string, string>];
for (let i = 0; i < 1000; i++) {
  rows[0][`col${i}`] = 'value';
}
const requiredColumns = [];
for (let i = 0; i < 500; i++) {
  requiredColumns.push(`col${i * 2}`);
}

const iterations = 10000;

const startOld = performance.now();
for (let i = 0; i < iterations; i++) {
  validateColumnsOld(rows, requiredColumns);
}
const endOld = performance.now();
console.log(`Old: ${endOld - startOld}ms`);

const startNew = performance.now();
for (let i = 0; i < iterations; i++) {
  validateColumnsNew(rows, requiredColumns);
}
const endNew = performance.now();
console.log(`New: ${endNew - startNew}ms`);
