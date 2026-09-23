/**
 * Schema-driven DNA path resolution — the single traversal every DNA **write** goes through
 * (`dna set`, and `dna add|remove|update` since task-093-dna-mutation-surface-add-remove-update).
 *
 * It exists because the previous traversal had no notion of the schema at all: `setDnaValue` walked a
 * dotted path treating every segment as an object key and **created** an object for any segment it
 * could not descend into, so `dna set tech_stack.cli.framework Commander` wrote `stacks.cli.framework`
 * — a key no schema declares — and committed it at exit `0`
 * (`bug-084-dna-key-alias-writes-unschemad-keys`). `dl-081-dna-mutation-surface-shape`'s ratification
 * makes the repair a **precondition** of the mutation surface rather than a follow-up to it: under
 * add/remove/update semantics one cannot add to a collection that does not exist, so the traversal
 * must be structure-aware and non-creating.
 *
 * The rule it implements, in the ratification's own words: **the DNA pillar accepts unknown keys when
 * reading a document and refuses to write one.** Pass-through on read stays exactly as
 * `spec-002-dna-yaml-schema` declares it (every node is `.passthrough()`, so a file written by a newer
 * WingFoil still loads); it is the write side that is closed.
 *
 * Two further properties this module owns:
 *
 * - **Entries are addressed by `name`, never by index** (`dl-081`, settled in its approve commit).
 *   `team.members.roberto.roles` reaches one member's role list; `team.members.2.roles` does not
 *   resolve at all, because an index shifts the moment an entry is removed and a path written today
 *   would address a different entry tomorrow.
 * - **The schema is the only source of truth.** The traversal reads `DnaYaml` itself (Zod v4 exposes
 *   `def.shape` / `def.element` / `def.innerType`, and does so through `.passthrough()` and
 *   `.superRefine()` alike), never a hand-written field table, so the write surface cannot drift from
 *   the schema it writes as `spec-002` evolves.
 *
 * Pure and deterministic (REQ-SYS-07): no wall-clock, no randomness, no filesystem, and the document
 * it is handed is never mutated — on a refusal as much as on a success.
 */
import { DnaYaml } from './schema';
import { isValidKeyPath } from './set';

/** The kind of node a resolved path lands on — what a verb is allowed to do there. */
export type DnaTargetKind =
  /** An object node (`project`, `team`, `paths`): a section, not a writable field. */
  | 'section'
  /** A single value (`project.license`, `modules.core.path`, `version`). */
  | 'scalar'
  /** An array of strings (`paths.sources`, `team.members.<name>.roles`). */
  | 'string-list'
  /** An array of objects (`modules`, `team.members`, `stacks.technologies`). */
  | 'collection'
  /** One element of a collection, addressed by its `name`. */
  | 'entry';

/** The value shape of one field declared on a collection's entry object. */
export type DnaFieldKind = 'string' | 'number' | 'boolean' | 'string-list' | 'other';

/** One field a collection's entries may carry, as the schema declares it (used to build the CLI options). */
export interface DnaEntryField {
  readonly name: string;
  readonly kind: DnaFieldKind;
  readonly required: boolean;
}

/** Where a dotted path landed: what kind of node, what is there today, and what may be written into it. */
export interface DnaPathTarget {
  readonly kind: DnaTargetKind;
  /** The path as given (paths are never rewritten — see {@link DNA_KEY_ALIASES}'s note in `./set.ts`). */
  readonly path: string;
  /** `path` split on `.`; for an `entry`, the last segment is the entry's `name`. */
  readonly segments: readonly string[];
  /** The value in the document at this path, or `undefined` when the node is declared but absent. */
  readonly value: unknown;
  /** Whether the node is actually present in the document (a declared-but-absent node resolves with `false`). */
  readonly exists: boolean;
  /** Whether the schema requires this node (`kind: 'scalar'`/`'string-list'`) — i.e. whether it may be removed. */
  readonly required?: boolean;
  /** The entry's index inside its collection (`kind: 'entry'`). */
  readonly entryIndex?: number;
  /** The fields the entries of this collection may carry, in schema order (`kind: 'collection'` or `'entry'`). */
  readonly entryFields?: readonly DnaEntryField[];
  /** The path of the collection an `entry` belongs to (`kind: 'entry'`). */
  readonly collectionPath?: string;
}

/** A resolved target, or the refusal message the caller reports at exit `1` (`spec-005` §1). */
export type DnaPathResolution = { readonly ok: true; readonly target: DnaPathTarget } | { readonly ok: false; readonly message: string };

