/**
 * `wingfoil directives list` — the listing behind the `directives.directivesList` operation
 * (P3.4 / US-4-04, BDD `p3-directives/P3.4-directives-list.feature`; spec-006-core-domain-api §3
 * pins the operation's name and both surfaces). task-053-directives-list.
 *
 * **What this is.** An *inventory* of the directive files installed under `.wingfoil/directives/**`,
 * each annotated with the roles that name it in `.wingfoil/roles.yaml`. It is deliberately NOT the
 * per-role *resolved* set that {@link resolveRoleDirectives} (`./context.ts`) produces for an agent
 * execution context; the two answer different questions and are kept separate:
 *
 * - `resolveRoleDirectives` answers "which rules must role R obey", so it deduplicates by directive
 *   id and returns one file per id (`spec-012-context-loader-relevance-filtering` §5).
 * - This function answers "which directive files exist here, and who is bound to them" (P3.4: "so I
 *   manage rules with visibility"), so it **never deduplicates**. When a built-in and a custom file
 *   share an id, both appear, each with its own `path`. `spec-012` §5, as amended by
 *   `dl-037-builtin-vs-custom-directive-precedence` (option B.1), requires that a shadowed directive
 *   be "reported, never silently dropped"; a listing that hid one would reproduce exactly the defect
 *   dl-037 was raised about, in the one command whose purpose is directive visibility.
 *
 * **Warnings** (`dl-042-directives-list-output-contract` A + D, task-055-auto-load-directives-by-role).
 * The payload is {@link DirectiveListing} — `entries` plus a `warnings` channel — so the two things a
 * reader cannot see in the inventory are said out loud: which of two same-id files is in force, and
 * whether a role is bound at all. Neither is computed here. Without a role filter the warnings are
 * {@link selectDirectivesById}'s shadow warnings over every file; with `--role` they are exactly
 * {@link resolveRoleDirectives}' warnings for that role (no-assignments, dangling binding, shadowed
 * ids). Both live in `./context.ts`, so the precedence rule the listing reports is the one context
 * assembly applies — it is never implemented twice.
 *
 * **Placement.** This lives in `src/core` rather than `src/directives` for the same reason
 * `resolveRoleDirectives` does: the {@link DirectiveFile} shape it operates on is declared in
 * `./loaders.ts`, so putting it under `src/directives` would create a `core → directives → core`
 * import cycle. `src/directives` keeps owning the pillar's own schemas (REQ-SYS-02).
 *
 * **Determinism** (REQ-SYS-07): the output is a pure function of the two files on disk. Entry order
 * is `loadDirectives`'s own lexicographic path order; the per-directive `roles` array is built by
 * walking `assignments`' role names in sorted order, never in YAML mapping order.
 */
import { join } from 'path';

import { documentExists } from '../storage';
import type { DirectiveFrontmatter, RolesYaml } from '../directives/schema';

import { resolveRoleDirectives, selectDirectivesById } from './context';
import { loadDirectives, loadRolesYaml, type DirectiveFile } from './loaders';

/**
 * {@link DirectiveListEntry.assignment} for a directive no role names and `roles.yaml`'s `global`
 * list does not carry. The exact wording is the BDD's own: P3.4's "each directive shows its assigned
 * roles (or `unassigned`)".
 */
export const UNASSIGNED_ASSIGNMENT = 'unassigned';

/**
 * {@link DirectiveListEntry.assignment} prefix for a directive in `roles.yaml`'s `global` list.
 * Phrased from `spec-012-context-loader-relevance-filtering` §5's own description of that list — the
 * "global directives applied to all roles" — because such a directive is bound to *every* role and so
 * is neither enumerable as a role list nor, in any sense, `unassigned`.
 */
export const GLOBAL_ASSIGNMENT = 'global (all roles)';

/** One directive in the listing: the file, and who is bound to it. */
export interface DirectiveListEntry {
  /** Root-relative path as `loadDirectives` records it (`directives/<built-in|custom>/<name>.md`). */
  readonly path: string;
  /** The file's validated frontmatter, unchanged — carries `id`, `name`, `kind`, `title`, `tags`, `ref`. */
  readonly frontmatter: DirectiveFrontmatter;
  /**
   * Role names whose `roles.yaml` `assignments` entry names this directive's **`frontmatter.id`**
   * (never its `name` — `assignments` values are ids, per `src/directives/schema.ts`'s `RolesYaml`),
   * ascending. Empty for a directive nothing binds *and* for a `global` one, whose binding is carried
   * by {@link global} instead — listing every role name for a global directive would require reading
   * `dna.yaml`'s role catalogue, a different pillar (REQ-SYS-02), and would still misreport a role
   * that has no `assignments` entry of its own.
   */
  readonly roles: readonly string[];
  /** `true` when `roles.yaml`'s `global` list names this directive's id — it applies to every role. */
  readonly global: boolean;
  /**
   * The two fields above rendered as one human-readable string, so P3.4's `unassigned` wording is
   * present in the payload itself and reads identically under `--format console`, `json` and `yaml`.
   * (`--format console` renders the payload as pretty-printed JSON today; `renderSuccess`,
   * `src/cli/output.ts`, states that a command-specific console rendering needs a command-specific
   * spec, and none exists for this command.) Never display-only: `roles`/`global` carry the same
   * fact structurally for machine consumers.
   */
  readonly assignment: string;
}

