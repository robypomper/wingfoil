/**
 * Reconcile a directive's `scope: global` frontmatter with `roles.yaml`'s `global:` list
 * (task-144, bug-148; `spec-013-directive-frontmatter-schema`, Revision 2026-10-01).
 *
 * Both sites state whether a directive binds every role. **`roles.yaml` is the authority**: it is what
 * {@link resolveRoleDirectives} and the `directives list` entries read, and nothing here changes a
 * binding. `scope` is the directive author's declaration of the same fact, kept so a reader of the file
 * sees it; when the two disagree the disagreement is reported in `directives list`'s own `warnings`
 * array rather than lost (bug-148: before this, `scope` was dropped with a stderr line only).
 *
 * Only a **declared** `scope` is compared — an absent one claims nothing and is never reported (approver
 * ruling R3 at `task-144`'s review, 2026-10-02: a project scaffolded before `scope` was declared, or one
 * that never writes it, lists clean). At most one warning per directive id, for the file in force:
 *
 * - it declares `scope: global` and `roles.yaml`'s `global:` does not list its id — the directive is NOT
 *   global, whatever the file says (also when there is no `roles.yaml` at all);
 * - it declares another scope and `global:` lists its id — the directive IS global, whatever the file
 *   says;
 * - it declares another scope and `global:` does not list it — the value is one `spec-013` does not
 *   define, so it has no effect. A warning, never a validation failure: spec-013 keeps unknown values
 *   forward-compatible (approver ruling R2).
 *
 * A `global:` id with no directive file is not reported here: nothing declares a scope for it, and a
 * binding without a file is the dangling-binding warning's case (`./context.ts`). For a shadowed id the
 * file compared is the one {@link selectDirectivesById} puts in force — the rule decided once there.
 *
 * Determinism (REQ-SYS-07): ascending by directive id, never file or YAML order.
 */
import type { RolesYaml } from '../directives/schema';

import { selectDirectivesById } from './context';
import type { DirectiveFile } from './loaders';

/** The `scope:` value spec-013 defines: the directive binds every role. */
const GLOBAL_SCOPE = 'global';

/**
 * The scope-disagreement warnings for `directiveFiles` against `rolesYaml` (`undefined` when the
 * project has no `roles.yaml`: nothing is global). Empty when no declared scope disagrees.
 */
export function directiveScopeWarnings(
  directiveFiles: readonly DirectiveFile[],
  rolesYaml: RolesYaml | undefined,
): string[] {
  const globalIds = new Set<string>(rolesYaml?.global ?? []);
  const warnings: string[] = [];
  // `byId` is already in ascending id order (selectDirectivesById's own contract).
  for (const [id, file] of selectDirectivesById(directiveFiles).byId) {
    const scope = file.frontmatter.scope;
    if (scope === undefined) continue;
    const listedGlobal = globalIds.has(id);
    if (scope === GLOBAL_SCOPE) {
      if (!listedGlobal) {
        warnings.push(
          `directive '${id}' declares scope: global in ${file.path}, but roles.yaml 'global' does not list it; roles.yaml decides: not global`,
        );
      }
    } else if (listedGlobal) {
      warnings.push(
        `directive '${id}' declares scope: ${scope} in ${file.path}, but roles.yaml 'global' lists it; roles.yaml decides: global`,
      );
    } else {
      warnings.push(
        `directive '${id}' declares scope: ${scope} in ${file.path}, which spec-013 does not define (only global); it has no effect`,
      );
    }
  }
  return warnings;
}