/** A Zod schema node, viewed through the small part of the v4 introspection surface used here. */
interface SchemaNode {
  readonly def: {
    readonly type: string;
    readonly shape?: Record<string, SchemaNode>;
    readonly element?: SchemaNode;
    readonly innerType?: SchemaNode;
  };
}

/** Strip the wrappers that do not change addressing (`.optional()`, `.nullable()`, `.default()`). */
function unwrap(node: SchemaNode): SchemaNode {
  let current = node;
  while (
    (current.def.type === 'optional' || current.def.type === 'nullable' || current.def.type === 'default') &&
    current.def.innerType !== undefined
  ) {
    current = current.def.innerType;
  }
  return current;
}

/** Whether the schema makes this node omittable — the only thing that decides if `remove` may drop it. */
function isOptional(node: SchemaNode): boolean {
  return node.def.type === 'optional' || node.def.type === 'default' || node.def.type === 'nullable';
}

/** How a leaf's value is shaped, for coercing a `--<field>` option string into it. */
function fieldKind(node: SchemaNode): DnaFieldKind {
  const inner = unwrap(node);
  if (inner.def.type === 'string') return 'string';
  if (inner.def.type === 'number') return 'number';
  if (inner.def.type === 'boolean') return 'boolean';
  if (inner.def.type === 'array' && inner.def.element !== undefined && unwrap(inner.def.element).def.type === 'string') {
    return 'string-list';
  }
  return 'other';
}

/** The fields one collection's entry object declares, in schema order (deterministic — REQ-SYS-07). */
function entryFieldsOf(entrySchema: SchemaNode): readonly DnaEntryField[] {
  const shape = unwrap(entrySchema).def.shape ?? {};
  return Object.keys(shape).map((name) => {
    const field = shape[name]!;
    return { name, kind: fieldKind(field), required: !isOptional(field) };
  });
}

/** The node kind a schema node resolves to when a path ends on it. */
function kindOf(node: SchemaNode): DnaTargetKind | undefined {
  const inner = unwrap(node);
  if (inner.def.type === 'object') return 'section';
  if (inner.def.type === 'array') {
    const element = inner.def.element === undefined ? undefined : unwrap(inner.def.element);
    if (element?.def.type === 'object') return 'collection';
    if (element?.def.type === 'string') return 'string-list';
    return undefined;
  }
  if (inner.def.type === 'string' || inner.def.type === 'number' || inner.def.type === 'boolean') return 'scalar';
  return undefined;
}

/** `a.b.c` for the first `depth` segments — how a refusal names the part of the path that did resolve. */
function prefixOf(segments: readonly string[], depth: number): string {
  return segments.slice(0, depth).join('.');
}

/** The refusal a segment the schema does not declare produces: it names the whole path AND the segment. */
function unknownField(path: string, segments: readonly string[], depth: number): DnaPathResolution {
  const where = depth === 0 ? 'the dna.yaml schema' : `'${prefixOf(segments, depth)}'`;
  return { ok: false, message: `unknown DNA field '${path}': '${segments[depth]}' is not declared under ${where}` };
}

/**
 * Resolve `keyPath` against `DnaYaml` and `dna`, reporting what a verb may do at the end of it.
 *
 * Every refusal names the **full** path (so an error message is greppable against the invocation) and
 * the part of it that failed. The four refusal families:
 *
 * - a segment the schema does not declare — `bug-084`, the reason this module exists;
 * - a path that tries to descend through a value or through a list of values;
 * - an index where an entry `name` is expected (`dl-081`: indices are not the addressing form);
 * - an entry `name` the collection does not carry, or carries more than once. The second is
 *   unreachable through any CLI/MCP path once `DnaYaml`'s per-collection uniqueness refinement is in
 *   force (a duplicate-bearing document no longer loads), and is kept because this function is a pure
 *   helper that can be handed any object — including, in a test, one that never went through the
 *   loader.
 *
 * A **declared but absent** node is not a refusal: it resolves with `exists: false`, which is what lets
 * `dna set project.license MIT` fill an optional section the document happens to omit. That is the
 * precise line `bug-084` draws — creating a node the schema declares is legitimate; inventing one it
 * does not declare is the defect.
 */
