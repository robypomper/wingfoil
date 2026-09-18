/**
 * Role → directive assignment support for `wingfoil directive assign` (task-051-directive-assign,
 * P3.2), built so `directive remove` (P3.3, task-052) and multi-directive assignment (P3.7, task-056)
 * reuse the same two pieces instead of re-deriving them:
 *
 * - {@link checkAssignable} — the pre-write validation: the role must be defined in `dna.yaml`
 *   (REQ-SYS-08, via task-034's binding resolver `isRoleDefined`/`UnknownRoleError` — never the
 *   approval-authority module, dl-033) and every directive id must exist on disk under
 *   `.wingfoil/directives/**` (built-in or custom alike: assignment binds by id and modifies no asset,
 *   dl-037/dl-030). Everything is checked before anything is written, so a request is applied whole
 *   or not at all.
 * - {@link checkUnreferenced} — the mirror-image pre-write validation for `directive remove` (P3.3,
 *   task-052): REQ-SEC-07 clause (b), refusing to remove a directive any role — or `global` — still
 *   binds, naming the referrer.
 * - {@link updateRoleAssignments} — the ONE read → edit → validate → write → commit path for
 *   `.wingfoil/roles.yaml`. It edits through the comment-preserving `setRoleAssignmentsInText`
 *   (`src/directives/roles-edit.ts`); only when that cannot apply does it consider a whole-file
 *   `dump`, and then only for a file with no comment to lose — otherwise it fails closed (bug-019's
 *   lesson: never a silent comment loss).
 *
 * Lives in `src/core` (not `src/directives`) for the same reason `directives-list.ts` does: it
 * operates on `DirectiveFile` (`./loaders`) and returns `CoreResult`s, so a `src/directives` home
 * would need a `core → directives → core` cycle.
 */
import { join } from 'path';

import { dump } from 'js-yaml';

import { isRoleDefined, UnknownRoleError } from '../dna/roles';
import type { DnaYaml } from '../dna/schema';
import { setRoleAssignmentsInText } from '../directives/roles-edit';
import { RolesYaml } from '../directives/schema';
import { commitPaths, documentExists, readDocument, writeDocument } from '../storage';
import { parseYaml, toValidationError, type ValidationError } from '../validation';

import type { DirectiveFile } from './loaders';
import type { CoreError, CoreResult } from './types';
import { coreErr, coreOk } from './types';

/** Root-relative location of the role → directive bindings file (spec-011). */
export const ROLES_YAML_PATH = '.wingfoil/roles.yaml';

/** The outcome of {@link updateRoleAssignments}: the role's list as it stands afterwards. */
export interface RoleAssignmentUpdate {
  /** `assignments.<role>` after the update (unchanged when nothing needed writing). */
  readonly assignments: readonly string[];
}

/**
 * Validate an assignment request before anything is written. The role is checked first (it is the
 * binding's target and the REQ-SYS-08 check), then each id in argument order; the first failure wins.
 *
 * @param dna - The loaded `dna.yaml` (its `team.roles` is the role catalogue).
 * @param directiveFiles - Every directive file on disk (`loadDirectives`).
 * @param role - The role to bind to.
 * @param ids - The directive ids to bind.
 * @returns `undefined` when assignable; otherwise a `NOT_FOUND` error carrying P3.2's exact message —
 *   `unknown role '<role>' (not defined in dna.yaml)` or `unknown directive: <id>`.
 */
export function checkAssignable(
  dna: DnaYaml,
  directiveFiles: readonly DirectiveFile[],
  role: string,
  ids: readonly string[],
): CoreError | undefined {
  if (!isRoleDefined(dna, role)) return { code: 'NOT_FOUND', message: new UnknownRoleError(role).message };
  const known = new Set(directiveFiles.map((file) => file.frontmatter.id));
  const unknown = ids.find((id) => !known.has(id));
  return unknown === undefined ? undefined : { code: 'NOT_FOUND', message: `unknown directive: ${unknown}` };
}

/**
 * REQ-SEC-07 clause (b) for the Directives surface — *"removal of a still-referenced custom asset is
 * rejected naming the referrer"* — assigned to `task-052-directive-remove` by
 * `dl-030-req-sec-07-referenced-asset-ownership` (`ready`, option (b)). The counterpart to
 * {@link checkAssignable}: that one guards a binding being *made*, this one guards an asset being
 * removed while a binding still names it. It lives here for the same reason, over the same
 * `roles.yaml` shape.
 *
 * `roles.yaml` binds by directive **`frontmatter.id`** (`src/directives/schema.ts`'s `RolesYaml`), so
 * the comparison is against the id, never the filename.
 *
 * Two referrer kinds, checked in this order:
 *
 * 1. A role whose own `assignments` entry names the id → P3.3's verbatim message
 *    `cannot remove '<id>': still assigned to role '<role>'`
 *    (`p3-directives/P3.3-directive-remove.feature`, "Error - removing a directive still referenced"
 *    — do not reword). When several roles bind it the **alphabetically first** is named: the message
 *    must be a pure function of the file's content, never of YAML mapping order (REQ-SYS-07), and
 *    `directives-list.ts` already walks role names in the same ascending order.
 * 2. `roles.yaml`'s `global` list, which binds the directive to *every* role
 *    (`spec-012-context-loader-relevance-filtering` §5) and is therefore the strongest reference of
 *    all. `[AUTHORING]`: P3.3 pins only the per-role wording, and a global binding cannot be phrased
 *    in it without naming a role the file does not name — so the message is
 *    `cannot remove '<id>': still assigned to every role via roles.yaml 'global'`. Recorded in
 *    `task-052-directive-remove`'s Execution Notes and raised for ratification, not assumed settled.
 *
 * A directive referenced from a *workflow* step is deliberately not checked: `src/workflow/schema.ts`
 * has no field that can reference a directive, so P3.3's "or workflow step" precondition is vacuous
 * today, and P4.9's workflow half of clause (b) has no owner in v0.2 per `dl-030`.
 *
 * @param rolesYaml - The loaded `roles.yaml`, or `undefined` when the project has none — "no bindings
 *   yet" (task-051/task-053's reading), not a failure.
 * @param id - The directive id about to be removed.
 * @returns `undefined` when nothing references it; otherwise a `CONFLICT` error (exit 1) carrying the
 *   message above. `CONFLICT` and not `VALIDATION`: the request is well-formed and the *state*
 *   refuses it — the same distinction `directiveCreate` draws for `directive already exists: <name>`,
 *   as against `requireCustomAsset`'s `VALIDATION` for a request inadmissible on its own terms.
 */
