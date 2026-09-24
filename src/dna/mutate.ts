/**
 * The pure `add | remove | update` semantics of the DNA mutation surface
 * (`dl-081-dna-mutation-surface-shape`, ratified option **(E)**; task-093;
 * closes `bug-083-dna-set-cannot-write-array-valued-fields`).
 *
 * Before this module, `dna set` reached 7 of roughly 38 schema fields — `version` and the six scalars
 * under `project` — because its traversal treated every path segment as an object key. 11 fields are
 * array-valued and 17 more live inside array entries, and none of them was reachable for create, update
 * or delete: not a module's `path`, a technology's `version`, a member's `email`, nor the removal of any
 * of them, nor the addition of a role or a member (`dl-081` E2/E3).
 *
 * The grammar the ratification chose, and which this module implements — with the path in the verb's
 * **positional** (`dl-082-cli-parameter-shape`: a positional carries the identity of the target, an
 * option a named attribute of the action) and every attribute in an option:
 *
 * ```
 * dna add    team.roles                 --value reviewer --entry-description "reviews changes"
 * dna add    team.members               --value roberto  --entry-email r@example.it --entry-roles approver
 * dna add    team.members.roberto.roles --value qa
 * dna update team.members               --value roberto  --entry-email new@example.it
 * dna update modules.core.path          --value src/core
 * dna remove modules                    --value core
 * ```
 *
 * `--value` carries **two** things by position — the new entry's identity when the path ends at a
 * collection, the new value when it ends at a leaf. That is a convention rather than something the
 * grammar states, so it is stated: here, in `--help` (`src/core/index.ts`'s option descriptions) and in
 * `spec-008-cli-grammar`.
 *
 * This module is pure (REQ-SYS-07): no git, no filesystem, no clock, and the document it is handed is
 * never mutated — every mutation is applied to a deep clone, so a refusal leaves the caller's object
 * untouched and `src/core` re-validates and commits only what comes back. It sits under `src/core`
 * (`spec-006-core-domain-api` §1: the pillar is a leaf, and imports nothing from `core`).
 */
import type { z } from 'zod';

import type { DnaTextEdit, DnaTextStep } from './edit';
import { dnaEntryOptionName, resolveDnaPath, type DnaEntryField, type DnaPathTarget } from './path';

/** The three verbs `dl-081` ratified. `dna set` is `update` restricted to a scalar. */
export type DnaMutationVerb = 'add' | 'remove' | 'update';

/** One mutation request: the full `<path>`, the `--value` payload, and the per-entry `--entry-<field>` options. */
export interface DnaMutationRequest {
  readonly verb: DnaMutationVerb;
  /** The FULL dotted path (`dl-081`: never a bare field name — `team.roles` and `team.members.roles` differ). */
  readonly field: string;
  /** The entry's identity at a collection; the new value at a leaf. Optional only where the path says everything. */
  readonly value?: string;
  /** `--entry-<field>` options, keyed by the schema's own field name and still raw strings; coerced against the entry schema (`{ email: 'r@x.y' }`). */
  readonly fields?: Readonly<Record<string, string>>;
}

/** The mutated document plus the minimal text edit that expresses it, or the refusal to report at exit `1`. */
export type DnaMutationResult =
  | { readonly ok: true; readonly dna: Record<string, unknown>; readonly edit: DnaTextEdit }
  | { readonly ok: false; readonly message: string };

/** A refusal, in the one shape every branch below returns. */
function refuse(message: string): DnaMutationResult {
  return { ok: false, message };
}

/** Deep-clone the document so no branch can leave a half-applied mutation behind on a refusal. */
function clone(dna: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(dna);
}

/** Coerce one `--entry-<field>` option string into the shape the entry schema declares for it. */
function coerce(raw: string, kind: DnaEntryField['kind']): unknown {
  if (kind === 'string-list') return splitList(raw);
  if (kind === 'number') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : raw;
  }
  if (kind === 'boolean') {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return raw;
  }
  return raw;
}

/**
 * Split a comma-separated option value — the shape used **only** where the schema declares
 * `z.array(z.string())` (`paths.*`, `team.members[].roles`, `team.agents[].executes_as`). The precedent
 * is `directive assign --directive testing,code-quality` (`task-056-role-based-directive-assignment`),
 * so the CLI has one comma convention rather than two.
 */
