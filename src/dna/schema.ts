/**
 * DnaYaml schema (spec-002-dna-yaml-schema) — the Project DNA structural map (P2.4). This is one of
 * the three independent per-pillar schemas task-004-decoupled-pillars keeps decoupled (REQ-SYS-02):
 * it has no dependency on `memory.yaml`'s or `workflows.yaml`'s schema, and its own validation never
 * inspects any other file.
 *
 * Every object node is `.passthrough()` per spec-009-validation-strategy §2. The TypeScript type is
 * derived exclusively via `z.infer` (spec-002: "no hand-written duplicate interface").
 */
import { z } from 'zod';

/** `project:` — free-form project-identity block (name, description, license, north-star, ...); every field optional. */
export const Project = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    license: z.string().optional(),
    repository: z.string().optional(),
    methodology: z.string().optional(),
    north_star: z.string().optional(),
  })
  .passthrough();
/** Parsed shape of the {@link Project} schema. */
export type Project = z.infer<typeof Project>;

/** One `modules[]` entry — a source module (`name`, optional `description`/`path`). */
export const Module = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    path: z.string().optional(),
  })
  .passthrough();
/** Parsed shape of the {@link Module} schema. */
export type Module = z.infer<typeof Module>;

/** `category` is a free string, not a fixed enum (spec-002) — keeps the schema project-shape-agnostic. */
export const TechEntry = z
  .object({
    name: z.string(),
    category: z.string(),
    version: z.string().optional(),
    notes: z.string().optional(),
  })
  .passthrough();
export type TechEntry = z.infer<typeof TechEntry>;

/** One `stacks.methodologies[]` entry — a development methodology (`name`, optional `phase`/`notes`). */
export const MethodologyEntry = z
  .object({
    name: z.string(),
    phase: z.string().optional(),
    notes: z.string().optional(),
  })
  .passthrough();
/** Parsed shape of the {@link MethodologyEntry} schema. */
export type MethodologyEntry = z.infer<typeof MethodologyEntry>;

/** Replaces the old fixed-key `tech_stack` object with two flat, generically-shaped lists. */
export const Stacks = z
  .object({
    technologies: z.array(TechEntry).optional(),
    methodologies: z.array(MethodologyEntry).optional(),
  })
  .passthrough();
export type Stacks = z.infer<typeof Stacks>;

/** One `team.members[]` entry — a human contributor and the `roles` they hold (validated against `team.roles`). */
export const TeamMember = z
  .object({
    name: z.string(),
    email: z.string().optional(),
    roles: z.array(z.string()),
  })
  .passthrough();
/** Parsed shape of the {@link TeamMember} schema. */
export type TeamMember = z.infer<typeof TeamMember>;

/** One `team.agents[]` entry — an AI agent, the roles it `executes_as`, and whether it may hold `approval_authority` (REQ-SEC-03). */
export const AgentEntry = z
  .object({
    name: z.string(),
    executes_as: z.array(z.string()),
    approval_authority: z.boolean().optional(),
  })
  .passthrough();
/** Parsed shape of the {@link AgentEntry} schema. */
export type AgentEntry = z.infer<typeof AgentEntry>;

/** One `team.roles[]` entry — a role in the canonical role catalogue (REQ-SYS-08). */
export const RoleEntry = z
  .object({
    name: z.string(),
    description: z.string().optional(),
  })
  .passthrough();
/** Parsed shape of the {@link RoleEntry} schema. */
export type RoleEntry = z.infer<typeof RoleEntry>;

/**
 * `team.roles` is the canonical role catalogue (REQ-SYS-08); every role name referenced by
 * `members[].roles` and `agents[].executes_as` is semantically validated against it (spec-002 "Role
 * binding (REQ-SYS-08)"). This is a same-document cross-field rule, so — per spec-009 §1's guidance
 * that such rules "cannot be expressed as a per-field Zod .regex()/.min()" — it runs as a
 * `.superRefine()` here, still inside the Zod schema.
 */
export const Team = z
  .object({
    members: z.array(TeamMember),
    agents: z.array(AgentEntry).optional(),
    roles: z.array(RoleEntry),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const knownRoles = new Set(value.roles.map((role) => role.name));

    value.members.forEach((member, memberIndex) => {
      member.roles.forEach((roleName, roleIndex) => {
        if (!knownRoles.has(roleName)) {
          ctx.addIssue({
            code: 'custom',
            message: `team.members[${memberIndex}].roles references undefined role "${roleName}" (not in team.roles)`,
            path: ['members', memberIndex, 'roles', roleIndex],
          });
        }
      });
    });

    (value.agents ?? []).forEach((agent, agentIndex) => {
      agent.executes_as.forEach((roleName, roleIndex) => {
        if (!knownRoles.has(roleName)) {
          ctx.addIssue({
            code: 'custom',
            message: `team.agents[${agentIndex}].executes_as references undefined role "${roleName}" (not in team.roles)`,
            path: ['agents', agentIndex, 'executes_as', roleIndex],
          });
        }
      });
    });
  });
export type Team = z.infer<typeof Team>;

/** Category names are fixed per P2.5, but `.passthrough()` tolerates a future extra category. */
export const Paths = z
  .object({
    sources: z.array(z.string()).optional(),
    tests: z.array(z.string()).optional(),
    docs: z.array(z.string()).optional(),
    config: z.array(z.string()).optional(),
    governance: z.array(z.string()).optional(),
  })
  .passthrough();
export type Paths = z.infer<typeof Paths>;

/** The whole `.wingfoil/dna.yaml` document (P2.4, spec-002) — the Project DNA structural map's root schema. */
export const DnaYaml = z
  .object({
    version: z.number().positive(),
    project: Project.optional(),
    modules: z.array(Module),
    stacks: Stacks,
    team: Team,
    paths: Paths,
  })
  .passthrough();
/** Parsed shape of the {@link DnaYaml} schema — the type every DNA reader (`loadDnaYaml`, `dna show`) returns. */
export type DnaYaml = z.infer<typeof DnaYaml>;
