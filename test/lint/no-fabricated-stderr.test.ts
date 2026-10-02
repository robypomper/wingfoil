/**
 * Test-hygiene gate — no `test/` file returns a spawn result with a fixed `stderr`
 * (`task-145-replace-cli-test-helpers-fabricated-stderr-child-real`, `bug-070`, `dl-121` T1).
 *
 * Eight CLI suites wrapped the compiled CLI in an `execFileSync` + `catch` helper that, on the
 * success path, returned `{ status: 0, stdout, stderr: '' }`: `execFileSync` never captured the
 * child's stderr there, so the helper wrote the empty string itself, and every assertion that a
 * passing command was quiet on stderr compared that constant against itself. They now spawn through
 * `test/cli/helpers/spawn-cli.ts`, which reports what the child wrote on every path. This gate keeps
 * the shape from coming back. It fails, with the file and line, on a **spawn result** — an object
 * literal carrying a `status` key — that a `return` (or an arrow-function body) yields with a
 * **fixed** `stderr`: a string literal (any, `''` being the one that occurred), or a `const` that
 * resolves to one. The key may be quoted or shorthand; the object may be returned directly, through
 * either branch of a ternary, or through a `const` that names it.
 *
 * What it does NOT flag, by design: an object with no `status` key (a mock body such as
 * `mockImplementation(() => ({ stdout, stderr: '' }))` stands in for a process rather than reporting
 * one); a variable initialised to such an object and not returned (a `let` placeholder overwritten
 * before use); and the pattern quoted in a comment or a string — it reads the TypeScript AST, so
 * those are invisible to it rather than special-cased.
 *
 * Known limits — forms it does not see: a `stderr` produced
 * by a call (`String()`), a `status` that arrives only through a spread (`{ ...base, stderr: '' }`),
 * an object passed through a call (`Promise.resolve({ … })`), a `let`/`var` that is never reassigned,
 * and a `const` imported from another module. Name resolution is lexical within the file (block and
 * file statements, function parameters); a `catch` or loop binding does not shadow in it.
 *
 * Deterministic by construction: a sorted directory walk over a fixed source tree and a pure AST walk
 * of each file — no clock, no network, no subprocess. The gate also checks it can fail: sources
 * carrying each flagged form are flagged, each exempt form is not, and the walk covers the CLI suites
 * it exists for.
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

/** The name an object-literal property is keyed by, quoted or not; `undefined` for a computed key. */
function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
  return undefined;
}

function isStringLiteralExpression(expression: ts.Expression): boolean {
  return ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression);
}

/** The names a variable declaration binds, destructuring included. */
function boundNames(name: ts.BindingName): readonly string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) => (ts.isOmittedExpression(element) ? [] : boundNames(element.name)));
}

/**
 * Resolve `identifier` lexically to the `const` declaration that binds it, and return that
 * declaration's initialiser. `undefined` when the nearest binding is anything else — a parameter, a
 * `let`/`var`, a destructuring — or when none is found in the file.
 *
 * Only the binding forms that can hold a fixed value are followed: block and file statements, and
 * function parameters (which shadow). A name shadowed by a `catch` variable or a loop binding is
 * resolved past it — a known limit, stated in the module doc.
 */
function resolveConst(identifier: ts.Identifier): ts.Expression | undefined {
  for (let scope: ts.Node | undefined = identifier.parent; scope !== undefined; scope = scope.parent) {
    if (ts.isFunctionLike(scope) && scope.parameters.some((parameter) => boundNames(parameter.name).includes(identifier.text))) {
      return undefined;
    }
    if (!ts.isBlock(scope) && !ts.isSourceFile(scope)) continue;
    for (const statement of scope.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      const list = statement.declarationList;
      for (const declaration of list.declarations) {
        if (!boundNames(declaration.name).includes(identifier.text)) continue;
        const isConst = (list.flags & ts.NodeFlags.Const) !== 0;
        return isConst && ts.isIdentifier(declaration.name) ? declaration.initializer : undefined;
      }
    }
  }
  return undefined;
}

/** Whether `expression` is a fixed string: a string literal, or a `const` that resolves to one. */
function isFixedString(expression: ts.Expression): boolean {
  const value = unwrap(expression);
  if (isStringLiteralExpression(value)) return true;
  if (!ts.isIdentifier(value)) return false;
  const initializer = resolveConst(value);
  return initializer !== undefined && isStringLiteralExpression(unwrap(initializer));
}

