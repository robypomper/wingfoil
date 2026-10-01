/**
 * Per-pillar loaders (task-004-decoupled-pillars, REQ-SYS-02). `core` exposes exactly one loader
 * per pillar — `loadMemoryYaml`, `loadDnaYaml`, `loadWorkflowsYaml`, `loadDirectives` — each reading
 * only its own artifact(s) under `.wingfoil/` (spec-011-storage-layout) through the shared two-pass
 * validation pipeline (spec-009-validation-strategy): `storage.readDocument` for bytes,
 * `validation.parseYaml` for the pre-Zod YAML parse, `validation.runValidation` for the Zod
 * structural pass. No loader imports another pillar's schema module, and no loader reads another
 * pillar's file(s) — that is what keeps adding a new Memory `type` (say) from ever requiring a
 * change to `dna.yaml` or `workflows.yaml`, and is the structural guarantee the cross-pillar load
 * test in `test/core/pillar-isolation.test.ts` exercises.
 */
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import { DirectiveFrontmatter, RolesYaml } from '../directives/schema';
import { DnaYaml } from '../dna/schema';
import { MemoryYaml } from '../memory/schema';
import { documentExists, extractFrontmatter, listPathsAtRev, readDocument, readPathAtRev } from '../storage';
import {
  Diagnostic,
  DiagnosticsError,
  E_VALIDATION,
  E_YAML_PARSE_ERROR,
  emitUnknownFieldWarning,
  HasShape,
  parseYaml,
  runValidation,
  ValidationError,
} from '../validation';
import { Workflow, WorkflowsYaml } from '../workflow/schema';

import { indexWorkflowFiles, LoadedWorkflowFile, noStartableDiagnostic, workflowFileDiagnostics } from './workflow-diagnostics';

/**
 * Recursively list every `.md` file under `dir`, as paths relative to `dir`, sorted
 * lexicographically (REQ-SYS-07: no unordered iteration in a context-building path — directory-entry
 * order from `readdirSync` is not guaranteed stable, so traversal always sorts explicitly, mirroring
 * `src/storage/snapshot.ts`'s `listFilesSorted`). Returns `[]` if `dir` doesn't exist.
 */
function listMarkdownFilesSorted(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const out: string[] = [];
  const walk = (current: string, prefix: string): void => {
    for (const entry of readdirSync(current).sort()) {
      const full = join(current, entry);
      const relative = prefix ? `${prefix}/${entry}` : entry;
      if (statSync(full).isDirectory()) {
        walk(full, relative);
      } else if (entry.endsWith('.md')) {
        out.push(relative);
      }
    }
  };
  walk(dir, '');
  return out.sort();
}

/** Load and validate `.wingfoil/memory.yaml` in isolation (spec-001-memory-yaml-schema). */
export function loadMemoryYaml(root: string): MemoryYaml {
  const filePath = join(root, '.wingfoil', 'memory.yaml');
  return parseMemoryYaml(readDocument(filePath), filePath);
}

/**
 * Root-relative POSIX path of `memory.yaml` — the form git wants for a revision read
 * (`<rev>:<path>`), as opposed to the platform `join` every on-disk read uses. Counterpart of
 * {@link DNA_YAML_PATH} (task-091).
 */
export const MEMORY_YAML_PATH = '.wingfoil/memory.yaml' as const;

/**
 * The Memory pillar's two-pass parse, over bytes that may come from anywhere — the working-tree file
 * ({@link loadMemoryYaml}) or a git revision ({@link loadMemoryYamlAtHead}). `filePath` is a label
 * only: it rides every issue this raises, so an error names the baseline it came from
 * (`HEAD:.wingfoil/memory.yaml`, not just a path on disk).
 */
function parseMemoryYaml(raw: string, filePath: string): MemoryYaml {
  return runValidation(MemoryYaml, parseYaml(raw, filePath), filePath);
}