function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** The text-edit path for a target, with every collection segment replaced by the entry's resolved index. */
function textPath(dna: Record<string, unknown>, target: DnaPathTarget): DnaTextStep[] {
  const steps: DnaTextStep[] = [];
  let node: unknown = dna;
  for (const segment of target.segments) {
    if (Array.isArray(node)) {
      const index = node.findIndex((entry) => isRecord(entry) && entry.name === segment);
      steps.push({ index });
      node = node[index];
    } else {
      steps.push({ key: segment });
      node = isRecord(node) ? node[segment] : undefined;
    }
  }
  return steps;
}

/** Whether `value` is a plain object (not null, not an array). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The container a path's last segment lives in.
 *
 * A **declared but absent** object on the way is created — that is what lets
 * `dna set project.license --value MIT` fill an optional section the document omits — and this is deliberately
 * NOT the creation `bug-084` filed: every segment here has already been resolved against the schema by
 * `resolveDnaPath`, so nothing the schema does not declare can reach this function. An existing array is
 * descended into by entry name rather than replaced, which is exactly what the old traversal got wrong.
 */
function containerFor(dna: Record<string, unknown>, segments: readonly string[]): Record<string, unknown> | unknown[] {
  let node: Record<string, unknown> | unknown[] = dna;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i]!;
    if (Array.isArray(node)) {
      const index = node.findIndex((entry) => isRecord(entry) && entry.name === segment);
      node = node[index] as Record<string, unknown>;
      continue;
    }
    const child = node[segment];
    if (Array.isArray(child) || isRecord(child)) {
      node = child as Record<string, unknown> | unknown[];
      continue;
    }
    const created: Record<string, unknown> = {};
    node[segment] = created;
    node = created;
  }
  return node;
}

/**
 * Read the list at `segments`, or `[]` when the schema declares it and the document omits it — which
 * is how `dna add paths.tests --value test/` fills a category the file leaves out.
 *
 * The container is always a MAPPING: a list is reached through a mapping key, either a section's
 * (`paths.sources`) or an entry's (`team.members.<name>.roles`), never as an element of another list,
 * because the schema declares no list of lists and `resolveDnaPath` refuses one if it ever does.
 */
function listAt(dna: Record<string, unknown>, target: DnaPathTarget): { key: string; items: unknown[] } {
  const container = containerFor(dna, target.segments) as Record<string, unknown>;
  const key = target.segments[target.segments.length - 1]!;
  const current = container[key];
  const items = Array.isArray(current) ? current : [];
  container[key] = items;
  return { key, items };
}

/** Apply `fields` to `entry`, refusing an option the collection's entry schema does not declare. */
function applyFields(
  entry: Record<string, unknown>,
  fields: Readonly<Record<string, string>>,
  declared: readonly DnaEntryField[],
  collectionPath: string,
): string | undefined {
  for (const name of Object.keys(fields)) {
    if (name === 'name') {
      return `'name' is an entry's identity, not a field to update: it is what the path '${collectionPath}.<name>' addresses. Remove the entry and add it under the new name.`;
    }
    const field = declared.find((candidate) => candidate.name === name);
    if (field === undefined) {
      const known = declared.filter((candidate) => candidate.name !== 'name').map((candidate) => `--${dnaEntryOptionName(candidate.name)}`);
      return `'--${dnaEntryOptionName(name)}' is not a field of '${collectionPath}' entries; they carry ${known.join(', ')}`;
    }
    entry[name] = coerce(fields[name]!, field.kind);
  }
  return undefined;
}

/**
 * Apply one `add`/`remove`/`update` to `dna`, returning the new document and the minimal text edit that
 * expresses it — or a refusal message the caller reports at exit `1` (`spec-005` §1, as ruled on
 * `bug-076`: a well-formed invocation that fails on the content is a logic error, not a usage error).
 *
 * Every refusal names what failed and, where there is one, the verb that would have worked — the whole
 * point of `bug-083`'s repair is that `dna set team.members '[…]'` used to fail with
 * `expected array, received string` from a schema re-validation, which says nothing about how to reach
 * the field.
 *
 * `schemaRoot` is passed straight to `resolveDnaPath` and defaults to `DnaYaml` there — the only schema
 * any caller uses. It is a parameter for the same reason: the semantics below are a function of *a*
 * schema (which field kinds exist, which are required), so they stay exercisable against shapes
 * `spec-002` does not declare today rather than resting on an untested claim.
 */
