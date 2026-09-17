/**
 * The role-scoped MCP **Prompts** channel — `{role}-session` prompts that embed the role's assigned
 * directives (task-039-mcp-prompts-role-based-infra, **REQ-INT-02**,
 * `spec-004-mcp-surface-contract` §3). This is the third and last channel type spec-004 §1 names,
 * alongside the Resources channel (`./index.ts`'s `registerReadOnlyResources`, task-011/task-030) and
 * the still-unshipped Tools channel (P5.2.3, v0.4).
 *
 * **Scope — registrar only.** Exactly like `task-011-mcp-resources-read-only` did for Resources, this
 * task ships the registrar and its contract; it does **not** wire it into the production
 * `createMcpServer` (`./server.ts`). That wiring is `spec-014-mcp-server-entry-point` §3's explicit
 * assignment to P5.2.2 ("when Prompts ship (P5.2.2, v0.2), it adds their registrar") and therefore
 * belongs to `task-058-mcp-prompts-role-based`, which `depends_on` this task and also owns the BDD
 * scenarios of `p5-interaction/P5.2.2-mcp-prompts.feature` — including that feature's undefined-role
 * error string, which neither REQ-INT-02's Fit Criterion nor spec-004 §3 defines and which is
 * consequently not invented here.
 *
 * **Read-only (spec-004 §3.3).** A prompt handler reads `dna.yaml`, `roles.yaml` and the directive
 * files and returns text. There is no code path in this module that writes, and it registers no Tool —
 * so Prompts cannot become the agent write path REQ-SEC-05 reserves for validated Tools
 * (`test/mcp/role-prompts.test.ts` asserts both: files byte-for-byte unchanged after a round trip, and
 * `tools/list` still unroutable on a Prompts-only server).
 *
 * **Nothing is re-implemented here.** Role catalogue via `loadDnaYaml`, bindings via `loadRolesYaml`,
 * directive files via `loadDirectives`, and the role → directive resolution itself via
 * `resolveRoleDirectives` (`src/core/context.ts`, task-037) — the same canonical resolver
 * `assembleExecutionContext` uses, so REQ-INT-02's "100% of R's currently assigned directives" and
 * REQ-STATE-05's "100% of the role's directives and 0 of another role's" stay one guarantee rather than
 * two that can drift apart. The only thing that resolver does not supply is a directive's **body**
 * (`loadDirectives` returns `{path, frontmatter}`), which {@link readDirectiveBody} reads with the
 * `storage` primitives `./memory-resource.ts` already uses for the same reason.
 */
import { join } from 'path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { loadDirectives, loadDnaYaml, loadRolesYaml, resolveRoleDirectives } from '../core';
import type { DirectiveFile } from '../core';
import { readDocument, splitFrontmatter, WINGFOIL_DIR } from '../storage';

/** Options for {@link registerRolePrompts}. */
export interface RegisterRolePromptsOptions {
  /**
   * Resolves the project root each `prompts/get` is served from — invoked per request by the prompt
   * handlers, and once by {@link registerRolePrompts} itself to read the DNA role catalogue (see
   * that function's note on the two different timings spec-004 §3.1 and §3.2 mandate).
   */
  readonly resolveRoot: () => string;
}

/** spec-004 §3.1's prompt-name suffix: one prompt per role, named `{role}-session`. Module-local —
 * {@link roleSessionPromptName} is the only naming API this channel exposes. */
const ROLE_PROMPT_NAME_SUFFIX = '-session';

/**
 * `{role}-session` — spec-004 §3.1's prompt naming convention, as a function so the wire-visible name
 * is derived in exactly one place (the registrar here, and any later consumer such as
 * `task-058-mcp-prompts-role-based`) rather than spelled out per call site.
 */
export function roleSessionPromptName(role: string): string {
  return `${role}${ROLE_PROMPT_NAME_SUFFIX}`;
}

/**
 * Read one directive file's body — everything after its YAML frontmatter block, trimmed of
 * surrounding blank lines so the composed prompt is a pure function of the file's content and not of
 * how many trailing newlines its author happened to leave (REQ-SYS-07).
 *
 * `file.path` is root-relative to `.wingfoil/` (`loadDirectives` stores it as `directives/<...>.md`),
 * so it is resolved against `<root>/.wingfoil` here. A file with no frontmatter block cannot reach
 * this function — `loadDirectives` rejects that case with `E_MISSING_FRONTMATTER` before any
 * directive is returned — but `splitFrontmatter` degrades to "whole document is body" anyway.
 */