/**
 * Load and validate `.wingfoil/memory.yaml` **as the repository has committed it** — the version at
 * `HEAD` — returning `null` when no commit of the repository contains that path (an untracked
 * `memory.yaml`, or a repository with no commits at all). Same schema and same error shapes as
 * {@link loadMemoryYaml}; only the source of the bytes differs.
 *
 * This is the baseline every Memory **state transition** resolves against
 * (`prepareMemoryTransition`, `./memory-transition.ts`), per
 * `dl-080-which-baseline-each-command-reads` option (B) — *a read that gates an operation resolves
 * against the repository as committed at `HEAD`* — closing
 * `bug-081-memory-yaml-read-from-worktree-fabricates-states`: an uncommitted edit to a type's
 * `sequence` used to decide what transition a verb performed and what `status` it committed, through
 * `memory submit`, which needs no authority at all, and left the element in a status the committed
 * machine rejects, movable by no verb at all.
 *
 * `HEAD` rather than the commit being produced: a transition commit changes only the element path
 * (`verifyCommittedScope`, task-088), so `memory.yaml` at `HEAD` and at the new commit are
 * byte-identical, and `HEAD` is the one available before that commit exists.
 */
export function loadMemoryYamlAtHead(root: string): MemoryYaml | null {
  const raw = readPathAtRev(root, 'HEAD', MEMORY_YAML_PATH);
  if (raw === null) return null;
  return parseMemoryYaml(raw, `HEAD:${MEMORY_YAML_PATH}`);
}

/**
 * `js-yaml`'s `YAMLException#message` always embeds the failure position as `(<line>:<column>)`
 * (1-indexed) right after the reason text, ahead of the multi-line context snippet — verified across
 * the common `load()` failure shapes (bad indentation, unclosed flow collection, block-mapping/key
 * errors, tab-indentation), with a defensive `null` fallback for any that omit it.
 * `parseYaml` (spec-009-validation-strategy §1) preserves this
 * raw message verbatim in the single issue of the `E_YAML_PARSE_ERROR` `ValidationError` it throws.
 * Returns `null` if the position marker isn't found (defensive — no known js-yaml failure omits it).
 */
function extractYamlErrorLine(message: string): number | null {
  const match = /\((\d+):\d+\)/.exec(message);
  return match ? Number(match[1]) : null;
}

/**
 * Load and validate `.wingfoil/dna.yaml` in isolation (spec-002-dna-yaml-schema). On top of the
 * shared two-pass pipeline every pillar loader uses, this re-wraps a YAML-syntax failure into P2.4's
 * own fit criterion (BDD `P2.4-project-dna-config.feature` "Error - malformed YAML in the DNA file"):
 * `invalid DNA: YAML parse error at line <n>`, rather than surfacing the generic `E_YAML_PARSE_ERROR`
 * message every other pillar loader still uses as-is. DNA-scoped only — this does not change
 * `parseYaml`/`ValidationError`'s shared behavior for `memory.yaml`/`workflows.yaml`/directives.
 */
export function loadDnaYaml(root: string): DnaYaml {
  return parseDnaYaml(readDocument(join(root, '.wingfoil', 'dna.yaml')), join(root, '.wingfoil', 'dna.yaml'));
}

/**
 * Root-relative POSIX path of `dna.yaml` — the form git wants for a revision read
 * (`<rev>:<path>`), as opposed to the platform `join` every on-disk read uses (task-090).
 */
export const DNA_YAML_PATH = '.wingfoil/dna.yaml' as const;

/**
 * The DNA pillar's two-pass parse, over bytes that may come from anywhere — the working-tree file
 * ({@link loadDnaYaml}) or a git revision ({@link loadDnaYamlAtHead}). `filePath` is a label only: it
 * rides every issue this raises, so an error names the baseline it came from
 * (`HEAD:.wingfoil/dna.yaml`, not just a path on disk).
 */
function parseDnaYaml(raw: string, filePath: string): DnaYaml {
  let data: unknown;
  try {
    data = parseYaml(raw, filePath);
  } catch (err) {
    if (err instanceof ValidationError && err.issues[0]?.code === E_YAML_PARSE_ERROR) {
      const line = extractYamlErrorLine(err.issues[0].message);
      const message = line !== null ? `invalid DNA: YAML parse error at line ${line}` : 'invalid DNA: YAML parse error';
      throw new ValidationError([{ ...err.issues[0], message }], err.exitCode);
    }
    throw err;
  }
  return runValidation(DnaYaml, data, filePath);
}