export function resolveDnaPath(dna: unknown, keyPath: string): DnaPathResolution {
  if (!isValidKeyPath(keyPath)) {
    return { ok: false, message: `invalid key path: '${keyPath}'` };
  }
  const segments = keyPath.split('.');

  let schema = DnaYaml as unknown as SchemaNode;
  let value: unknown = dna;
  let collectionPath: string | undefined;
  let entryIndex: number | undefined;
  let entryFields: readonly DnaEntryField[] | undefined;

  for (let depth = 0; depth < segments.length; depth += 1) {
    const segment = segments[depth]!;
    const node = unwrap(schema);

    if (node.def.type === 'object') {
      const child = node.def.shape?.[segment];
      if (child === undefined) return unknownField(keyPath, segments, depth);
      schema = child;
      value = isRecord(value) ? value[segment] : undefined;
      collectionPath = undefined;
      entryIndex = undefined;
      entryFields = undefined;
      continue;
    }

    if (node.def.type === 'array' && node.def.element !== undefined) {
      const element = unwrap(node.def.element);
      if (element.def.type !== 'object') {
        return {
          ok: false,
          message: `unknown DNA field '${keyPath}': '${prefixOf(segments, depth)}' is a list of values, with nothing to address below it`,
        };
      }
      if (/^\d+$/.test(segment)) {
        return {
          ok: false,
          message: `unknown DNA field '${keyPath}': entries of '${prefixOf(segments, depth)}' are addressed by name, not by index`,
        };
      }
      const entries = Array.isArray(value) ? value : [];
      const matches = entries
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => isRecord(entry) && entry.name === segment);
      if (matches.length === 0) {
        return { ok: false, message: `no entry named '${segment}' in '${prefixOf(segments, depth)}' (path '${keyPath}')` };
      }
      if (matches.length > 1) {
        return {
          ok: false,
          message: `'${prefixOf(segments, depth)}' carries ${matches.length} entries named '${segment}' — the name is ambiguous (path '${keyPath}')`,
        };
      }
      collectionPath = prefixOf(segments, depth);
      entryFields = entryFieldsOf(node.def.element);
      entryIndex = matches[0]!.index;
      schema = node.def.element;
      value = matches[0]!.entry;
      continue;
    }

    return {
      ok: false,
      message: `unknown DNA field '${keyPath}': '${prefixOf(segments, depth)}' is a value, not a section`,
    };
  }

  // The path ended on `schema`/`value`. An entry is the one kind the loop above already established.
  const isEntry = entryIndex !== undefined && collectionPath !== undefined && segments.length > 0;
  const kind = isEntry ? 'entry' : kindOf(schema);
  if (kind === undefined) {
    return { ok: false, message: `unknown DNA field '${keyPath}': it is not a field this schema can address` };
  }

  const base = {
    kind,
    path: keyPath,
    segments,
    value,
    exists: value !== undefined,
    required: !isOptional(schema),
  };
  if (kind === 'entry') {
    return { ok: true, target: { ...base, entryIndex, entryFields, collectionPath } };
  }
  if (kind === 'collection') {
    return { ok: true, target: { ...base, entryFields: entryFieldsOf(unwrap(schema).def.element!) } };
  }
  return { ok: true, target: base };
}

/** Whether `value` is a plain object we can read a key from (not null, not an array). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Every collection `DnaYaml` declares, as a dotted path — derived from the schema, in a fixed order
 * (REQ-SYS-07). Used to build the union of `--<entry-field>` options the mutation verbs accept and to
 * document the surface in `--help`; nothing here is hand-listed, so a collection added to `spec-002`
 * becomes addressable without touching this module.
 */
export function dnaCollectionPaths(): readonly string[] {
  const out: string[] = [];
  const walk = (node: SchemaNode, prefix: readonly string[]): void => {
    const inner = unwrap(node);
    if (inner.def.type !== 'object' || inner.def.shape === undefined) return;
    for (const key of Object.keys(inner.def.shape)) {
      const child = unwrap(inner.def.shape[key]!);
      const path = [...prefix, key];
      if (kindOf(child) === 'collection') out.push(path.join('.'));
      else if (child.def.type === 'object') walk(child, path);
    }
  };
  walk(DnaYaml as unknown as SchemaNode, []);
  return out;
}

/**
 * The union of every field name the entries of every collection may carry, minus `name` (which travels
 * in `--value`, per `dl-081`'s `--value`-is-the-identity convention), in a fixed order. This is the
 * `--<field>` option set `dna add`/`dna update` register on both surfaces.
 */
export function dnaEntryOptionNames(): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of dnaCollectionPaths()) {
    const resolved = resolveDnaPath({}, path);
    const fields = resolved.ok ? (resolved.target.entryFields ?? []) : [];
    for (const field of fields) {
      if (field.name === 'name' || seen.has(field.name)) continue;
      seen.add(field.name);
      out.push(field.name);
    }
  }
  return out;
}