/**
 * The object literals `expression` can evaluate to: itself, both branches of a ternary, and the
 * initialiser of a `const` it names — followed to a fixed depth, so a cycle cannot loop.
 */
function returnedObjects(expression: ts.Expression, depth = 0): readonly ts.ObjectLiteralExpression[] {
  if (depth > 8) return [];
  const value = unwrap(expression);
  if (ts.isObjectLiteralExpression(value)) return [value];
  if (ts.isConditionalExpression(value)) {
    return [...returnedObjects(value.whenTrue, depth + 1), ...returnedObjects(value.whenFalse, depth + 1)];
  }
  if (ts.isIdentifier(value)) {
    const initializer = resolveConst(value);
    return initializer === undefined ? [] : returnedObjects(initializer, depth + 1);
  }
  return [];
}

/**
 * The `stderr` property of a returned spawn result whose value is fixed. A spawn result is an object
 * literal that also carries a `status` key: that is the shape every CLI helper returns, and requiring
 * it keeps a mock body such as `mockImplementation(() => ({ stdout, stderr: '' }))` — which stands in
 * for a process rather than reporting one — out of the gate.
 */
function fixedStderr(object: ts.ObjectLiteralExpression): ts.ObjectLiteralElementLike | undefined {
  const named = (property: ts.ObjectLiteralElementLike, key: string): boolean =>
    (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && propertyName(property.name) === key;
  if (!object.properties.some((property) => named(property, 'status'))) return undefined;
  return object.properties.find((property) => {
    if (!named(property, 'stderr')) return false;
    if (ts.isPropertyAssignment(property)) return isFixedString(property.initializer);
    return ts.isShorthandPropertyAssignment(property) && isFixedString(property.name);
  });
}

/**
 * Every place in `source` where a function returns a spawn result whose `stderr` is fixed, as
 * `line: text` (1-based line of the `stderr` property).
 */
function fabricatedStderrSites(fileName: string, source: string): readonly string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const sites: string[] = [];
  const visit = (node: ts.Node): void => {
    let returned: ts.Expression | undefined;
    if (ts.isReturnStatement(node)) returned = node.expression;
    else if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) returned = node.body;
    for (const object of returned === undefined ? [] : returnedObjects(returned)) {
      const property = fixedStderr(object);
      if (property === undefined) continue;
      const { line } = file.getLineAndCharacterOfPosition(property.getStart(file));
      sites.push(`${line + 1}: ${property.getText(file)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return sites;
}

describe('no test/ file returns a spawn result with a fixed `stderr` (bug-070)', () => {
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

  it('flags the old helper’s shape, in every returning form it can take', () => {
    const source = [
      'function a() { try { return run(); } catch { /* */ } return { status: 0, stdout, stderr: \'\' }; }',
      'const b = () => ({ status: 0, stderr: `` } as Run);',
      'function c() { return { status: 0, stderr: "fixed" }; }',
      "function d() { return { status: 0, 'stderr': '' }; }",
      "function e(ok: boolean) { return ok ? { status: 0, stdout, stderr: '' } : failed(); }",
      "const EMPTY = ''; function f() { return { status: 0, stdout, stderr: EMPTY }; }",
      "function g() { const stderr = ''; return { status: 0, stdout, stderr }; }",
      "function h() { const r = { status: 0, stdout, stderr: '' }; return r; }",
    ].join('\n');
    expect(fabricatedStderrSites('sample.ts', source)).toEqual([
      "1: stderr: ''",
      '2: stderr: ``',
      '3: stderr: "fixed"',
      "4: 'stderr': ''",
      "5: stderr: ''",
      '6: stderr: EMPTY',
      '7: stderr',
      "8: stderr: ''",
    ]);
  });

  it('flags nothing that is not a returned spawn result with a fixed stderr', () => {
    const source = [
      "let placeholder: Run = { status: 0, stdout: '', stderr: '' };",
      "// return { status: 0, stderr: '' };",
      'function d() { return { status: 0, stderr: run.stderr }; }',
      "spy.mockImplementation(() => ({ stdout: 'x', stderr: '' }));",
      "const stderr = ''; function f(stderr: string) { return { status: 0, stderr }; }",
      "function g() { let stderr = ''; stderr = read(); return { status: 0, stderr }; }",
      'function h() { const { stderr } = spawn(); return { status: 0, stderr }; }',
    ].join('\n');
    expect(fabricatedStderrSites('sample.ts', source)).toEqual([]);
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
