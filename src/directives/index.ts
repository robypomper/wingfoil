/**
 * `directives` module — Project Directives pillar; role-based rules (built-in + custom) (P3.5/P3.8).
 * `DirectiveFrontmatter` (an [AUTHORING]-level minimal schema — see `./schema` for why there is no
 * dedicated tech-spec yet) lives here — the pillar owns its own independent schema (REQ-SYS-02);
 * `src/core`'s loader wires it through the shared validation pipeline. `./create`
 * (task-050-directive-create, P3.1) adds the pillar's first *authoring* helpers — the kebab-case
 * name rule and the generated file's content — which `src/core`'s `directiveCreate` operation
 * composes with the git-identity pre-flight, write and commit. Further Directives behavior lands in
 * later tasks.
 */
export const MODULE_NAME = 'directives' as const;

export { DirectiveFrontmatter, RolesYaml } from './schema';

export {
  INVALID_DIRECTIVE_NAME_MESSAGE,
  directiveTitleFromName,
  isValidDirectiveName,
  renderCustomDirective,
} from './create';
