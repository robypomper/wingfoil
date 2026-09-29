---
id: "dl-091-package-name-and-mcp-namespace"
type: decision-log
title: "The project's public identity — display name, npm scope, repository and MCP namespace — is undecided, and the MCP namespace is permanent once published"
status: in-discussion
context: "retrospective"
release: "v0.2.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`) from the project-visibility work it absorbed
(`retrospective-rel-v0.2-plan` §6.7). The approver ruled on 2026-09-28 that a v0.2.2 patch rehearses
the new publishing steps before v0.3.0, and that it has three gates: a name check, the MCP namespace
choice, and how a patch is tracked after its minor is `released` (`dl-092`). This decision-log carries
the first two. Both are baked into the published package: the name is the install command, and the
namespace is the `mcpName` field the MCP Registry verifies against the npm package (`dl-093`).

### The name check

Each fact below was read on 2026-09-28 from the source named with it.

| Where | What was found | Source |
|---|---|---|
| npm, package `wingfoil` | **Held by this project**: `0.2.1`, `latest`, one maintainer `robypomper` | `npm view wingfoil version dist-tags maintainers` |
| npm, scope `@wingfoil` | **Taken by another project**: `@wingfoil/client` `9.0.0` and `@wingfoil/telemetry` `0.1.0`, both from `github.com/wingfoil-io/wingfoil` | `npm view @wingfoil/client repository.url`; `https://registry.npmjs.org/-/v1/search?text=wingfoil` |
| GitHub | `robypomper/wingfoil` is public, created 2026-09-17. The organisation `wingfoil-io` exists and owns `wingfoil-io/wingfoil`, a "ultra low latency graph based stream processing framework" (Apache-2.0, 224 stars). No user or organisation is named `wingfoil`. A name search returns 59 repositories | `https://api.github.com/repos/robypomper/wingfoil`, `…/repos/wingfoil-io/wingfoil`, `…/users/wingfoil` (404), `…/search/repositories?q=wingfoil+in:name` |
| crates.io | **Taken**: crate `wingfoil` `9.0.0`, "Graph based stream processing framework", repository `wingfoil-io/wingfoil`, created 2025-07-26 | `https://crates.io/api/v1/crates/wingfoil` |
| PyPI | **Taken**: `wingfoil` `9.0.0`, "Python bindings for wingfoil (the Op-pattern stream processing engine)", home page `wingfoil-io/wingfoil` | `https://pypi.org/pypi/wingfoil/json` |
| Domains | `wingfoil.io`, `wingfoil.com` and `wingfoil.org` resolve; `wingfoil.dev` does not. Resolution shows a domain is registered, not by whom | `getent hosts <domain>` |
| MCP Registry | No server matches `wingfoil` | `https://registry.modelcontextprotocol.io/v0/servers?search=wingfoil` → `{"servers":[],"metadata":{"count":0}}` |
| Trademarks | **Not checked.** No trademark register was searched | — |

So the unscoped npm name is ours, and every other ecosystem the check covered is held by one unrelated
software project with the same name, active since 2025 and in a different domain (stream processing
for trading). "Wing foil" is also the common name of a water sport, which is why an unrelated npm
package (`watersport-catalog`) matches the search.

### The MCP namespace

The MCP Registry's authentication method fixes the namespace of a server's name. Read on 2026-09-28
from the registry's documentation (`github.com/modelcontextprotocol/registry`,
`docs/modelcontextprotocol-io/authentication.mdx` and `package-types.mdx`):

- **GitHub-based authentication** grants `io.github.<username>/*`, or `io.github.<orgname>/*` for an
  **Owner** of that organisation;
- **domain-based authentication** (DNS or HTTP) grants `<reverse-domain>/*`, e.g. `dev.example/*`;
- for an npm package, the registry verifies ownership by reading `mcpName` in the published
  `package.json`, which **must** equal the name in `server.json`;
- the registry is in preview, and states that breaking changes or data resets may occur.

### The approver's proposed identity set (2026-09-28)

On 2026-09-28 the approver checked the original name and proposed the identity set below. A separate
investigation is still running, and its outcome is an input to v0.2.2's `release-planning`. That
phase confirms or amends the set, re-checks the availability facts and dates them again. Nothing in
v0.2.2 that bakes a name into the package proceeds before this decision-log is `ready`. That covers
`dl-093`'s `mcpName` and `server.json`, and the MCP registry namespace.

| Identity | Proposed | Why |
|---|---|---|
| Display name | **WingFoil Harness** | README, docs site, directory listings |
| npm package | **stays `wingfoil`** | already held and published; renaming it would break every existing install |
| CLI command | **stays `wingfoil`** | no change for users |
| npm scope | **`@wingfoil-harness`** | reserved now, as a free npm organisation |
| GitHub repository | **`robypomper/wingfoil-harness`** | GitHub keeps redirects from the old address |
| MCP namespace | **`io.github.robypomper/wingfoil-harness`** | tied to GitHub, so no domain is needed |
| Domain | `wingfoilharness.dev` or `wingfoil-harness.dev` | availability to be verified |
| Social handles | `wingfoilharness` / `wingfoil_harness` | reserve only |

