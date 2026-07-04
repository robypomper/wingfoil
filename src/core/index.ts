/**
 * `core` module — shared domain logic; single behavior behind both the CLI and MCP surfaces
 * (REQ-SYS-05). Exposes one loader per Project pillar (task-004-decoupled-pillars, REQ-SYS-02):
 * `loadMemoryYaml`, `loadDnaYaml`, `loadWorkflowsYaml`, `loadDirectives` — each independently reads
 * and validates only its own pillar's artifact(s), so editing one pillar's config never requires
 * touching another's loader.
 *
 * task-006-dual-interface-shared-core adds the `CoreModule` registry (spec-006-core-domain-api):
 * `CORE_MODULES` below is the single array `src/cli` and `src/mcp` both derive their surfaces
 * from. It is intentionally small today — see the SCOPE note on `CORE_MODULES` — the full
 * memory/dna/directives/workflow domain-operation tables in spec-006 §3 (`memoryAdd`, `dnaSet`,
 * `directiveCreate`, ...) are feature work for task-018..030, not this task.
 */
import { ValidationError } from '../validation';
import type { DnaYaml } from '../dna/schema';

import {
  loadDirectives,
  loadDnaYaml,
  loadWorkflowsYaml,
  type DirectiveFile,
  type WorkflowsLoadResult,
} from './loaders';
import type { CoreFn, CoreModule } from './registry';
import { coreErr, coreOk } from './types';

export const MODULE_NAME = 'core' as const;

export {
  loadDirectives,
  loadDnaYaml,
  loadMemoryYaml,
  loadWorkflowsYaml,
} from './loaders';
export type { DirectiveFile, WorkflowsLoadResult } from './loaders';
export * from './types';
export * from './registry';

/** Params shared by every operation registered today — all of them are a bare pillar-config read. */
export interface RootParams {
  readonly root: string;
}

/**
 * Adapt a synchronous, throwing pillar loader (task-004's `load*` functions) into a `CoreFn`
 * (spec-006 §2): expected failures (`ValidationError` from the shared two-pass pipeline; a missing
 * file, surfaced by Node as `ENOENT`) become `CoreResult.error`; anything else propagates as a
 * genuine thrown exception (a programmer bug, not a domain failure — spec-006 §2's "no function
 * throws for *expected* domain failures" implies unexpected ones still may).
 */
function wrapReadOnly<R>(loader: (root: string) => R): CoreFn<unknown, R> {
  return async (params) => {
    const { root } = params as RootParams;
    try {
      return coreOk(loader(root));
    } catch (error) {
      if (error instanceof ValidationError) {
        return coreErr({ code: 'VALIDATION', message: error.message, details: { issues: error.issues } });
      }
      const errno = error as NodeJS.ErrnoException;
      if (errno && errno.code === 'ENOENT') {
        return coreErr({ code: 'NOT_FOUND', message: errno.message });
      }
      throw error;
    }
  };
}

/**
 * The production `CoreModule` registry (spec-006 §2, §4). `src/cli`'s command registrar and
 * `src/mcp`'s Tool/Resource registrar both import this exact array — see spec-006 §4.1: "no
 * duplicated or hand-copied operation list in either surface module".
 *
 * SCOPE (task-006-dual-interface-shared-core, see the task's Execution Notes for the full
 * rationale): only the core functions that already legitimately exist are wired in here today —
 * task-004's three read-only per-pillar loaders that have a natural spec-006 §3 counterpart
 * (`dnaShow`, `directivesList`, `workflowList` — all `mutates: false`). `loadMemoryYaml` is
 * deliberately NOT registered as a `memory` module operation: it loads the Memory *pillar's own
 * config* (`memory.yaml`'s types/state-machines), a different concept from spec-006 §3's `memory`
 * module (which operates on Memory *documents* — `memoryAdd`, `memorySearch`, ...); registering it
 * under a `memoryXxx` name would misrepresent it as the latter. There is intentionally zero
 * mutating operation in production today — none of spec-006 §3's actual mutating functions
 * (`memoryAdd`, `dnaSet`, `directiveCreate`, `workflowStart`, ...) are implemented yet; that is
 * task-018..030's scope, not this task's. The REQ-SYS-05 parity test in `test/core/parity.test.ts`
 * runs against this exact array, so it becomes a real regression guard the moment a mutating
 * operation is added here — today it legitimately reports 0 mutating ops on both surfaces.
 */
export const CORE_MODULES: readonly CoreModule[] = [
  {
    name: 'dna',
    operations: {
      dnaShow: { name: 'dnaShow', mutates: false, fn: wrapReadOnly<DnaYaml>(loadDnaYaml) },
    },
  },
  {
    name: 'directives',
    operations: {
      directivesList: {
        name: 'directivesList',
        mutates: false,
        fn: wrapReadOnly<DirectiveFile[]>(loadDirectives),
      },
    },
  },
  {
    name: 'workflow',
    operations: {
      workflowList: {
        name: 'workflowList',
        mutates: false,
        fn: wrapReadOnly<WorkflowsLoadResult>(loadWorkflowsYaml),
      },
    },
  },
];