function readDirectiveBody(root: string, file: DirectiveFile): string {
  return splitFrontmatter(readDocument(join(root, WINGFOIL_DIR, file.path))).body.trim();
}

/** One directive as it appears in a composed prompt: the `id` the `## Directive:` heading names and
 * the body text that follows it. */
interface RolePromptDirectiveBlock {
  readonly id: string;
  readonly body: string;
}

/**
 * Compose the prompt text for `role` from its already-resolved directives — spec-004 §3.2's shape: a
 * `# Role: {role}` header followed by one `## Directive: {id}` block per directive, each carrying that
 * directive's full body.
 *
 * The heading uses `frontmatter.id`, not `name`: spec-004 §3.2's own example headings read
 * `## Directive: code-quality` / `security-secrets`, which are the `id` values of the real directive
 * files (`code-quality.md` carries `id: code-quality`, `name: "Code Quality"`), and `roles.yaml` binds
 * by id.
 *
 * Block order is `resolveRoleDirectives`' — deduplicated by id and sorted id-ascending per
 * `spec-012-context-loader-relevance-filtering` §5 / REQ-SYS-07 — rather than the "own directives,
 * then globals" grouping spec-004 §3.2's illustrative example happens to print. §3.2 states the
 * resolution itself as a *set* union (`roles.yaml[R].directives` ∪ `global`), which fixes membership,
 * not sequence; an explicit total order is what makes two runs byte-identical.
 */
function composeRolePromptText(role: string, directives: readonly RolePromptDirectiveBlock[]): string {
  const blocks = directives.map(({ id, body }) => `## Directive: ${id}\n${body}`);
  return [`# Role: ${role}`, ...blocks].join('\n\n');
}

/**
 * Register one `{role}-session` Prompt per role in `dna.yaml`'s `team.roles` catalogue (spec-004
 * §3.1), each resolving and embedding that role's directives at request time (§3.2).
 *
 * The two reads happen at deliberately different times, because spec-004 asks for different things:
 *
 * - **The role set is read once, here.** §3.1: "`prompts/list` returns this fixed set derived from DNA
 *   at server start — it is not hand-maintained." So `loadDnaYaml` runs during registration; a role
 *   added to `dna.yaml` afterwards is advertised by the next server, not this one. A missing or
 *   invalid `dna.yaml` therefore fails loudly at construction rather than producing a server with a
 *   silently empty Prompts channel.
 * - **Directives are resolved per request, in the handler.** §3.2: "resolved at session-start time —
 *   not cached from server boot … a directive assigned to R after server start but before the next
 *   `prompts/get("{R}-session")` call MUST appear in that next call's output". That is the second half
 *   of REQ-INT-02's Fit Criterion, and it is why `loadRolesYaml`/`loadDirectives` are called inside the
 *   callback — the same "no server-lifetime cache" contract every Resource in `src/mcp` already follows.
 *
 * `resolveRoleDirectives` also returns operator diagnostics (`warnings`, e.g. dl-029's "no directives
 * assigned to role 'intern'"); they are **not** embedded in the prompt. spec-004 §3.2 defines the
 * prompt payload as role header + directive blocks, and folding a diagnostic into agent-facing
 * instruction text would put an unratified string into the payload — the same reasoning
 * `src/core/context.ts` gives for keeping its own warnings out of the serialized context envelope.
 */
export function registerRolePrompts(server: McpServer, options: RegisterRolePromptsOptions): void {
  const dna = loadDnaYaml(options.resolveRoot());

  for (const { name: role } of dna.team.roles) {
    server.registerPrompt(
      roleSessionPromptName(role),
      { description: `session instructions for the '${role}' role, embedding its assigned directives (read-only)` },
      () => {
        const root = options.resolveRoot();
        const { directives } = resolveRoleDirectives(loadDirectives(root), loadRolesYaml(root), role);
        const text = composeRolePromptText(
          role,
          directives.map((file) => ({ id: file.frontmatter.id, body: readDirectiveBody(root, file) })),
        );
        // MCP's `PromptMessage.role` is the two-value enum `"user" | "assistant"` (the SDK's
        // `PromptMessageSchema`), so spec-004 §3.2's illustrative `role: "system"` is not
        // representable on this protocol by any conformant server. The normative half of §3.2 — the
        // message *content* embedding 100% of the role's directives — is what `text` above carries;
        // `user` is the only wire role that can deliver instructional content. Flagged in this task's
        // Execution Notes as a candidate editorial correction to spec-004 §3.2's example.
        return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] };
      },
    );
  }
}
