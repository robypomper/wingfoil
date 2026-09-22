/**
 * task-087-fix-types-node-floor-pin (`bug-049`, `adr-010-node-22-runtime-floor`) — the `@types/node`
 * major must be the major of the `engines.node` floor.
 *
 * `@types/node` was pinned `^18.19.130` deliberately, not incidentally: `task-001-nodejs-typescript-scaffold`
 * recorded the reason in its Execution Notes — "matching the `engines.node >=18.0.0` floor, so
 * stub/future code doesn't typecheck against Node APIs newer than the minimum supported runtime". The
 * rule there is *the minimum supported runtime*; `18` was only the number that rule produced at the
 * time. `adr-010-node-22-runtime-floor` moved the floor to `>=22.12.0` and
 * `task-074-fix-engines-node-floor` applied it to `package.json`, at which point the pin stopped
 * expressing the rule it was set to express — nothing in the repository connected the two, which is
 * `bug-049`.
 *
 * This file is that connection. It pins the relationship rather than either number, so the next floor
 * change fails here instead of silently leaving the type surface behind.
 *
 * **Both directions, deliberately.** The assertion is an equality, not "at least". A `@types/node`
 * major *above* the floor is as wrong as one below: it describes APIs the declared runtime does not
 * have, and `tsc` would accept code that cannot run on the floor the package advertises. That is the
 * two-directional failure `bug-049` describes, and it is the shape `bug-047` argues for on the
 * neighbouring `engines` guard (its option 1 — pin from both sides) applied here.
 *
 * **Deterministic and offline by construction** (`determinism`, REQ-SYS-07): it reads `package.json`
 * and the installed `node_modules/@types/node/package.json` and runs no subprocess, reaches no
 * registry, and reads no clock. Both range forms are parsed by small readers that **throw** on syntax
 * they do not understand, so a future range this file cannot read fails loudly instead of being
 * silently skipped — the same "loud over clever" choice `task-074`'s engines evaluator made.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');

interface Manifest {
  readonly engines?: { readonly node?: string };
  readonly devDependencies?: Readonly<Record<string, string>>;
}

const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as Manifest;

/** `>=X.Y.Z` — the only `engines.node` form this repository declares (`adr-010`: `>=22.12.0`). */
const ENGINES_FLOOR = /^>=(\d+)\.(\d+)\.(\d+)$/;

/** `^X.Y.Z` — the only form the `@types/node` pin has ever taken (`task-001`: `^18.19.130`). */
const CARET_RANGE = /^\^(\d+)\.(\d+)\.(\d+)$/;

/** The major of `engines.node`'s declared floor. Throws on any range form it does not recognise. */
function declaredFloorMajor(): number {
  const range = manifest.engines?.node;
  if (range === undefined) throw new Error('package.json declares no engines.node');
  const match = ENGINES_FLOOR.exec(range);
  if (match === null) {
    throw new Error(
      `engines.node is "${range}", which this guard cannot read. It understands ">=X.Y.Z" only; ` +
        'if the floor is now expressed differently, teach this file that form rather than removing the check.',
    );
  }
  return Number(match[1]);
}

/** The major of the `@types/node` devDependency range. Throws on any form it does not recognise. */
function declaredTypesMajor(): number {
  const range = manifest.devDependencies?.['@types/node'];
  if (range === undefined) throw new Error('package.json declares no @types/node devDependency');
  const match = CARET_RANGE.exec(range);
  if (match === null) {
    throw new Error(
      `@types/node is pinned "${range}", which this guard cannot read. It understands "^X.Y.Z" only; ` +
        'if the pin form changes, teach this file that form rather than removing the check.',
    );
  }
  return Number(match[1]);
}

/** The version of the `@types/node` actually installed in this tree. */
function installedTypesVersion(): string {
  const installed = JSON.parse(
    readFileSync(join(REPO_ROOT, 'node_modules', '@types', 'node', 'package.json'), 'utf-8'),
  ) as { readonly version?: string };
  if (installed.version === undefined) throw new Error('installed @types/node declares no version');
  return installed.version;
}

describe('@types/node vs the declared Node floor (task-087, bug-049)', () => {
  it('reads a floor and a pin at all — the guard cannot pass by finding nothing', () => {
    // Without this, every assertion below would be vacuously satisfiable by a malformed manifest that
    // made both readers return the same accidental value.
    expect(manifest.engines?.node).toMatch(ENGINES_FLOOR);
    expect(manifest.devDependencies?.['@types/node']).toMatch(CARET_RANGE);
    expect(declaredFloorMajor()).toBeGreaterThan(0);
  });

  it('pins @types/node to the major of the engines.node floor — neither below it nor above it', () => {
    // Below: the compiler rejects APIs the supported runtime has (task-001's stated guard, inverted by
    // a floor move). Above: the compiler accepts APIs the declared floor does not have.
    expect({ typesMajor: declaredTypesMajor(), floorMajor: declaredFloorMajor() }).toEqual({
      typesMajor: declaredFloorMajor(),
      floorMajor: declaredFloorMajor(),
    });
  });

  it('has that same major actually installed, not merely declared', () => {
    // The declared range and the resolved tree are two different facts; bug-049 was raised by reading
    // all three copies (manifest, lock, installed) rather than one.
    const installedMajor = Number(installedTypesVersion().split('.')[0]);
    expect(installedMajor).toBe(declaredFloorMajor());
  });
});
