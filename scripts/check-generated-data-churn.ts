import { assertNoGeneratedDataChurn } from '../src/application/guards/generated-data-churn-guard';

try {
  await assertNoGeneratedDataChurn(process.cwd());
  console.log('Generated-data churn guard passed: no changes under csv/ or root global.ini.');
  console.log('Use this after dry-run, help, smoke, or other no-write verification commands.');
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(error.message);
  process.exit(1);
}
