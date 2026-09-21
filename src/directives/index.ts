/**
 * `directives` module — Project Directives pillar; role-based rules (built-in + custom) (P3.5/P3.8).
 * `DirectiveFrontmatter` (an [AUTHORING]-level minimal schema — see `./schema` for why there is no
 * dedicated tech-spec yet) lives here — the pillar owns its own independent schema (REQ-SYS-02);
 * `src/core`'s loader wires it through the shared validation pipeline. `./create`
 * (task-050-directive-create, P3.1) adds the pillar's first *authoring* helpers — the kebab-case
 * name rule and the generated file's content — which `src/core`'s `directiveCreate` operation
 * composes with the git-identity pre-flight, write and commit. `./roles-edit`
 * (task-051-directive-assign, P3.2) adds the pure, comment-preserving `roles.yaml` assignment edit that
 * `src/core`'s `directiveAssign` writes through, and `parseDirectiveIds`
 * (task-056-role-based-directive-assignment, P3.7) the comma-separated `--directive` value parser that
 * makes the same verb bind several directives at once. `directive remove` (P3.3, task-052) reuses none
 * of it — it refuses a still-assigned directive rather than unbinding it. Further Directives behavior
 * lands in later tasks.
 */
export const MODULE_NAME = 'directives' as const;

export { DirectiveFrontmatter, RolesYaml } from './schema';

export {
  INVALID_DIRECTIVE_NAME_MESSAGE,
  directiveTitleFromName,
  isValidDirectiveName,
  renderCustomDirective,
} from './create';

export { parseDirectiveIds, setRoleAssignmentsInText, withAssignedDirectives } from './roles-edit';
