/**
 * Test-hygiene gate — no `test/` file returns a literal `stderr`
 * (`task-145-replace-cli-test-helpers-fabricated-stderr-child-real`, `bug-070`, `dl-121` T1).
 *
 * Eight CLI suites wrapped the compiled CLI in an `execFileSync` + `catch` helper that, on the
 * success path, returned `{ status: 0, stdout, stderr: '' }`: `execFileSync` never captured the
 * child's stderr there, so the helper wrote the empty string itself, and every assertion that a
 * passing command was quiet on stderr compared that constant against itself. They now spawn through
 * `test/cli/helpers/spawn-cli.ts`, which reports what the child wrote on every path. This gate keeps
 * the shape from coming back: a `return` (or arrow-function body) whose value is an object literal
 * with a `stderr` property initialised to a string literal — any string literal, `''` being the one
 * that occurred — fails it, with the file and line.
 *
 * What it does NOT flag, by design: a variable initialised to such an object and not returned (a
 * `let` placeholder overwritten before use), and the pattern quoted in a comment or a string. It
 * reads the TypeScript AST, so both are invisible to it rather than special-cased.
 *
 * Deterministic by construction: a sorted directory walk over a fixed source tree and a pure AST walk
 * of each file — no clock, no network, no subprocess. The gate also checks it can fail: a source
 * carrying the old helper's shape is flagged, and the walk covers the CLI suites it exists for.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import * as ts from 'typescript';

const TEST_ROOT = join(__dirname, '..');

/** Every `*.ts` file under `test/`, in a stable (sorted, depth-first) order. */
function testSources(dir: string): readonly string[] {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
  const found: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...testSources(full));
    else if (entry.name.endsWith('.ts')) found.push(full);
  }
  return found;
}

/** Strip the wrappers that do not change what value is returned: `( … )`, `… as T`, `… satisfies T`, `<T>…`, `…!`. */
function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

/** The `stderr` property of an object literal, when its initialiser is a string literal. */
function literalStderr(expression: ts.Expression): ts.PropertyAssignment | undefined {
  const value = unwrap(expression);
  if (!ts.isObjectLiteralExpression(value)) return undefined;
  return value.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      property.name.getText() === 'stderr' &&
      (ts.isStringLiteral(property.initializer) || ts.isNoSubstitutionTemplateLiteral(property.initializer)),
  );
}

/**
 * Every place in `source` where a function returns an object literal whose `stderr` is a string
 * literal, as `line: text` (1-based line of the `stderr` property).
 */
function fabricatedStderrSites(fileName: string, source: string): readonly string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const sites: string[] = [];
  const visit = (node: ts.Node): void => {
    let returned: ts.Expression | undefined;
    if (ts.isReturnStatement(node)) returned = node.expression;
    else if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) returned = node.body;
    const property = returned === undefined ? undefined : literalStderr(returned);
    if (property !== undefined) {
      const { line } = file.getLineAndCharacterOfPosition(property.getStart(file));
      sites.push(`${line + 1}: ${property.getText(file)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return sites;
}

describe('no test/ file returns a literal `stderr` (bug-070)', () => {
  const files = testSources(TEST_ROOT);

  it('the walk covers the CLI suites the gate exists for', () => {
    const names = files.map((file) => relative(TEST_ROOT, file).split(sep).join('/'));
    expect(names).toEqual(
      expect.arrayContaining([
        'cli/helpers/spawn-cli.ts',
        'cli/fresh-init-transitions.test.ts',
        'cli/journey-0a.integration.test.ts',
        'cli/program.integration.test.ts',
      ]),
    );
  });

  it('flags the old helper’s shape, in every returning form, and nothing else', () => {
    const source = [
      'function a() { try { return run(); } catch { /* */ } return { status: 0, stdout, stderr: \'\' }; }',
      'const b = () => ({ status: 0, stderr: `` } as Run);',
      'function c() { return { status: 0, stderr: "fixed" }; }',
      "let placeholder: Run = { status: 0, stdout: '', stderr: '' };",
      "// return { status: 0, stderr: '' };",
      'function d() { return { status: 0, stderr: run.stderr }; }',
    ].join('\n');
    expect(fabricatedStderrSites('sample.ts', source)).toEqual([
      "1: stderr: ''",
      '2: stderr: ``',
      '3: stderr: "fixed"',
    ]);
  });

  it('no file under test/ returns one', () => {
    const offenders = files.flatMap((file) =>
      fabricatedStderrSites(file, readFileSync(file, 'utf-8')).map(
        (site) => `${relative(TEST_ROOT, file).split(sep).join('/')}:${site}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