/**
 * Load and validate `.wingfoil/dna.yaml` **as the repository has committed it** — the version at
 * `HEAD` — returning `null` when no commit of the repository contains that path (an untracked
 * `dna.yaml`, or a repository with no commits at all). Same schema and same error shapes as
 * {@link loadDnaYaml}; only the source of the bytes differs.
 *
 * Its caller is `requireApprovalAuthority` (`./approval-authority.ts`, task-090 / `bug-079`) —
 * joined by `checkAssignable` (`./directive-assign.ts`, task-091 / `bug-082`), which validates
 * `directive assign`'s `--role` against the same committed catalogue: approval authority is a property of the
 * repository, not of a working tree, so the roles it reads must be roles someone committed.
 * `adr-006-git-identity-role-based-authz`'s own Positive consequence — a fresh clone "reproduces the
 * full audit trail with zero extra infrastructure" — is what fixes the baseline: a clone carries
 * committed state and nothing else, so an `Approver:` line resting on an uncommitted grant is
 * evidence no clone can re-derive.
 *
 * `HEAD` rather than the produced commit: an approval commit changes only the element path
 * (`verifyCommittedScope`, task-088), so `dna.yaml` at `HEAD` and at the commit being produced are
 * byte-identical — the two shapes `bug-079`'s Expected Behavior offers cannot diverge, and `HEAD` is
 * the one available before the commit exists.
 *
 * Deliberately NOT how the working-tree loaders behave — but no longer an exception argued for one
 * read: `dl-080-which-baseline-each-command-reads` is `ready`, ratified as option (B), and **a read
 * that gates an operation resolves at `HEAD`** is now the rule this and {@link loadMemoryYamlAtHead}
 * implement. A read that gates nothing — `dna show`, `paths`, `directives list`, the MCP Resources —
 * still reports the working tree, which is what those exist to do. (`bug-078` is (B)'s write half:
 * a write refuses while its target carries modifications it does not own.)
 */
export function loadDnaYamlAtHead(root: string): DnaYaml | null {
  const raw = readPathAtRev(root, 'HEAD', DNA_YAML_PATH);
  if (raw === null) return null;
  return parseDnaYaml(raw, `HEAD:${DNA_YAML_PATH}`);
}

/** The result of loading the Workflow pillar: the Layer-1 manifest plus every Layer-2 file it includes. */
export interface WorkflowsLoadResult {
  /** `null` when `.wingfoil/workflows.yaml` is absent — an empty registry (spec-003 Layer 1). */
  readonly manifest: WorkflowsYaml | null;
  readonly workflows: readonly Workflow[];
}

/** The manifest's path relative to `.wingfoil/` — the `file` of its diagnostics (spec-003). */
const WORKFLOWS_MANIFEST_FILE = 'workflows.yaml';

/** A Zod issue path as spec-003 spells a diagnostic `path`: `phases[3].include`. */
function diagnosticPath(path: readonly PropertyKey[]): string {
  let out = '';
  for (const segment of path) {
    if (typeof segment === 'number') out += `[${segment}]`;
    else out += out === '' ? String(segment) : `.${String(segment)}`;
  }
  return out;
}

/**
 * One included file's structural (Zod) pass, as diagnostics (spec-003 § "Diagnostics": structural
 * failures keep spec-009's structural codes, except the named `kind` refusal). An empty list means the
 * file is valid and `workflow` is set.
 */
function parseWorkflowFile(
  data: unknown,
  file: string,
  filePath: string,
): { workflow: Workflow | null; diagnostics: Diagnostic[] } {
  const result = Workflow.safeParse(data);
  if (result.success) {
    // The same once-per-file unknown-field warning `runValidation` fires (spec-009 §2).
    emitUnknownFieldWarning(data as Record<string, unknown>, Workflow as unknown as HasShape, filePath);
    return { workflow: result.data, diagnostics: [] };
  }
  const diagnostics = zodDiagnostics(result.error.issues, file).map((diagnostic) =>
    diagnostic.path === 'kind' ? { ...diagnostic, code: 'E_WORKFLOW_INVALID_KIND' } : diagnostic,
  );
  return { workflow: null, diagnostics };
}

/** Zod issues as `E_VALIDATION` diagnostics of `file` (spec-009's structural code). */
function zodDiagnostics(issues: readonly { path: readonly PropertyKey[]; message: string }[], file: string): Diagnostic[] {
  return issues.map((issue) => ({ code: E_VALIDATION, severity: 'error', file, path: diagnosticPath(issue.path), message: issue.message }));
}

/**
 * Parse `raw` as YAML; a parse failure becomes one `E_YAML_PARSE_ERROR` diagnostic of `file` (the
 * spec-009 code, with the parser's message) instead of a throw, so it takes its place in the array.
 */
