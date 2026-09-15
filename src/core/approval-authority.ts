/**
 * Role-based approval authority (REQ-SEC-03, adr-006-git-identity-role-based-authz —
 * task-040-role-based-approval-authority).
 *
 * adr-006's second point fixes approval authority as role-based, never bound to a named person: a
 * `.wingfoil/dna.yaml` `team.members[]` entry holds one or more `roles` from the canonical
 * `team.roles` catalogue (`src/dna/schema.ts`'s `Team`), and only a member holding the `approver`
 * role may approve a Memory document — uniformly across every type. There is no per-type approver
 * role anywhere in `memory.yaml`/`dna.yaml`: every `approval: { by_role: ... }` step across
 * `.wingfoil/workflows/custom/*.yaml` already gates on the single `approver` role, so this module
 * does the same rather than inventing a per-type mapping no spec defines.
 *
 * "Who is asking" is resolved the same way `requireGitIdentity` (REQ-SEC-01) already establishes
 * attribution: the live git identity configured at the project root (`readGitIdentity`,
 * `./git-identity.ts`) — git identity is WingFoil's sole attribution mechanism (adr-001/adr-006), so
 * authority is checked against the exact same "who" the resulting approval commit will record. This
 * is why `team.agents` is deliberately NOT consulted here: an AI agent has no git identity of its own
 * distinct from whichever human account runs the command, so there is no code-level signal this
 * git-identity-keyed check could use to single an agent out. Structurally preventing agents from
 * holding approval authority is instead a `dna.yaml` fact (`team.agents[].approval_authority: false`)
 * enforced by process/governance (CLAUDE.md §4/§8: "AI agents ... never hold approval authority"), not
 * by this predicate.
 */
import type { DnaYaml } from '../dna/schema';
import { readGitIdentity } from './git-identity';
import { coreErr, coreOk, type CoreResult } from './types';

/** The one role that carries approval authority, uniformly across every Memory type (adr-006). */
export const APPROVER_ROLE = 'approver' as const;

/**
 * The roles held by the `dna.yaml` `team.members[]` entry whose `email` matches `email`
 * (case-insensitively — git identities are free-form and casing is not semantically meaningful),
 * or `[]` when `email` is empty or matches no member. Pure lookup — no git/filesystem access; callers
 * needing the live git identity go through {@link requireApprovalAuthority} or `readGitIdentity`
 * (`./git-identity.ts`) themselves.
 */
export function resolveMemberRoles(dna: DnaYaml, email: string): readonly string[] {
  if (email.length === 0) return [];
  const normalized = email.toLowerCase();
  const member = dna.team.members.find((candidate) => candidate.email?.toLowerCase() === normalized);
  return member?.roles ?? [];
}

/** Whether the `dna.yaml` team member matching `email` holds the {@link APPROVER_ROLE}. */
export function hasApproverRole(dna: DnaYaml, email: string): boolean {
  return resolveMemberRoles(dna, email).includes(APPROVER_ROLE);
}

/**
 * Verify the principal identified by the live git identity at `root` holds the `approver` role
 * before an approval (`memory.approve`, P1.7) proceeds. Returns a `CoreResult.error` (code
 * `VALIDATION` — a failed authorization precondition, mapped to exit `1` by `exitCodeForError`,
 * mirroring `requireGitIdentity`'s own precondition shape) carrying the exact REQ-SEC-03 fit-criterion
 * message `user not authorized to approve type '<type>'` when the git-configured email holds no
 * `approver` role (including when it is unset, or matches no `team.members` entry at all); otherwise
 * `ok`. `typeName` is the Memory element type being approved (e.g. `task`, `adr`) — interpolated into
 * the refusal message only, it plays no role in the authority check itself (§ module doc comment: the
 * `approver` role is uniform across types).
 *
 * Callers (e.g. the future `wingfoil memory approve`, `task-046-memory-approve`) run this AFTER
 * `requireGitIdentity` (REQ-SEC-01) in the same mutating-op pre-flight sequence `dnaSetFn`/
 * `memoryAddFn` (`src/core/index.ts`) already establish — an unconfigured identity should surface as
 * REQ-SEC-01's own message, not this one.
 */
export function requireApprovalAuthority(root: string, dna: DnaYaml, typeName: string): CoreResult<void> {
  const { email } = readGitIdentity(root);
  if (!hasApproverRole(dna, email)) {
    return coreErr({ code: 'VALIDATION', message: `user not authorized to approve type '${typeName}'` });
  }
  return coreOk<void>(undefined);
}
