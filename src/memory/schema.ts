/**
 * MemoryYaml schema (spec-001-memory-yaml-schema) — the Project Memory type registry (P1.13). This
 * is one of the three independent per-pillar schemas task-004-decoupled-pillars keeps decoupled
 * (REQ-SYS-02): it has no dependency on `dna.yaml`'s or `workflows.yaml`'s schema, and its own
 * validation never inspects any other file.
 *
 * Every object node is `.passthrough()` per spec-009-validation-strategy §2 (unknown fields are
 * preserved and warned about, not fatal) — see `src/core/loaders.ts` for the loader that wires this
 * schema through the shared two-pass pipeline.
 */
import { z } from 'zod';

const RESERVED_STATE = 'deprecated';

/**
 * The sequence/gates/waiting state-machine encoding (spec-001 "Sub-schema: StateMachine"),
 * replacing the earlier ambiguous `transitions: {state: [target, ...]}` dict-of-arrays format.
 *
 * The semantic rules from spec-001's "Semantic validation (post-parse)" section are embedded here
 * as a `.superRefine()` — spec-009 §1 frames exactly this kind of same-document, cross-field rule
 * ("a phase's `gates` key must reference a step name that is itself a member of that phase's
 * `sequence` array") as expressible via `.superRefine()`, "still inside the Zod schema, logically
 * Pass 2":
 *
 * - Every key in `gates` and every entry in `waiting` MUST be a member of `sequence`.
 * - A `gates.<state>.reject` target need NOT be a member of `sequence` (it may revert into the
 *   chain or name an off-chain decline state reached by no forward edge).
 * - The literal string `"deprecated"` is reserved: it may not appear in `sequence`, as a `gates`
 *   key, as a `gates.<state>.reject` target, or in `waiting` — it is an implicit wildcard edge to a
 *   reserved state, never declared explicitly.
 */
export const StateMachine = z
  .object({
    sequence: z.array(z.string()).min(1),
    gates: z.record(z.string(), z.object({ reject: z.string() }).passthrough()).optional(),
    waiting: z.array(z.string()).optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const sequenceSet = new Set(value.sequence);

    value.sequence.forEach((state, index) => {
      if (state === RESERVED_STATE) {
        ctx.addIssue({
          code: 'custom',
          message: `"${RESERVED_STATE}" is a reserved implicit state and may not appear in \`sequence\``,
          path: ['sequence', index],
        });
      }
    });

    for (const [state, gate] of Object.entries(value.gates ?? {})) {
      if (state === RESERVED_STATE) {
        ctx.addIssue({
          code: 'custom',
          message: `"${RESERVED_STATE}" is a reserved implicit state and may not be declared as a \`gates\` key`,
          path: ['gates', state],
        });
      } else if (!sequenceSet.has(state)) {
        ctx.addIssue({
          code: 'custom',
          message: `\`gates\` key "${state}" must be a member of \`sequence\``,
          path: ['gates', state],
        });
      }
      if (gate.reject === RESERVED_STATE) {
        ctx.addIssue({
          code: 'custom',
          message: `"${RESERVED_STATE}" is a reserved implicit state and may not be a \`gates.<state>.reject\` target`,
          path: ['gates', state, 'reject'],
        });
      }
      // Note: gate.reject need NOT be a member of `sequence` (spec-001) — no membership check here.
    }

    (value.waiting ?? []).forEach((state, index) => {
      if (state === RESERVED_STATE) {
        ctx.addIssue({
          code: 'custom',
          message: `"${RESERVED_STATE}" is a reserved implicit state and may not be declared in \`waiting\``,
          path: ['waiting', index],
        });
      } else if (!sequenceSet.has(state)) {
        ctx.addIssue({
          code: 'custom',
          message: `\`waiting\` entry "${state}" must be a member of \`sequence\``,
          path: ['waiting', index],
        });
      }
    });
  });
export type StateMachine = z.infer<typeof StateMachine>;

/** `template.frontmatter.required` + the scaffold file path a `memory.add --type <t>` copies. */
export const TemplateConfig = z
  .object({
    frontmatter: z.object({ required: z.array(z.string()) }).passthrough(),
    file: z.string(),
  })
  .passthrough();
export type TemplateConfig = z.infer<typeof TemplateConfig>;

/** One `types.<name>` entry — path pattern, id pattern, human metadata, template, state machine. */
export const MemoryTypeEntry = z
  .object({
    path: z.string(),
    id_pattern: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    template: TemplateConfig.optional(),
    states: StateMachine.optional(), // absent ⇒ `defaults.states` applies (REQ-STATE-08)
  })
  .passthrough();
export type MemoryTypeEntry = z.infer<typeof MemoryTypeEntry>;

/**
 * `memory.yaml`'s top-level shape. `version` is `z.number().positive()`, NOT `.int()` — the file's
 * `version: 1.0` (and `1.1`) is a YAML float and `.int()` would spuriously reject it (spec-001).
 */
export const MemoryYaml = z
  .object({
    version: z.number().positive(),
    defaults: z.object({ states: StateMachine }).passthrough().optional(),
    types: z.record(z.string(), MemoryTypeEntry),
  })
  .passthrough()
  /**
   * Type-contextualized restatement of spec-001's "Semantic validation (post-parse)" membership rule
   * — the P1.13 acceptance contract (task-024-implement-memory-element-schema): a state referenced by
   * a type's machine (a `gates` key or a `waiting` entry) that is NOT one of that type's declared
   * states (`sequence`) is a malformed schema and must be rejected at load time, **before any document
   * of that type can be created or transitioned** (REQ-STATE-01). The `StateMachine` sub-schema's own
   * `.superRefine` already flags the same structural violation, but only this top-level refinement
   * knows the *owning type name*, so P1.13's required wording
   * (`transition target '<state>' not in declared states for type '<type>'`) can only be produced
   * here. `defaults.states` (which has no owning type) is left to the `StateMachine`-level check.
   *
   * `gates.<state>.reject` targets are intentionally NOT checked: spec-001 explicitly allows them to
   * be off-chain ("need **not** be a member of `sequence` ... e.g. `bug`'s `open: { reject: closed }`").
   * Iteration is over insertion-ordered `Object.entries`/`Object.keys` only — no wall-clock, no
   * randomness, no set ordering (REQ-SYS-07 determinism).
   */
  .superRefine((value, ctx) => {
    for (const [typeName, entry] of Object.entries(value.types)) {
      const machine = entry.states;
      if (!machine) continue; // no own machine ⇒ `defaults.states` applies (REQ-STATE-08)
      const sequenceSet = new Set(machine.sequence);

      const flag = (state: string, path: (string | number)[]) => {
        if (state !== RESERVED_STATE && !sequenceSet.has(state)) {
          ctx.addIssue({
            code: 'custom',
            message: `transition target '${state}' not in declared states for type '${typeName}'`,
            path: ['types', typeName, 'states', ...path],
          });
        }
      };

      for (const gateState of Object.keys(machine.gates ?? {})) {
        flag(gateState, ['gates', gateState]);
      }
      (machine.waiting ?? []).forEach((waitState, index) => {
        flag(waitState, ['waiting', index]);
      });
    }
  });
export type MemoryYaml = z.infer<typeof MemoryYaml>;
