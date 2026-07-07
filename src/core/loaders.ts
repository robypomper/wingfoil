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

import { DirectiveFrontmatter } from '../directives/schema';
import { DnaYaml } from '../dna/schema';
import { MemoryYaml } from '../memory/schema';
import { documentExists, extractFrontmatter, readDocument } from '../storage';
import { E_YAML_PARSE_ERROR, parseYaml, runValidation, ValidationError } from '../validation';
import { Workflow, WorkflowsYaml } from '../workflow/schema';

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
  const raw = readDocument(filePath);
  const data = parseYaml(raw, filePath);
  return runValidation(MemoryYaml, data, filePath);
}

/**
 * `js-yaml`'s `YAMLException#message` always embeds the failure position as `(<line>:<column>)`
 * (1-indexed) right after the reason text, ahead of the multi-line context snippet — verified against
 * every `load()` failure shape js-yaml produces (bad indentation, unclosed flow collection, block-
 * mapping/key errors, tab-indentation). `parseYaml` (spec-009-validation-strategy §1) preserves this
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
  const filePath = join(root, '.wingfoil', 'dna.yaml');
  const raw = readDocument(filePath);
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

/** The result of loading the Workflow pillar: the Layer-1 manifest plus every Layer-2 file it includes. */
export interface WorkflowsLoadResult {
  readonly manifest: WorkflowsYaml;
  readonly workflows: readonly Workflow[];
}

/**
 * Load and validate the Workflow pillar in isolation (spec-003-workflows-yaml-schema): Layer 1
 * (`.wingfoil/workflows.yaml`), then every file its `include` list names (Layer 2), resolved
 * relative to `.wingfoil/` per spec-003. Two cross-file Pass-2 checks that need the loaded files
 * themselves (spec-009 §1 "Cross-file" category) run here, not in the schema module:
 *
 * - every `include` path must resolve to a file that actually exists
 *   (`E_WORKFLOW_FILE_NOT_FOUND`, spec-003);
 * - at least one loaded workflow must be `kind: main` (REQ-STATE-03 / spec-003 Layer 1 step 3).
 */
export function loadWorkflowsYaml(root: string): WorkflowsLoadResult {
  const configDir = join(root, '.wingfoil');
  const manifestPath = join(configDir, 'workflows.yaml');
  const manifestRaw = readDocument(manifestPath);
  const manifestData = parseYaml(manifestRaw, manifestPath);
  const manifest = runValidation(WorkflowsYaml, manifestData, manifestPath);

  const workflows: Workflow[] = [];
  for (const includePath of manifest.include) {
    const workflowPath = join(configDir, includePath);
    if (!documentExists(workflowPath)) {
      throw ValidationError.semantic([
        {
          code: 'E_WORKFLOW_FILE_NOT_FOUND',
          path: 'include',
          file: manifestPath,
          message: `included workflow file not found: ${includePath}`,
        },
      ]);
    }
    const raw = readDocument(workflowPath);
    const data = parseYaml(raw, workflowPath);
    workflows.push(runValidation(Workflow, data, workflowPath));
  }

  if (!workflows.some((workflow) => workflow.kind === 'main')) {
    throw ValidationError.semantic([
      {
        code: 'E_NO_MAIN_WORKFLOW',
        path: 'include',
        file: manifestPath,
        message: 'at least one included workflow must be `kind: main` (REQ-STATE-03)',
      },
    ]);
  }

  return { manifest, workflows };
}

/** One Directives pillar file: its root-relative path and its validated frontmatter. */
export interface DirectiveFile {
  readonly path: string;
  readonly frontmatter: DirectiveFrontmatter;
}

/**
 * Load and validate every Directives file in isolation (task-004-decoupled-pillars — see
 * `src/directives/schema.ts` for why this pillar has no dedicated approved tech-spec yet). Reads
 * every `.md` file under `.wingfoil/directives/**` (built-in + custom), sorted deterministically
 * (REQ-SYS-07: no unordered iteration in a context-building path), extracts its frontmatter
 * (`storage.extractFrontmatter`), and validates it against `DirectiveFrontmatter`.
 */
export function loadDirectives(root: string): DirectiveFile[] {
  const directivesDir = join(root, '.wingfoil', 'directives');
  const files: DirectiveFile[] = [];
  for (const relativePath of listMarkdownFilesSorted(directivesDir)) {
    const filePath = join(directivesDir, relativePath);
    const raw = readDocument(filePath);
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
    files.push({ path: join('directives', relativePath), frontmatter });
  }
  return files;
}
