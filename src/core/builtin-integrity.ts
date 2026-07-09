/**
 * Built-in template integrity check (task-044-builtin-template-integrity, REQ-SEC-10): "Built-in
 * directive and workflow templates are integrity/schema-checked before installation during `init`...
 * A corrupted or schema-invalid built-in template aborts `init` before writing partial assets, with a
 * message naming the failing template" (docs/02_requirements/03_sard/05_security-compliance.md).
 *
 * A cross-pillar concern by construction — checking a directive source needs the Directives pillar's
 * `DirectiveFrontmatter` schema, checking a workflow source needs the Workflow pillar's `Workflow`
 * schema — so, per `src/core/loaders.ts`'s own precedent ("Cross-file concerns ... need the caller to
 * have actually loaded the referenced files ... live in the loader, not [a pillar] schema module"),
 * this lives in `core`, not in either pillar module or in `storage` (which only carries the raw
 * {@link BuiltinTemplateSource} shape — see `src/storage/templates.ts`). Reuses the exact same
 * two-pass validation primitives (`parseYaml`, `runValidation`) every pillar loader already uses, so a
 * built-in source is checked against precisely the same schema its custom counterpart would be loaded
 * with — no bespoke re-implementation of YAML/frontmatter parsing.
 *
 * `verifyBuiltinTemplates` is a pure function of its input list (REQ-SYS-07: no wall-clock, no
 * randomness) — the same corrupted input always yields the same failure, and callers may pass a
 * fixture list in tests via {@link BuiltinTemplateSource} without touching disk.
 */
import { DirectiveFrontmatter } from '../directives/schema';
import { extractFrontmatter, type BuiltinTemplateKind, type BuiltinTemplateSource } from '../storage';
import { parseYaml, runValidation } from '../validation';
import { Workflow } from '../workflow/schema';

export type { BuiltinTemplateKind, BuiltinTemplateSource } from '../storage';

/**
 * The first built-in template source {@link verifyBuiltinTemplates} found invalid: its `name`/`kind`
 * (identifying which source failed) plus the exact, already-formatted abort `message` — either the
 * P3.8 directive wording or the P4.17 workflow wording, per REQ-SEC-10's fit criterion.
 */
export interface BuiltinIntegrityFailure {
  readonly name: string;
  readonly kind: BuiltinTemplateKind;
  readonly message: string;
}

/** Exact P3.8 BDD wording ("Error - a built-in template fails its integrity check") — do not reword. */
function directiveIntegrityMessage(name: string): string {
  return `built-in directive template integrity check failed: ${name}`;
}

/** Exact P4.17 BDD wording ("Error - a built-in workflow template is structurally invalid") — do not reword. */
function workflowIntegrityMessage(name: string): string {
  return `built-in workflow template invalid: ${name}`;
}

/**
 * `true` iff `source.content` parses as a `.md` document with a frontmatter block that validates
 * against `DirectiveFrontmatter` (the same schema `core/loaders.ts`'s `loadDirectives` runs custom
 * directive files through). Any parse or schema failure — missing frontmatter, unparsable YAML, a
 * missing required field — is "corrupted" for REQ-SEC-10's purposes; the exact cause is not surfaced
 * (the fit criterion only requires naming *which* template failed, not why).
 */
function isValidDirectiveSource(source: BuiltinTemplateSource): boolean {
  const frontmatterText = extractFrontmatter(source.content);
  if (frontmatterText === null) return false;
  try {
    const data = parseYaml(frontmatterText, source.name);
    runValidation(DirectiveFrontmatter, data, source.name);
    return true;
  } catch {
    return false;
  }
}

/**
 * `true` iff `source.content` parses as YAML and validates against the `Workflow` schema (the same
 * schema `core/loaders.ts`'s `loadWorkflowsYaml` runs every included workflow file through).
 */
function isValidWorkflowSource(source: BuiltinTemplateSource): boolean {
  try {
    const data = parseYaml(source.content, source.name);
    runValidation(Workflow, data, source.name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Integrity/schema-check every `sources` entry, in list order (REQ-SYS-07: deterministic, no
 * unordered iteration), and return the FIRST one that fails — or `null` when every source is valid
 * (including the trivial, always-passing case of an empty list, today's shipped default: no built-in
 * template content exists yet, see `src/storage/templates.ts`'s `BUILTIN_TEMPLATE_SOURCES`).
 *
 * Callers (namely `initWingfoilProject`, `src/core/init.ts`) MUST run this before writing any file:
 * REQ-SEC-10's fit criterion requires the abort to happen "before writing partial assets" — this
 * function itself never writes or reads from disk, so calling it before the scaffold write is
 * sufficient to satisfy that ordering.
 */
export function verifyBuiltinTemplates(
  sources: readonly BuiltinTemplateSource[],
): BuiltinIntegrityFailure | null {
  for (const source of sources) {
    const valid = source.kind === 'directive' ? isValidDirectiveSource(source) : isValidWorkflowSource(source);
    if (!valid) {
      const message =
        source.kind === 'directive' ? directiveIntegrityMessage(source.name) : workflowIntegrityMessage(source.name);
      return { name: source.name, kind: source.kind, message };
    }
  }
  return null;
}
