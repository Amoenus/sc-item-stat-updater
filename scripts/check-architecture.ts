import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const repoRoot = process.cwd();

type Rule = {
  description: string;
  files: string[];
  forbiddenResolvedPrefixes: string[];
};

const rules: Rule[] = [
  {
    description: 'Source modules must not import localization application or updater mutation code',
    files: listTypeScriptFiles(path.join(repoRoot, 'src', 'sources')),
    forbiddenResolvedPrefixes: [
      'src/localization/patch-application',
      'src/localization/ini-file',
      'src/localization/key-resolver',
      'src/lib/updater',
    ],
  },
];

const violations: string[] = [];

for (const rule of rules) {
  for (const file of rule.files) {
    for (const specifier of readImportSpecifiers(file)) {
      const resolved = resolveImport(file, specifier);
      if (!resolved) continue;

      if (rule.forbiddenResolvedPrefixes.some((prefix) => resolved === prefix || resolved.startsWith(`${prefix}/`))) {
        violations.push(`${formatPath(file)} imports "${specifier}" -> ${resolved}\n  ${rule.description}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Architecture guardrail failed:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log('Architecture guardrails passed.');
}

function listTypeScriptFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function readImportSpecifiers(file: string): string[] {
  const sourceText = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
      const moduleSpecifier = statement.moduleSpecifier;
      if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
        specifiers.push(moduleSpecifier.text);
      }
    }
  }

  return specifiers;
}

function resolveImport(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;

  const absolute = path.resolve(path.dirname(fromFile), specifier);
  const relative = formatPath(absolute).replace(/\.(js|ts)$/, '');
  return relative;
}

function formatPath(file: string): string {
  return path.relative(repoRoot, file).replaceAll(path.sep, '/');
}