/**
 * The `directives list` payload (`dl-042-directives-list-output-contract`): the inventory and the
 * operator diagnostics about it, side by side. `[AUTHORING]` like {@link DirectiveListEntry} (dl-042 C).
 */
export interface DirectiveListing {
  /** One entry per directive file on disk — never deduplicated (see the module doc comment). */
  readonly entries: readonly DirectiveListEntry[];
  /** Shadowed ids (always); no-assignments and dangling-binding warnings (with a role filter). Fixed
   * order, empty when there is nothing to report. */
  readonly warnings: readonly string[];
}

/** `roles.yaml` as seen when the file is absent: nothing bound, no globals. */
const NO_BINDINGS: RolesYaml = { assignments: {}, global: [] };

/**
 * Invert `roles.yaml`'s `assignments` (role → directive ids) into directive id → role names.
 *
 * A `Map` rather than a plain object on purpose: the keys are directive ids read from files on disk,
 * so an id like `constructor` or `__proto__` would otherwise collide with an `Object.prototype`
 * member — the same hazard `ownAssignments` guards against in `./context.ts`, arriving here from the
 * opposite direction. Role names are walked in sorted order (REQ-SYS-07), which is also what makes
 * each entry's `roles` array ascending without a second sort.
 */
function rolesByDirectiveId(rolesYaml: RolesYaml | undefined): Map<string, string[]> {
  const byId = new Map<string, string[]>();
  if (rolesYaml === undefined) return byId;
  // `Object.entries` (own enumerable properties only) rather than `Object.keys` + an index read: it
  // hands back the id array already typed, with no `?? []` fallback that `noUncheckedIndexedAccess`
  // would otherwise force onto a key that by construction exists.
  const assignments = Object.entries(rolesYaml.assignments).sort(([a], [b]) => (a < b ? -1 : 1));
  for (const [role, ids] of assignments) {
    for (const id of ids) {
      const roles = byId.get(id);
      if (roles === undefined) byId.set(id, [role]);
      // A role listing the same directive id twice must not produce a duplicated role name.
      else if (!roles.includes(role)) roles.push(role);
    }
  }
  return byId;
}

/** Render {@link DirectiveListEntry.assignment} from the entry's `roles`/`global` pair. */
function renderAssignment(roles: readonly string[], isGlobal: boolean): string {
  const parts = isGlobal ? [GLOBAL_ASSIGNMENT, ...roles] : [...roles];
  return parts.length > 0 ? parts.join(', ') : UNASSIGNED_ASSIGNMENT;
}

/**
 * Annotate `directiveFiles` with their `roles.yaml` bindings, optionally keeping only those bound to
 * `role`, and attach the warnings described on {@link DirectiveListing}.
 *
 * `rolesYaml` is optional: `undefined` means the project has no `roles.yaml`, which is "nothing is
 * bound yet" (every entry `unassigned`), not a failure — the Directives files and `roles.yaml` are
 * independent artefacts (REQ-SYS-02) and directives can exist before anyone binds them.
 *
 * The `role` filter keeps an entry when that role's own `assignments` name it **or** when it is
 * `global`, because `spec-012` §5 makes globals unconditional for every role. An unbound or unknown
 * role is therefore not an error and not empty: it lists exactly the globals, matching
 * `dl-029-role-with-no-directive-assignments` (the ratified hybrid) rather than inventing a
 * `NOT_FOUND` this read-only command has no grounds to return.
 */
export function buildDirectiveListing(
  directiveFiles: readonly DirectiveFile[],
  rolesYaml: RolesYaml | undefined,
  role?: string,
): DirectiveListing {
  const byId = rolesByDirectiveId(rolesYaml);
  const globalIds = new Set<string>(rolesYaml?.global ?? []);

  const entries: DirectiveListEntry[] = [];
  for (const file of directiveFiles) {
    const roles = byId.get(file.frontmatter.id) ?? [];
    const isGlobal = globalIds.has(file.frontmatter.id);
    if (role !== undefined && !isGlobal && !roles.includes(role)) continue;
    entries.push({
      path: file.path,
      frontmatter: file.frontmatter,
      // Copy, so two entries sharing an id (a shadowed built-in/custom pair) never alias one array.
      roles: [...roles],
      global: isGlobal,
      assignment: renderAssignment(roles, isGlobal),
    });
  }
  const warnings = role === undefined
    ? selectDirectivesById(directiveFiles).warnings
    : resolveRoleDirectives(directiveFiles, rolesYaml ?? NO_BINDINGS, role).warnings;
  return { entries, warnings };
}

/**
 * Load both pillars' artefacts and build the listing — the filesystem half of
 * {@link buildDirectiveListing}, kept separate so the annotation rules stay unit-testable without
 * touching disk.
 *
 * `.wingfoil/roles.yaml` is read only when it exists; when it does exist it goes through the same
 * validating `loadRolesYaml` every other consumer uses, so a malformed or schema-invalid file still
 * raises a `ValidationError` (surfaced as `VALIDATION`, exit 1) rather than being silently downgraded
 * to "nothing is bound". Only a genuinely absent file is tolerated.
 */
export function loadDirectiveListing(root: string, role?: string): DirectiveListing {
  const directiveFiles = loadDirectives(root);
  const rolesYaml = documentExists(join(root, '.wingfoil', 'roles.yaml')) ? loadRolesYaml(root) : undefined;
  return buildDirectiveListing(directiveFiles, rolesYaml, role);
}