function parseYamlOrDiagnostic(
  raw: string,
  filePath: string,
  file: string,
): { data: unknown; diagnostic: null } | { data: null; diagnostic: Diagnostic } {
  try {
    return { data: parseYaml(raw, filePath), diagnostic: null };
  } catch (err) {
    if (err instanceof ValidationError && err.issues[0]?.code === E_YAML_PARSE_ERROR) {
      return { data: null, diagnostic: { code: E_YAML_PARSE_ERROR, severity: 'error', file, path: '', message: err.issues[0].message } };
    }
    throw err;
  }
}

/**
 * Load and validate the Workflow pillar in isolation (spec-003-workflows-yaml-schema): Layer 1
 * (`.wingfoil/workflows.yaml`), then every file its `include` list names (Layer 2), resolved
 * relative to `.wingfoil/` per spec-003, then the **loader** rows of spec-003 § "Diagnostics" — the
 * checks that need the loaded files themselves (spec-009 §1 "Cross-file" category), run here rather
 * than in the schema module (`./workflow-diagnostics.ts`, task-136).
 *
 * - An **absent** manifest is an empty registry, with no diagnostic (spec-003 Layer 1).
 * - A manifest that is not YAML, or fails its structural pass, is the whole array: one
 *   `E_YAML_PARSE_ERROR`, or its Zod issues as `E_VALIDATION`, on `workflows.yaml`.
 * - Everything else is collected into one ordered `diagnostics` array (REQ-SYS-07): the manifest's
 *   (`E_WORKFLOW_FILE_NOT_FOUND`, `E_NO_MAIN_WORKFLOW`), then each file in `include` order —
 *   a YAML parse failure (`E_YAML_PARSE_ERROR`) or the structural (Zod) issues, then
 *   workflow-level, then phase-level. If it holds an error, the load throws a
 *   {@link DiagnosticsError}: `VALIDATION`, exit `1`, the first error as the reason and the whole array
 *   attached.
 */
export function loadWorkflowsYaml(root: string): WorkflowsLoadResult {
  const configDir = join(root, '.wingfoil');
  const manifestPath = join(configDir, WORKFLOWS_MANIFEST_FILE);
  if (!documentExists(manifestPath)) return { manifest: null, workflows: [] };
  // A manifest that cannot be read as YAML, or fails its structural pass, names no file to load: its
  // diagnostics are the whole array.
  const manifestData = parseYamlOrDiagnostic(readDocument(manifestPath), manifestPath, WORKFLOWS_MANIFEST_FILE);
  if (manifestData.diagnostic) throw new DiagnosticsError([manifestData.diagnostic]);
  const manifestResult = WorkflowsYaml.safeParse(manifestData.data);
  if (!manifestResult.success) throw new DiagnosticsError(zodDiagnostics(manifestResult.error.issues, WORKFLOWS_MANIFEST_FILE));
  emitUnknownFieldWarning(manifestData.data as Record<string, unknown>, WorkflowsYaml as unknown as HasShape, manifestPath);
  const manifest = manifestResult.data;

  const manifestDiagnostics: Diagnostic[] = [];
  const files: LoadedWorkflowFile[] = [];
  const structural: Diagnostic[][] = [];
  manifest.include.forEach((includePath, position) => {
    const workflowPath = join(configDir, includePath);
    if (!documentExists(workflowPath)) {
      manifestDiagnostics.push({
        code: 'E_WORKFLOW_FILE_NOT_FOUND',
        severity: 'error',
        file: WORKFLOWS_MANIFEST_FILE,
        path: `include[${position}]`,
        message: `included workflow file not found: ${includePath}`,
      });
      return;
    }
    const yaml = parseYamlOrDiagnostic(readDocument(workflowPath), workflowPath, includePath);
    if (yaml.diagnostic) {
      files.push({ file: includePath, workflow: null, rawName: null });
      structural.push([yaml.diagnostic]);
      return;
    }
    const data = yaml.data;
    const parsed = parseWorkflowFile(data, includePath, workflowPath);
    const rawName = (data as { name?: unknown } | null)?.name;
    files.push({ file: includePath, workflow: parsed.workflow, rawName: typeof rawName === 'string' ? rawName : null });
    structural.push(parsed.diagnostics);
  });

  const index = indexWorkflowFiles(files, manifest.include.length - files.length);
  const noStartable = noStartableDiagnostic(files, index);
  if (noStartable) manifestDiagnostics.push(noStartable);

  const diagnostics: Diagnostic[] = [...manifestDiagnostics];
  files.forEach((_, i) => {
    diagnostics.push(...structural[i]!, ...workflowFileDiagnostics(files, index, i));
  });
  if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) throw new DiagnosticsError(diagnostics);

  // Every file is structurally valid once no error was reported.
  return { manifest, workflows: files.map((loaded) => loaded.workflow!) };
}