export function applyDnaMutation(
  dna: Record<string, unknown>,
  request: DnaMutationRequest,
  schemaRoot?: z.ZodType,
): DnaMutationResult {
  const resolved = resolveDnaPath(dna, request.field, schemaRoot);
  if (!resolved.ok) return refuse(resolved.message);

  const target = resolved.target;
  const fields = request.fields ?? {};
  const next = clone(dna);

  switch (target.kind) {
    case 'section':
      return refuse(
        `'${request.field}' is a section of dna.yaml, not a field: name a field inside it (for example '${request.field}.<field>')`,
      );
    case 'collection':
      return mutateCollection(next, target, request, fields);
    case 'entry':
      return mutateEntry(next, target, request, fields);
    case 'string-list':
      return mutateStringList(next, target, request);
    case 'scalar':
      return mutateScalar(next, target, request);
  }
}

/** The path ends at an array of objects: `add` creates an entry, `remove` drops one, `update` amends one. */
function mutateCollection(
  next: Record<string, unknown>,
  target: DnaPathTarget,
  request: DnaMutationRequest,
  fields: Readonly<Record<string, string>>,
): DnaMutationResult {
  const name = request.value;
  if (name === undefined || name.length === 0) {
    return refuse(`--value is required at '${target.path}': it names the entry (dl-081: --value is the entry's identity at a collection)`);
  }
  const { items } = listAt(next, target);
  const index = items.findIndex((entry) => isRecord(entry) && entry.name === name);
  const declared = target.entryFields ?? [];

  if (request.verb === 'add') {
    if (index >= 0) {
      return refuse(`'${target.path}' already carries an entry named '${name}' — entry names are unique (dl-081); use \`dna update\` to change it`);
    }
    const entry: Record<string, unknown> = { name };
    const failure = applyFields(entry, fields, declared, target.path);
    if (failure !== undefined) return refuse(failure);
    const missing = declared
      .filter((field) => field.required && field.name !== 'name' && entry[field.name] === undefined)
      .map((field) => `--${dnaEntryOptionName(field.name)}`);
    if (missing.length > 0) {
      return refuse(`an entry of '${target.path}' requires ${missing.join(', ')}`);
    }
    const ordered = orderBySchema(entry, declared);
    items.push(ordered);
    return { ok: true, dna: next, edit: { kind: 'append-items', path: textPath(next, target), items: [ordered] } };
  }

  if (index < 0) {
    return refuse(`no entry named '${name}' in '${target.path}'`);
  }

  if (request.verb === 'remove') {
    items.splice(index, 1);
    return { ok: true, dna: next, edit: { kind: 'remove-items', path: textPath(next, target), indexes: [index] } };
  }

  if (Object.keys(fields).length === 0) {
    const known = declared.filter((field) => field.name !== 'name').map((field) => `--${dnaEntryOptionName(field.name)}`);
    return refuse(`\`dna update ${target.path} --value ${name}\` carries no change: pass one of ${known.join(', ')}`);
  }
  const entry = items[index] as Record<string, unknown>;
  const failure = applyFields(entry, fields, declared, target.path);
  if (failure !== undefined) return refuse(failure);
  return { ok: true, dna: next, edit: entryFieldEdit(next, target, index, fields, declared) };
}

/** The path ends at one entry (`modules.core`): the path already says which, so `--value` would repeat it. */
function mutateEntry(
  next: Record<string, unknown>,
  target: DnaPathTarget,
  request: DnaMutationRequest,
  fields: Readonly<Record<string, string>>,
): DnaMutationResult {
  const collectionPath = target.collectionPath!;
  const name = target.segments[target.segments.length - 1]!;
  if (request.verb === 'add') {
    return refuse(`'${target.path}' already exists: \`dna add ${collectionPath} --value <name>\` creates a new entry, \`dna update\` changes this one`);
  }
  if (request.value !== undefined) {
    return refuse(`--value says nothing the path '${target.path}' has not already said: drop it, or address the collection with \`${collectionPath} --value ${name}\``);
  }

  // The collection resolved on the way to the entry, so this re-resolution against the clone cannot
  // fail; it is done rather than threaded through because the clone's array is a different object.
  const collection = resolveDnaPath(next, collectionPath);
  if (!collection.ok) return refuse(collection.message);
  const { items } = listAt(next, collection.target);
  const index = target.entryIndex!;

  if (request.verb === 'remove') {
    items.splice(index, 1);
    return { ok: true, dna: next, edit: { kind: 'remove-items', path: textPath(next, collection.target), indexes: [index] } };
  }

  const declared = target.entryFields ?? [];
  if (Object.keys(fields).length === 0) {
    const known = declared.filter((field) => field.name !== 'name').map((field) => `--${dnaEntryOptionName(field.name)}`);
    return refuse(`\`dna update ${target.path}\` carries no change: pass one of ${known.join(', ')}`);
  }
  const entry = items[index] as Record<string, unknown>;
  const failure = applyFields(entry, fields, declared, collectionPath);
  if (failure !== undefined) return refuse(failure);
  return { ok: true, dna: next, edit: entryFieldEdit(next, collection.target, index, fields, declared) };
}

