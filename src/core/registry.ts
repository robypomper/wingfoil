/**
 * The `CoreModule` registry shape (spec-006-core-domain-api §2, §4 — task-006). `src/cli` and
 * `src/mcp` both import the same `CoreModule[]` array (`./index.ts`'s `CORE_MODULES`) and register
 * every operation they find — neither surface is permitted a hardcoded allow/deny list of operation
 * names (§4.2). This module owns: the registry types themselves, the one mechanical
 * name-derivation function both adapters use to turn an operation's camelCase name into its CLI
 * verb / MCP Tool-and-Resource verb segment (so neither adapter hand-maintains a second name
 * mapping — spec-006 §5), a deterministic (REQ-SYS-07) enumerator, and the generic parity-diff
 * primitive the REQ-SYS-05 fit criterion's "0 unmatched operations" assertion is built on.
 */
import type { CoreResult } from './types';

export type CoreFn<P, R> = (params: P) => Promise<CoreResult<R>>;

export interface CoreOperation<P = unknown, R = unknown> {
  /** camelCase, `{module}{Verb}` (spec-006 §5) — e.g. `memoryApprove`, `dnaShow`. */
  readonly name: string;
  /** `true` => MCP Tool only; `false` => MCP Resource only. CLI exposes both regardless (§2). */
  readonly mutates: boolean;
  readonly fn: CoreFn<P, R>;
}

export interface CoreModule {
  /** e.g. `"memory"`, `"dna"`, `"workflow"`, `"directives"` — the `wingfoil <noun>` segment. */
  readonly name: string;
  readonly operations: Readonly<Record<string, CoreOperation>>;
}

/** One operation, paired with the module that declares it — the flat shape both adapters iterate. */
export interface EnumeratedOperation {
  readonly module: CoreModule;
  readonly operation: CoreOperation;
}

/**
 * Flatten `modules` into every declared operation, sorted deterministically by `(module.name,
 * operation.name)` (REQ-SYS-07 — no unordered `Object.values`/iteration in a context-building
 * path). Both `src/cli` and `src/mcp` register from this single enumerator, never from their own
 * ad hoc traversal of `modules`/`Object.keys`.
 */
export function enumerateOperations(modules: readonly CoreModule[]): EnumeratedOperation[] {
  const out: EnumeratedOperation[] = [];
  const sortedModules = [...modules].sort((a, b) => a.name.localeCompare(b.name));
  for (const module of sortedModules) {
    const operationNames = Object.keys(module.operations).sort();
    for (const operationName of operationNames) {
      const operation = module.operations[operationName];
      if (operation) out.push({ module, operation });
    }
  }
  return out;
}

/** camelCase -> kebab-case (`"setTeam"` -> `"set-team"`), used by {@link deriveVerb}. */
function camelToKebab(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Derive an operation's CLI verb / MCP verb segment from its camelCase `{module}{Verb}` name
 * (spec-006 §5), mechanically — this plus `mutates` is "the one place surface-routing logic
 * lives" (§2): given `moduleName = "memory"` and `operationName = "memoryApprove"`, returns
 * `"approve"`; a multi-word verb (`"workflowSetTeam"`) becomes kebab-case (`"set-team"`) so it
 * renders as a single CLI token / Tool-name segment. Falls back to the full operation name,
 * kebab-cased, when it does not start with the module's name — a config mistake the caller should
 * catch earlier, but this function degrades rather than throwing, so a single bad registration
 * cannot crash an adapter's entire registration pass.
 */
export function deriveVerb(moduleName: string, operationName: string): string {
  const startsWithModule = operationName.startsWith(moduleName) && operationName.length > moduleName.length;
  const suffix = startsWithModule ? operationName.slice(moduleName.length) : operationName;
  const withLeadingLower = suffix.length > 0 ? suffix[0]!.toLowerCase() + suffix.slice(1) : suffix;
  return camelToKebab(withLeadingLower);
}

/**
 * What a surface adapter (`src/cli`, `src/mcp`) knows about the call it is about to make — enough
 * for a caller-supplied {@link ParamsBuilder} to construct that operation's actual typed params.
 * Neither adapter hardcodes per-operation argv/Tool-input parsing here (that is each future
 * operation's own CLI-command / Tool-input-schema spec, per spec-005's own scope note) — today's registered
 * operations (see `src/core/index.ts` `CORE_MODULES`) all take a bare `{ root }`, so both adapters
 * are wired with a `buildParams` that returns exactly that; the seam exists so a later, richer
 * operation only requires a richer `buildParams`, not a registrar change.
 */
export interface ParamsContext {
  readonly moduleName: string;
  readonly operationName: string;
  readonly root: string;
  /**
   * The bare CLI positional argument following `<noun> <verb>`, if the invocation supplied one
   * (e.g. `wingfoil dna show tech_stack` -> `"tech_stack"`) — task-026-implement-dna-show's
   * generic extension of this seam. Deliberately untyped beyond `string | undefined` and
   * deliberately singular: it is not `dna`-specific (any operation's `buildParams` may read it
   * under whatever param name that operation's own `CoreFn` expects, e.g. `dnaShow`'s `section`
   * lookup) and not itself validated here — an operation that needs a *required* positional (or
   * more than one) still owns that validation in its own `CoreFn`, this seam only carries the raw
   * value from the CLI adapter through to `buildParams`. The MCP surface has no equivalent
   * mechanical concept today (a zero-argument Resource template can't carry one — spec-004 §2.1's
   * own `wingfoil://dna/{section}` addressing is the MCP-side answer, wired independently in
   * `src/mcp/dna-resource.ts`), so an MCP `buildParams` simply never sets this field.
   */
  readonly positional?: string;
}

export type ParamsBuilder = (ctx: ParamsContext) => unknown;

/** The result of {@link computeParityDiff}: entries present on only one side, each sorted. */
export interface ParityDiff {
  readonly onlyInA: readonly string[];
  readonly onlyInB: readonly string[];
}

/**
 * Set-difference both ways between two enumerations of the same kind of key (e.g. `"noun verb"`
 * CLI commands vs. the same keys' MCP Tool names, normalized to a common form by the caller) —
 * the REQ-SYS-05 fit-criterion primitive: "reports 0 [operations] without a matching [counterpart]"
 * in each direction. Both output lists are sorted, independent of input order (REQ-SYS-07).
 */
export function computeParityDiff(a: readonly string[], b: readonly string[]): ParityDiff {
  const setA = new Set(a);
  const setB = new Set(b);
  const onlyInA = [...setA].filter((key) => !setB.has(key)).sort();
  const onlyInB = [...setB].filter((key) => !setA.has(key)).sort();
  return { onlyInA, onlyInB };
}
