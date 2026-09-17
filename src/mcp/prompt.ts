/**
 * The role-scoped MCP **Prompts** channel — `{role}-session` prompts that embed the role's assigned
 * directives (task-039-mcp-prompts-role-based-infra, **REQ-INT-02**,
 * `spec-004-mcp-surface-contract` §3). This is the third and last channel type spec-004 §1 names,
 * alongside the Resources channel (`./index.ts`'s `registerReadOnlyResources`, task-011/task-030) and
 * the still-unshipped Tools channel (P5.2.3, v0.4).
 *
 * **Wired into the production server by `task-058-mcp-prompts-role-based` (P5.2.2).** task-039
 * shipped this registrar as infra, exactly like `task-011-mcp-resources-read-only` did for Resources;
 * task-058 adds it to `createMcpServer` (`./server.ts`) per `spec-014-mcp-server-entry-point` §3
 * ("when Prompts ship (P5.2.2, v0.2), it adds their registrar") and implements the undefined-role
 * refusal of `p5-interaction/P5.2.2-mcp-prompts.feature` (`no prompt for undefined role '<role>'`).
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
import { ErrorCode, GetPromptRequestSchema, ListPromptsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

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
 * A `prompts/get` refusal whose JSON-RPC error carries `message` **verbatim** with code `InvalidParams`
 * (-32602, the code the MCP SDK itself uses for an unknown prompt name).
 *
 * Deliberately a plain `Error` with a `code`, not the SDK's `McpError`: `McpError`'s constructor
 * prefixes its own message with `MCP error <code>: `, and the SDK serializes `error.message` as-is, so a
 * client — which adds that prefix again when it rebuilds the error — would read the prefix twice.
 */
function promptRequestError(message: string): Error {
  return Object.assign(new Error(message), { code: ErrorCode.InvalidParams });
}

/**
 * The P5.2.2 undefined-role refusal, verbatim from `p5-interaction/P5.2.2-mcp-prompts.feature`
 * (Scenario "Error - requesting a prompt for an undefined role"): `no prompt for undefined role '<role>'`.
 */
function undefinedRolePromptError(role: string): Error {
  return promptRequestError(`no prompt for undefined role '${role}'`);
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
 * Build the `prompts/get` result for `role`: resolve its directives against the project **now**
 * (spec-004 §3.2 — per request, never cached from server boot) and compose them into one message.
 *
 * `resolveRoleDirectives` also returns operator diagnostics (`warnings`, e.g. dl-029's "no directives
 * assigned to role 'intern'"); they are **not** embedded in the prompt. spec-004 §3.2 defines the
 * prompt payload as role header + directive blocks, and folding a diagnostic into agent-facing
 * instruction text would put an unratified string into the payload — the same reasoning
 * `src/core/context.ts` gives for keeping its own warnings out of the serialized context envelope.
 */
function buildRolePrompt(root: string, role: string): GetPromptResult {
  const { directives } = resolveRoleDirectives(loadDirectives(root), loadRolesYaml(root), role);
  const text = composeRolePromptText(
    role,
    directives.map((file) => ({ id: file.frontmatter.id, body: readDirectiveBody(root, file) })),
  );
  // MCP's `PromptMessage.role` is the two-value enum `"user" | "assistant"` (the SDK's
  // `PromptMessageSchema`), so spec-004 §3.2's illustrative `role: "system"` is not representable on
  // this protocol by any conformant server; `user` is the only wire role that can deliver
  // instructional content. Open as `dl-039-spec-004-prompt-example-corrections`.
  return { messages: [{ role: 'user', content: { type: 'text', text } }] };
}

/**
 * Register one `{role}-session` Prompt per role in `dna.yaml`'s `team.roles` catalogue (spec-004
 * §3.1), each resolving and embedding that role's directives at request time (§3.2), and refusing a
 * session prompt for a role DNA does not declare (P5.2.2's undefined-role scenario).
 *
 * The two reads happen at deliberately different times, because spec-004 asks for different things:
 *
 * - **The role set is read once, here.** §3.1: "`prompts/list` returns this fixed set derived from DNA
 *   at server start — it is not hand-maintained." So `loadDnaYaml` runs during registration; a role
 *   added to `dna.yaml` afterwards is advertised by the next server, not this one, and is "undefined"
 *   to this one. A missing or invalid `dna.yaml` therefore fails loudly at construction rather than
 *   producing a server with a silently empty Prompts channel.
 * - **Directives are resolved per request, in the handler** — see {@link buildRolePrompt}. That is
 *   the second half of REQ-INT-02's Fit Criterion ("a newly assigned directive appears on the next
 *   session start").
 *
 * **Why the low-level handlers, not `McpServer.registerPrompt`** (task-058). The high-level API
 * answers an unregistered name with its own `Prompt <name> not found` before any WingFoil code runs,
 * so the BDD's `no prompt for undefined role 'wizard'` cannot be expressed through it. This function
 * therefore owns `prompts/list` and `prompts/get` on `server.server` — the same pattern
 * `./read-only.ts`'s `registerWriteRefusalHandler` uses — and a later `registerPrompt` on the same
 * server fails loudly ("A request handler for prompts/list already exists") instead of being silently
 * shadowed. A requested name that is not `{role}-session`-shaped keeps the SDK-equivalent
 * `Prompt <name> not found` wording: it names no role, so it is not an undefined-role request.
 *
 * Call before the server is connected (MCP capabilities cannot be registered after connecting).
 */
export function registerRolePrompts(server: McpServer, options: RegisterRolePromptsOptions): void {
  const roles = new Set(loadDnaYaml(options.resolveRoot()).team.roles.map(({ name }) => name));
  const prompts = [...roles].map((role) => ({
    name: roleSessionPromptName(role),
    description: `session instructions for the '${role}' role, embedding its assigned directives (read-only)`,
  }));

  server.server.registerCapabilities({ prompts: {} });
  server.server.setRequestHandler(ListPromptsRequestSchema, () => ({ prompts }));
  server.server.setRequestHandler(GetPromptRequestSchema, (request) => {
    const { name } = request.params;
    if (!name.endsWith(ROLE_PROMPT_NAME_SUFFIX)) {
      throw promptRequestError(`Prompt ${name} not found`);
    }
    const role = name.slice(0, -ROLE_PROMPT_NAME_SUFFIX.length);
    if (!roles.has(role)) throw undefinedRolePromptError(role);
    return buildRolePrompt(options.resolveRoot(), role);
  });
}