/** The path ends at an array of strings: `add` appends, `remove` drops, `update` replaces the list. */
function mutateStringList(next: Record<string, unknown>, target: DnaPathTarget, request: DnaMutationRequest): DnaMutationResult {
  if (request.value === undefined) {
    return refuse(`--value is required at '${target.path}'`);
  }
  const values = splitList(request.value);
  if (values.length === 0) {
    return refuse(`--value is required at '${target.path}'`);
  }
  const { items } = listAt(next, target);
  const path = textPath(next, target);

  if (request.verb === 'update') {
    items.splice(0, items.length, ...values);
    return { ok: true, dna: next, edit: { kind: 'replace-list', path, items: values } };
  }

  if (request.verb === 'add') {
    for (const value of values) {
      if (items.includes(value)) return refuse(`'${target.path}' already contains '${value}'`);
    }
    items.push(...values);
    return { ok: true, dna: next, edit: { kind: 'append-items', path, items: values } };
  }

  const indexes: number[] = [];
  for (const value of values) {
    const index = items.indexOf(value);
    if (index < 0) return refuse(`'${target.path}' does not contain '${value}'`);
    indexes.push(index);
  }
  const removed = new Set(indexes);
  const kept = items.filter((_item, index) => !removed.has(index));
  items.splice(0, items.length, ...kept);
  return { ok: true, dna: next, edit: { kind: 'remove-items', path, indexes: [...indexes].sort((a, b) => a - b) } };
}

/** The path ends at a single value: `update` writes it, `remove` drops it when the schema allows, `add` does not apply. */
function mutateScalar(next: Record<string, unknown>, target: DnaPathTarget, request: DnaMutationRequest): DnaMutationResult {
  const key = target.segments[target.segments.length - 1]!;
  const container = containerFor(next, target.segments) as Record<string, unknown>;

  if (request.verb === 'add') {
    return refuse(`'${target.path}' holds a single value: use \`dna update ${target.path} --value <v>\` (or \`dna set ${target.path} --value <v>\`)`);
  }
  if (request.verb === 'remove') {
    if (target.required) {
      return refuse(`'${target.path}' is required by the dna.yaml schema and cannot be removed`);
    }
    if (!(key in container)) {
      return refuse(`'${target.path}' is not set, so there is nothing to remove`);
    }
    delete container[key];
    return { ok: true, dna: next, edit: { kind: 'delete-key', path: textPath(next, target) } };
  }
  if (request.value === undefined) {
    return refuse(`--value is required at '${target.path}'`);
  }
  container[key] = request.value;
  return { ok: true, dna: next, edit: { kind: 'set-scalar', path: textPath(next, target), value: request.value } };
}

/** Rewrite an entry's keys into schema order, so the same call always renders the same bytes (REQ-SYS-07). */
function orderBySchema(entry: Record<string, unknown>, declared: readonly DnaEntryField[]): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const field of declared) {
    if (entry[field.name] !== undefined) ordered[field.name] = entry[field.name];
  }
  for (const key of Object.keys(entry)) {
    if (ordered[key] === undefined) ordered[key] = entry[key];
  }
  return ordered;
}

/** One `set-scalar` per changed entry field, batched — the text editor applies them in order. */
function entryFieldEdit(
  dna: Record<string, unknown>,
  collection: DnaPathTarget,
  index: number,
  fields: Readonly<Record<string, string>>,
  declared: readonly DnaEntryField[],
): DnaTextEdit {
  const base = [...textPath(dna, collection), { index }];
  const edits: DnaTextEdit[] = Object.keys(fields).map((name) => {
    const field = declared.find((candidate) => candidate.name === name);
    return {
      kind: 'set-scalar' as const,
      path: [...base, { key: name }],
      value: coerce(fields[name]!, field?.kind ?? 'string'),
    };
  });
  return edits.length === 1 ? edits[0]! : { kind: 'batch', edits };
}
