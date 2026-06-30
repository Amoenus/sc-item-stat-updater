1. **Analyze `src/sources/scmdb/mema-parser.ts`**: The `buildMemaRows` function currently returns `Record<string, string>[]`, which is an untyped and unstructured way to handle SCMDB outputs.
2. **Define strict Zod Schema**: Create a Zod schema in `src/schema/mission/mema-rows.schema.ts` to strictly type the output of the Mema parser rows.
3. **Refactor `mema-parser.ts`**: Apply the newly created Zod schema and `.parse()` validation to `mema-parser.ts` so that it returns `MemaRowDTO[]` instead of `Record<string, string>[]`.
4. **Pre-commit Checks**: Run `npm run check` (Biome lint/format), `npm run typecheck` (`tsc --noEmit`), and `npm test` to verify everything is safe and structurally correct without changing output data.