/** One Directives pillar file: its root-relative path and its validated frontmatter. */
export interface DirectiveFile {
  readonly path: string;
  readonly frontmatter: DirectiveFrontmatter;
}

/**
 * Root-relative POSIX path of the Directives tree — the form git wants for a revision listing, as
 * opposed to the platform `join` every on-disk read uses. Counterpart of {@link DNA_YAML_PATH} /
 * {@link MEMORY_YAML_PATH} for the one pillar whose baseline is a **directory** (task-096).
 */
export const DIRECTIVES_DIR_PATH = '.wingfoil/directives' as const;

/**
 * The Directives pillar's per-file parse, over bytes that may come from anywhere — the working-tree
 * file ({@link loadDirectives}) or a git revision ({@link loadDirectivesAtHead}). `filePath` is a
 * label only: it rides every issue this raises, so an error names the baseline it came from
 * (`HEAD:.wingfoil/directives/custom/x.md`, not just a path on disk). Lifted out so the two loaders
 * cannot drift on what a directive file *is*.
 *
 * @param relativePath - The file's path relative to `.wingfoil/directives/`, POSIX-spelled.
 */
function parseDirectiveFile(raw: string, filePath: string, relativePath: string): DirectiveFile {
  const frontmatterText = extractFrontmatter(raw);
  if (frontmatterText === null) {
    throw ValidationError.semantic([
      {
        code: 'E_MISSING_FRONTMATTER',
        path: '',
        file: filePath,
        message: 'directive file has no frontmatter block',
      },
    ]);
  }
  const data = parseYaml(frontmatterText, filePath);
  const frontmatter = runValidation(DirectiveFrontmatter, data, filePath);
  // `join`, so `DirectiveFile.path` carries the platform separator on both loaders — `requireCustomAsset`
  // and `selectDirectivesById` see one spelling whichever baseline produced the file.
  return { path: join('directives', ...relativePath.split('/')), frontmatter };
}

/**
 * Load and validate every Directives file in isolation (task-004-decoupled-pillars — see
 * `src/directives/schema.ts` for why this pillar has no dedicated approved tech-spec yet). Reads
 * every `.md` file under `.wingfoil/directives/**` (built-in + custom) **in the working tree**,
 * sorted deterministically (REQ-SYS-07: no unordered iteration in a context-building path), extracts
 * its frontmatter (`storage.extractFrontmatter`), and validates it against `DirectiveFrontmatter`.
 *
 * This is the *report* baseline — what the user has now — and it is what `directives list`, context
 * assembly and the MCP Resources read. A read that **gates** a mutation reads
 * {@link loadDirectivesAtHead} instead (`dl-080` (B)).
 */
export function loadDirectives(root: string): DirectiveFile[] {
  const directivesDir = join(root, '.wingfoil', 'directives');
  return listMarkdownFilesSorted(directivesDir).map((relativePath) =>
    parseDirectiveFile(readDocument(join(directivesDir, relativePath)), join(directivesDir, relativePath), relativePath),
  );
}

/**
 * Load and validate every Directives file **as the repository has committed it** — the tree at
 * `HEAD`.
 *
 * This is the inventory a read that gates a mutation resolves against
 * (`checkAssignable`, `./directive-assign.ts`), per `dl-080-which-baseline-each-command-reads` option
 * (B), closing the `assign` half of `bug-086-directive-inventory-read-from-the-worktree`: an
 * untracked directive file used to be bindable, and the committed `roles.yaml` then named a directive
 * present in no commit — a dangling reference by construction, since every other clone gets the
 * binding without the file (REQ-SYS-08's referential integrity, the same way `bug-082` broke it for
 * `--role`).
 *
 * Unlike every other committed-baseline loader, this one needs a **directory listing at a revision**
 * (`storage.listPathsAtRev`, task-096) rather than one `readPathAtRev`: the pillar's members are
 * discovered, not named in advance. That missing primitive is why `task-091` deferred this half.
 *
 * Same schema and same error shapes as {@link loadDirectives}; only the source of the bytes differs.
 *
 * Returns an **array, never `null`**, unlike its three sibling committed-baseline loaders. They read
 * one named file, where "not committed" and "committed but empty" are different facts a caller may
 * need to tell apart; here the two collapse — a `HEAD` that does not resolve (no commits at all) and
 * a `HEAD` that commits no directive file both mean *the repository records no directive*, and both
 * produce the same refusal from the only gate that consults this (`checkAssignable`: every id is
 * unknown). `listPathsAtRev` keeps the distinction for callers that do need it.
 */
