/** One MCP server entry of `.mcp.json` (`mcpServers.<name>`), reduced to what the check reads. */
export interface McpServerEntry {
  /** The executable spawned. */
  readonly command?: string;
  /** Its arguments. */
  readonly args?: readonly string[];
  /** Extra environment variables for the spawned process. */
  readonly env?: Readonly<Record<string, string>>;
}

/** A `.mcp.json`, reduced to its `mcpServers` map. */
export interface McpConfig {
  /** Registered servers, by name. */
  readonly mcpServers?: Readonly<Record<string, McpServerEntry>>;
}

/** A `package.json`, reduced to the declarations the pinned build lives in. */
export interface McpRegistrationManifest {
  /** Direct development dependencies, by name. */
  readonly devDependencies?: Readonly<Record<string, string>>;
}

/** What the spawned server answered, as {@link evaluateRegistration} judges it. */
export interface McpServerObservation {
  /** `serverInfo.version` from the `initialize` handshake. */
  readonly version: string | undefined;
  /** The channels its capabilities advertise, in {@link MCP_CHANNELS} order. */
  readonly channels: readonly string[];
  /** Per advertised channel, the item count its list request returned, or the error it raised. */
  readonly lists: Readonly<Record<string, number | { readonly error: string }>>;
}

/** Outcome of the check. */
export interface McpRegistrationCheck {
  /** `true` only when the registration names the pinned build and the server answers as declared. */
  readonly ok: boolean;
  /** The verdict, and on failure every defect found. */
  readonly message: string;
}

/** The server name `.mcp.json` registers WingFoil under. */
export const SERVER_NAME: string;
/** The devDependency alias that installs the pinned build (`dl-095` Q1 (a)). */
export const PINNED_ALIAS: string;
/** Every channel an MCP server can advertise that WingFoil implements, in report order. */
export const MCP_CHANNELS: readonly string[];
/** The channel set the pinned build is expected to advertise (`dl-026` re-verification). */
export const EXPECTED_CHANNELS: readonly string[];

/** The exact version `package.json` pins the build at, or `undefined` when it is missing or a range. */
export function pinnedVersion(manifest: McpRegistrationManifest): string | undefined;

/** The channels a capabilities object advertises, in {@link MCP_CHANNELS} order. */
export function channelSet(capabilities: Readonly<Record<string, unknown>> | undefined): string[];

/** Every static defect of the registration: server missing, or not the pinned build's `mcp` command. */
export function registrationProblems(config: McpConfig): string[];

/** Judge a registration and what its server answered against the pin and the expected channel set. */
export function evaluateRegistration(
  manifest: McpRegistrationManifest,
  config: McpConfig,
  observed: McpServerObservation | { readonly error: string },
  expectedChannels?: readonly string[],
): McpRegistrationCheck;

/** Spawn the server `dir/.mcp.json` registers, from `dir`, and ask it what it serves. */
export function observeServer(dir: string, entry: McpServerEntry): Promise<McpServerObservation>;

/** Read `dir`'s `package.json` and `.mcp.json`, start the registered server, and judge it. */
export function checkMcpRegistration(dir: string, expectedChannels?: readonly string[]): Promise<McpRegistrationCheck>;