**The constraint that makes the repository rename a v0.2.2 blocker, not a cosmetic step.**
`package.json` carries `repository.url`, `homepage` and `bugs.url`, all pointing at
`github.com/robypomper/wingfoil` (`node -p "require('./package.json').repository"` →
`git+https://github.com/robypomper/wingfoil.git`). npm provenance checks that the package's
`repository.url` matches the repository that built it. So if the repository is renamed, those three
fields must be updated before the next publish, or the provenance check fails. Anything else that
names the repository must also be swept: the README badges, `docs/`, `.github/workflows/publish.yml`,
and the `service` element for the repository (`dl-088`).

## Decision

Two questions are open for the approver.

**The proposed set above is the recommendation.** It keeps the install surface (package and
command) and moves the *presented* identity to "WingFoil Harness". That resolves the name
collision where it occurs, in listings and search, without breaking any install. Four choices
remain for the approver, at v0.2.2 `release-planning`, once the investigation reports:

- **Q1 — the display name.** Confirm "WingFoil Harness", or keep "WingFoil" with a descriptor.
- **Q2 — the MCP namespace.**
  - (i) `io.github.robypomper/wingfoil-harness`, which is the proposal;
  - (ii) a domain namespace, which needs the domain and a DNS or HTTP proof;
  - (iii) a GitHub-organisation namespace.

  A published version's metadata cannot be changed, and the registry documents no rename. Choose
  before v0.2.2 publishes `mcpName` for the first time.
- **Q3 — the repository rename: decided by the approver on 2026-09-28. It happens now, inside
  v0.2.2.** The rename happens before the v0.2.2 publish, together with its sweep, in this order:
  1. the approver renames the repository in GitHub's settings, because the agent holds no
     credentials there;
  2. the local remote URL is updated;
  3. `package.json` `repository.url`, `homepage` and `bugs.url` are updated, together with README
     badges, `docs/` and `.github/workflows/`;
  4. the repository's `service` element records the new name and the redirect (`dl-088`);
  5. staging runs, then the tag, then the publish, and provenance is checked against the new URL.

  The target name, `robypomper/wingfoil-harness`, is confirmed together with Q1.
- **Q4 — which reservations to make now.** The proposal reserves the npm scope, one domain and the
  handles as soon as this is ratified. Each reservation becomes a `service` element.

## Rationale

- **Both answers are permanent.** The npm name is the install command, and the registry documents no
  rename. Deciding them before v0.2.2 publishes `mcpName` for the first time avoids a second
  published identity.
- **Facts carry their source and date** (`claim-evidence`): every registry state above can change,
  and the table is a record of what was read on 2026-09-28, not a standing claim.
- **The trademark gap is stated, not assumed away.** No check was made; the Actions give it an owner.

## Actions

- [ ] Search at least the EUIPO and USPTO registers for "wingfoil" in software classes, and record
      the result with source and date in this decision-log before ratification (owner: approver).
- [ ] Ratify at v0.2.2 `release-planning`, after the rename investigation reports, choosing Q1, Q2 and Q4
      (owner: approver); Q3 is already decided (rename inside v0.2.2). The choices go in the approve
      commit's `Reason:`.
- [ ] Q3: the approver renames the GitHub repository; then update `package.json` `repository.url`, `homepage` and `bugs.url`, and sweep
      README badges, `docs/` and `.github/workflows/`, before the v0.2.2 publish (task, via
      `build-backlog`).
- [ ] On `ready`, `dl-093` uses the chosen namespace for `mcpName` and `server.json`, and the chosen
      display name in `package.json` `description` and the directory listings.
- [ ] Record each reserved identity as a `service` element once it exists (`dl-088`): the npm scope,
      the domain, the handles, the renamed repository and the MCP namespace.
- [ ] Tasks are derived by v0.2.2 `release-planning` (`build-backlog`), not created here.

## Relations

- **Origin:** `retro-v0.2`; `retrospective-rel-v0.2-plan` §6.7 (the v0.2.2 gates) and §6.8 (step 5).
- **Gates:** `dl-093-package-metadata-for-discovery` (uses Q2's namespace).
- **Related:** `dl-088` (the `service` records), `dl-092` (the third v0.2.2 gate),
  `dl-130-visibility-steps-in-the-release-flow` (MCP Registry publish in the release flow).
- **Traceability:** REQ-SYS-09 (distribution as an npm package); P5.2.1 (the MCP server it lists).