export function checkUnreferenced(rolesYaml: RolesYaml | undefined, id: string): CoreError | undefined {
  if (rolesYaml === undefined) return undefined;
  // `Object.entries` (own enumerable properties only) + an explicit ascending sort, never YAML
  // mapping order — REQ-SYS-07, and the same walk `directives-list.ts` uses.
  const [boundRole] = Object.entries(rolesYaml.assignments)
    .filter(([, ids]) => ids.includes(id))
    .map(([role]) => role)
    .sort((a, b) => (a < b ? -1 : 1));
  if (boundRole !== undefined) {
    return { code: 'CONFLICT', message: `cannot remove '${id}': still assigned to role '${boundRole}'` };
  }
  if (rolesYaml.global.includes(id)) {
    return { code: 'CONFLICT', message: `cannot remove '${id}': still assigned to every role via roles.yaml 'global'` };
  }
  return undefined;
}

function validationError(error: ValidationError): CoreResult<never> {
  return coreErr({ code: 'VALIDATION', message: error.message, details: { issues: error.issues } });
}

/** Parse and schema-check `roles.yaml` text, as a plain object (for re-serialization) plus its typed view. */
function parseRoles(text: string, filePath: string): CoreResult<{ raw: Record<string, unknown>; roles: RolesYaml }> {
  let raw: unknown;
  try {
    raw = parseYaml(text, filePath);
  } catch (error) {
    // `parseYaml` wraps every YAML syntax failure in a `ValidationError` and throws nothing else
    // (`src/validation/yaml.ts`).
    return validationError(error as ValidationError);
  }
  const parsed = RolesYaml.safeParse(raw);
  if (!parsed.success) return validationError(toValidationError(parsed.error, filePath));
  return coreOk({ raw: raw as Record<string, unknown>, roles: parsed.data });
}

/**
 * Apply `update` to `assignments.<role>` in `.wingfoil/roles.yaml` and commit the result as ONE commit
 * staging only that file.
 *
 * - A missing `roles.yaml` means "no bindings yet" (task-053's reading) and is created with a
 *   deterministic `dump` — there is nothing to preserve.
 * - An unchanged list is an idempotent success: nothing is written and no commit is made.
 * - The edit goes through `setRoleAssignmentsInText`, keeping every comment and unrelated line. When it
 *   cannot apply, a whole-file `dump` is used only if the file contains no `#` at all; otherwise the
 *   result is `CONFLICT` and the file is left untouched.
 * - No second schema pass on the output is needed: the in-place edit is only accepted when its
 *   re-parse equals the validated input with `assignments.<role>` replaced by a string list
 *   (`setRoleAssignmentsInText`'s self-check), and the whole-file `dump` serializes exactly that object.
 *
 * Commits through `commitPaths`, which since bug-027's fix (`git commit --only -- <paths>`) records
 * exactly the path it is given and leaves anything else staged untouched.
 *
 * @param root - Project root.
 * @param role - The role whose list is updated (already validated by the caller).
 * @param update - Pure function from the current list to the desired list.
 * @param message - The commit subject.
 * @returns The role's resulting list, with the commit when one was made.
 * @throws whatever `git` raises inside `commitPaths`.
 */
export function updateRoleAssignments(
  root: string,
  role: string,
  update: (current: readonly string[]) => readonly string[],
  message: string,
): CoreResult<RoleAssignmentUpdate> {
  const filePath = join(root, ROLES_YAML_PATH);
  const exists = documentExists(filePath);
  const text = exists ? readDocument(filePath) : '';

  let raw: Record<string, unknown> = { version: 1, assignments: {}, global: [] };
  let current: readonly string[] = [];
  if (exists) {
    const parsed = parseRoles(text, filePath);
    if (!parsed.ok) return parsed;
    raw = parsed.value.raw;
    current = Object.prototype.hasOwnProperty.call(parsed.value.roles.assignments, role)
      ? (parsed.value.roles.assignments[role] as string[])
      : [];
  }

  const next = update(current);
  if (JSON.stringify(next) === JSON.stringify(current)) return coreOk({ assignments: current });

  const wholeFile = (): string =>
    dump({ ...raw, assignments: { ...(raw.assignments as Record<string, unknown>), [role]: next } }, { lineWidth: -1 });
  let serialized = exists ? setRoleAssignmentsInText(text, role, next) : wholeFile();
  if (serialized === undefined) {
    if (text.includes('#')) {
      return coreErr({
        code: 'CONFLICT',
        message: `roles.yaml cannot be updated without discarding its comments; edit assignments.${role} by hand`,
      });
    }
    serialized = wholeFile();
  }

  writeDocument(filePath, serialized);
  const sha = commitPaths(root, [ROLES_YAML_PATH], message);
  return coreOk({ assignments: next }, { sha, message });
}
