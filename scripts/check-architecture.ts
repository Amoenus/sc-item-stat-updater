import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const repoRoot = process.cwd();

type Rule = {
  description: string;
  files: string[];
  forbiddenResolvedPrefixes: string[];
};

const sourceFiles = listTypeScriptFiles(path.join(repoRoot, 'src'));
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};
const listrRendererEntryPoint = 'src/presentation/task-list.ts';
const forbiddenTaskRendererPackages = ['cli-progress', 'ora', 'log-update', 'nanospinner'];

const rules: Rule[] = [
  {
    description: 'Source modules must not import localization application or updater mutation code',
    files: listTypeScriptFiles(path.join(repoRoot, 'src', 'sources')),
    forbiddenResolvedPrefixes: [
      'src/localization/patch-application',
      'src/localization/ini-file',
      'src/localization/key-resolver',
      'src/application/update/update-planning',
    ],
  },
];

const violations: string[] = [];

for (const packageName of forbiddenTaskRendererPackages) {
  if (hasPackageDependency(packageName)) {
    violations.push(
      `package.json depends on "${packageName}"\n  Listr2 is the first-class CLI task renderer; do not reintroduce parallel progress renderer dependencies.`,
    );
  }
}

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

for (const file of sourceFiles) {
  const relativeFile = formatPath(file);

  for (const specifier of readImportSpecifiers(file)) {
    if (forbiddenTaskRendererPackages.includes(specifier)) {
      violations.push(
        `${relativeFile} imports "${specifier}"\n  Listr2 is the first-class CLI task renderer; do not reintroduce legacy progress renderers.`,
      );
    }

    if (specifier === 'listr2' && !relativeFile.startsWith('src/presentation/')) {
      violations.push(
        `${relativeFile} imports "listr2"\n  Listr2 belongs to the presentation layer; application and source code should expose staged plans/callbacks instead.`,
      );
    }
  }

  if (relativeFile !== listrRendererEntryPoint) {
    for (const constructorName of readNewExpressionNames(file)) {
      if (constructorName === 'Listr' || constructorName === 'ListrLogger') {
        violations.push(
          `${relativeFile} constructs ${constructorName}\n  Construct the top-level Listr renderer only in ${listrRendererEntryPoint}; nested orchestration should use task.newListr().`,
        );
      }
    }
  }

  if (relativeFile.startsWith('src/presentation/')) {
    for (const violation of readChainedNewListrRunLocations(file)) {
      violations.push(
        `${relativeFile}${violation} calls task.newListr(...).run()\n  Nested Listr task lists must be returned to the parent task; running them directly can hijack the shared renderer output.`,
      );
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

function readNewExpressionNames(file: string): string[] {
  const sourceText = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  const names: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isNewExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression)) {
        names.push(expression.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return names;
}

function readChainedNewListrRunLocations(file: string): string[] {
  const sourceText = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  const locations: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const propertyAccess = node.expression;
      if (propertyAccess.name.text === 'run' && isNewListrCall(unwrapExpression(propertyAccess.expression))) {
        const position = source.getLineAndCharacterOfPosition(node.getStart(source));
        locations.push(`:${position.line + 1}:${position.character + 1}`);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return locations;
}

function isNewListrCall(node: ts.Expression): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'newListr'
  );
}

function unwrapExpression(node: ts.Expression): ts.Expression {
  let current = node;
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current)) {
    current = current.expression;
  }
  return current;
}

function resolveImport(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;

  const absolute = path.resolve(path.dirname(fromFile), specifier);
  const relative = formatPath(absolute).replace(/\.(js|ts)$/, '');
  return relative;
}

function hasPackageDependency(packageName: string): boolean {
  return Boolean(
    packageJson.dependencies?.[packageName] ||
      packageJson.devDependencies?.[packageName] ||
      packageJson.optionalDependencies?.[packageName],
  );
}

function formatPath(file: string): string {
  return path.relative(repoRoot, file).replaceAll(path.sep, '/');
}