export function loadDirectivesAtHead(root: string): DirectiveFile[] {
  const paths = listPathsAtRev(root, 'HEAD', DIRECTIVES_DIR_PATH) ?? [];
  const files: DirectiveFile[] = [];
  for (const path of paths) {
    if (!path.endsWith('.md')) continue;
    const raw = readPathAtRev(root, 'HEAD', path);
    // Unreachable by construction — git has just listed this blob. Reachable only if the ref moved
    // between the two calls, and skipping is the fail-closed answer there: a directive nobody can read
    // is a directive that does not exist, so a binding to it is refused rather than committed.
    if (raw === null) continue;
    files.push(parseDirectiveFile(raw, `HEAD:${path}`, path.slice(DIRECTIVES_DIR_PATH.length + 1)));
  }
  return files;
}

/**
 * Root-relative POSIX path of `roles.yaml` — the form git wants for a revision read (`<rev>:<path>`),
 * as opposed to the platform `join` every on-disk read uses. It lived in `./directive-assign.ts` until
 * task-096 moved it here, beside {@link DNA_YAML_PATH} / {@link MEMORY_YAML_PATH} and beside the
 * committed-baseline reader that uses it; `./directive-assign.ts` now **imports** it like any other
 * caller, and `src/core`'s barrel exports it from here.
 */
export const ROLES_YAML_PATH = '.wingfoil/roles.yaml' as const;

/**
 * Load and validate `.wingfoil/roles.yaml` in isolation (task-037-role-task-scoped-context,
 * REQ-STATE-05's `directive-loader`, P3.2/P3.7 role → directive bindings) — the same shared two-pass
 * pipeline (`readDocument` + `parseYaml` + `runValidation`) every other pillar loader uses, so this
 * pillar's own validation never depends on another pillar's schema (REQ-SYS-02). Consumed by
 * `resolveRoleDirectives`/`assembleExecutionContext` (`./context.ts`) to resolve a role's assigned
 * directives.
 */
export function loadRolesYaml(root: string): RolesYaml {
  const filePath = join(root, '.wingfoil', 'roles.yaml');
  const raw = readDocument(filePath);
  const data = parseYaml(raw, filePath);
  return runValidation(RolesYaml, data, filePath);
}

/**
 * Load and validate `.wingfoil/roles.yaml` **as the repository has committed it** — the version at
 * `HEAD` — returning `null` when no commit contains that path (an untracked `roles.yaml`, a committed
 * deletion of it, or a repository with no commits).
 *
 * This is the baseline REQ-SEC-07 clause (b) is answered from (`checkUnreferenced`,
 * `./directive-assign.ts`), per `dl-080-which-baseline-each-command-reads` option (B), closing the
 * `remove` half of `bug-086-directive-inventory-read-from-the-worktree`: an **uncommitted** deletion
 * of the two `- <id>` lines was enough to delete a directive file the committed `roles.yaml` still
 * bound — on the only verb in the system that destroys an artefact.
 *
 * `null` is not an error and does not fail closed there, unlike `loadDnaYamlAtHead`'s: "is anything
 * still referencing this asset" is a question a missing record *answers*, with "nothing" (which is
 * also how an absent `roles.yaml` has always been read — "no bindings yet", task-051/task-053). A
 * committed `roles.yaml` that does not **validate** is the different case, and that one does refuse.
 */
export function loadRolesYamlAtHead(root: string): RolesYaml | null {
  const raw = readPathAtRev(root, 'HEAD', ROLES_YAML_PATH);
  if (raw === null) return null;
  const label = `HEAD:${ROLES_YAML_PATH}`;
  return runValidation(RolesYaml, parseYaml(raw, label), label);
}
