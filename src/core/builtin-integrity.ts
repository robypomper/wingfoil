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

/** How one {@link BuiltinTemplateKind} is checked, and what its failure message reads. */
interface IntegrityPolicy {
  readonly isValid: (source: BuiltinTemplateSource) => boolean;
  readonly message: (name: string) => string;
}

/**
 * Per-kind schema-check policy: the `isValid` predicate to apply and the exact REQ-SEC-10 abort-message
 * builder to use when it fails. Keyed by {@link BuiltinTemplateKind} so each kind's validator and its
 * BDD wording live together and `verifyBuiltinTemplates` branches on `kind` exactly once. The message
 * strings are verbatim BDD contracts — P3.8 "Error - a built-in template fails its integrity check"
 * and P4.17 "Error - a built-in workflow template is structurally invalid" — do not reword.
 *
 * Declared as an EXHAUSTIVE `Record` so widening {@link BuiltinTemplateKind} is a compile error until
 * the new kind gets a policy; look it up only through {@link policyFor}, never by bare indexing.
 */
const INTEGRITY_POLICY: Readonly<Record<BuiltinTemplateKind, IntegrityPolicy>> = {
  directive: {
    isValid: isValidDirectiveSource,
    message: (name) => `built-in directive template integrity check failed: ${name}`,
  },
  workflow: {
    isValid: isValidWorkflowSource,
    message: (name) => `built-in workflow template invalid: ${name}`,
  },
};

/**
 * The REQ-SEC-10 message for a source whose `kind` has no policy — the fail-closed branch. Not a BDD
 * contract string (the P3.8/P4.17 scenarios only cover the two known kinds), but it obeys the fit
 * criterion's one requirement of every abort message: it NAMES the failing template. The offending
 * `kind` is echoed so the operator can see what arrived.
 */
function unknownKindMessage(name: string, kind: string): string {
  return `built-in template integrity check failed: ${name} (unrecognized kind "${kind}")`;
}

/**
 * The policy for `kind`, or `undefined` when there is none.
 *
 * `INTEGRITY_POLICY[kind]` on its own is FAIL-OPEN at runtime: TypeScript types the result as always
 * present, but a `kind` outside the union — reachable through a cast, a JS caller, a JSON boundary, or
 * a future disk-derived source list — yields `undefined` (or, for `constructor`/`toString`/`__proto__`,
 * an inherited `Object.prototype` member), and the call on it throws a `TypeError`. That throw escapes
 * `initWingfoilProject`, whose guard-5 call sits outside its `try`/`catch`, as an uncaught exception
 * instead of the `VALIDATION` CoreResult / exit 1 REQ-SEC-10 demands. `hasOwnProperty` keeps inherited
 * members out, so an unrecognized kind resolves to `undefined` and the caller fails it closed.
 */
function policyFor(kind: BuiltinTemplateKind): IntegrityPolicy | undefined {
  return Object.prototype.hasOwnProperty.call(INTEGRITY_POLICY, kind) ? INTEGRITY_POLICY[kind] : undefined;
}

/**
 * Schema-check every `sources` entry, in list order (REQ-SYS-07: deterministic, no unordered
 * iteration), and return the FIRST one that fails — or `null` when every source is valid (including
 * the trivial, always-passing case of an empty list, which is what `src/storage/templates.ts`'s
 * `builtinTemplateSources` derives from today's scaffold: no built-in template content ships yet).
 *
 * FAILS CLOSED on an unrecognized `kind`: a source whose kind has no {@link INTEGRITY_POLICY} entry is
 * reported as a failure ({@link unknownKindMessage}) rather than skipped or thrown on — it cannot be
 * checked, so it must not be installed.
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
    const policy = policyFor(source.kind);
    if (policy === undefined) {
      return {
        name: source.name,
        kind: source.kind,
        message: unknownKindMessage(source.name, String(source.kind)),
      };
    }
    if (!policy.isValid(source)) {
      return { name: source.name, kind: source.kind, message: policy.message(source.name) };
    }
  }
  return null;
}
