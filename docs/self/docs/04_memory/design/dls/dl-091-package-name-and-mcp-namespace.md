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

### The identity set after the naming investigation (2026-09-29)

The investigation the section above waited for reported on 2026-09-29. The approver **replaces** the
2026-09-28 set: no "Harness" qualifier, and the project moves to a GitHub organisation of its own
instead of a renamed personal repository. The 2026-09-28 table is kept above as the record of what
was proposed first.

| Identity | Value | State on 2026-09-29 | Owner of the next step |
|---|---|---|---|
| Brand | **WingFoil**, no qualifier | decided by the approver | — |
| Metaphor | Wing = the agents (power) · Foil = the layer in the repository (lift and course) | decided by the approver | — |
| Category line | "The repo-native intent layer for AI-native software engineering" | proposed | — |
| Slogan | "Keep your intent on course while agents do the work." | proposed | — |
| GitHub organisation | `wingfoil` | free, to be created | approver |
| Repository | `wingfoil/wingfoil`, transferred from `robypomper/wingfoil` | transfer last, before the v0.2.2 publish | approver |
| MCP namespace | `io.github.wingfoil/wingfoil` | after the transfer, published in v0.2.2 | repository (`dl-093`) |
| npm package | `wingfoil` | held by this project | — |
| CLI command | `wingfoil` | unchanged | — |
| npm scope | `@wingfoilhq` | free, to be created | approver |
| Main domain | `wingfoil.dev` | free, to be registered | approver |
| Reserve domain | `wingfoilhq.dev`, redirecting to the main one | free, to be registered | approver |
| Site | `wingfoil.dev` as a custom domain on GitHub Pages | after the transfer | repository |
| Bluesky | `@wingfoil.dev` | after the domain | approver |
| X, LinkedIn, Mastodon, YouTube | `wingfoilhq` | to be checked | approver |

**Availability, re-read on 2026-09-29** (the facts the 2026-09-28 table does not already cover, or
that the new set depends on):

| Where | What was found | Source |
|---|---|---|
| GitHub, organisation `wingfoil` | **Free**: no user or organisation has the login | `https://api.github.com/orgs/wingfoil` → 404; `…/users/wingfoil` → 404 |
| GitHub, `wingfoilhq` | Free | `https://api.github.com/users/wingfoilhq` → 404 |
| GitHub, `robypomper/wingfoil` | Public, created 2026-09-17 | `https://api.github.com/repos/robypomper/wingfoil` |
| npm, package `wingfoil` | Held by this project: `0.2.1`, maintainer `robypomper` | `npm view wingfoil version maintainers` |
| npm, scope `@wingfoilhq` | **Free**: no organisation, no package in the scope | `https://registry.npmjs.org/-/org/wingfoilhq/package` → 404; `…/-/v1/search?text=scope:wingfoilhq` → 0 results |
| `wingfoil.dev`, `wingfoilhq.dev` | **Not registered**: the `.dev` registry has no record; neither name resolves | `https://pubapi.registry.google/rdap/domain/<name>` → 404; `getent hosts <name>` → nothing |
| MCP Registry | Still no server matches `wingfoil` | `https://registry.modelcontextprotocol.io/v0/servers?search=wingfoil` → `count: 0` |
| Trademarks | **No mark consisting of "wingfoil" alone is in force**; composite marks exist, two of them in software-related classes (see below) | TMView search, trademark name `wingfoil`, exported by the approver on 2026-09-29 |
| GitHub organisation `wingfoil` | **Created** by the approver, 2026-09-29 11:05 UTC | `https://api.github.com/orgs/wingfoil` → `type: Organization`, `created_at: 2026-09-29T11:05:14Z` |
| npm organisation `wingfoilhq` | **Created** by the approver on 2026-09-29; no package yet | `https://registry.npmjs.org/-/org/wingfoilhq/package` → 200, `{}` |

**The trademark search, in detail.** TMView returned 22 records for `wingfoil`, from national offices,
EUIPO (`EM`) and WIPO (`WO`, one designation covering GB and US). What they show:

- The only mark that is exactly `WINGFOIL` is Japanese (`JP 2019120061`, class 28, sporting goods),
  and its status is **Ended**.
- Every other record is a composite name for the water sport: schools, events, federations and board
  brands (e.g. `DUOTONE TRUE WINGFOILING`, EUIPO `018408263` and WIPO `1618789`, classes 22/25/28).
- Two composite marks are registered in classes that cover software:
  - `WINGFOIL BIBLE` (PT `050000759288`, registered 2026-04-13) in classes 9, 16, 35 and 41;
  - `WingFoilCampione` (IT `2022000048677`, registered 2022-12-12) in classes 25, 38 and 42.

  Both names refer to the sport. Neither is the bare word, and neither is a developer tool.
- The export names no USPTO record of its own. Whether the search included the USPTO register is not
  stated in the export, so that part of the action is recorded as covered only through the WIPO
  designation above.

This is a record of what the search returned, not a legal opinion on registrability or conflict.


**What the new set changes for the namespace.** `io.github.wingfoil/*` is granted by GitHub-based
authentication to an **Owner** of the `wingfoil` organisation (see *The MCP namespace* above), so
the approver must own the organisation before `dl-093`'s `mcpName` is published. The name collision
recorded above (`wingfoil-io/wingfoil` on GitHub, crates.io and PyPI) is not resolved by a
qualifier any more; it is met by an organisation, a domain and a scope of the project's own.

## Decision

The 2026-09-29 set above is the recommendation. It keeps the install surface (package and command),
drops the qualifier, and gives the project a GitHub organisation, an npm scope and a domain of its
own. The four questions stand, with the answers the approver gave on 2026-09-29; they are ratified by
this decision-log's approve commit:

- **Q1 — the display name:** **WingFoil**, with no qualifier. The category line and the slogan are
  proposals for `README.md`, the site and the directory listings (`dl-093` `description`).
- **Q2 — the MCP namespace:** **(iii) a GitHub-organisation namespace, `io.github.wingfoil/wingfoil`**.
  A published version's metadata cannot be changed and the registry documents no rename, so it is
  chosen before v0.2.2 publishes `mcpName` for the first time.
- **Q3 — the repository:** decided on 2026-09-28 to change inside v0.2.2; its target is now a
  **transfer to `wingfoil/wingfoil`**, not a rename. GitHub redirects the old address after a transfer
  as after a rename. The transfer is the last identity step before the v0.2.2 publish, in this order:
  1. the approver creates the `wingfoil` organisation and transfers the repository, because the agent
     holds no credentials there;
  2. the local remote URL is updated;
  3. the slug is swept. On 2026-09-29 it occurs in exactly two files outside Memory and plans:
     `package.json` (`repository.url`, `homepage`, `bugs.url`) and `test/cli/publish-metadata.test.ts`
     (`REPO_SLUG`) — `grep -rln "robypomper/wingfoil" --exclude-dir={node_modules,dist,.git} .`,
     less `docs/self/docs/04_memory/` and `docs/05_plans/`. README, `docs/*.md` and
     `.github/workflows/` carry none. `spec-015` §1 writes `<owner>/wingfoil`, so it needs no edit
     unless the approver wants the owner fixed there; the sweep re-runs the `grep` rather than trusting
     this list;
  4. the repository's `service` element records the new owner and the redirect (`dl-088`);
  5. staging runs, then the tag, then the publish, and provenance is checked against the new URL.
- **Q4 — the reservations:** the organisation `wingfoil`, the npm scope `@wingfoilhq`, `wingfoil.dev`
  and `wingfoilhq.dev`, and then the Bluesky handle `@wingfoil.dev`. The `wingfoilhq` handles on X,
  LinkedIn, Mastodon and YouTube are still to be checked. The approver reports the date and the
  account used for each, and each becomes a `service` element (`dl-088`).

## Rationale

- **Both answers are permanent.** The npm name is the install command, and the registry documents no
  rename. Deciding them before v0.2.2 publishes `mcpName` for the first time avoids a second
  published identity.
- **Facts carry their source and date** (`claim-evidence`): every registry state above can change,
  and the table is a record of what was read on 2026-09-28, not a standing claim.
- **The trademark gap is stated, not assumed away.** No check was made; the Actions give it an owner.

## Actions

- [x] Search the trademark registers for "wingfoil" and record the result with source and date
      (owner: approver). Done 2026-09-29 through TMView; recorded above, with the USPTO caveat.
- [x] The rename investigation reported on 2026-09-29; its set is recorded above.
- [ ] Ratify at v0.2.2 `release-planning` (`reconcile-governance`), with the 2026-09-29 answers to
      Q1, Q2 and Q4 (owner: approver). The choices go in the approve commit's `Reason:`.
- [ ] Q3: the approver creates the `wingfoil` organisation and transfers the repository; then the
      slug `robypomper/wingfoil` → `wingfoil/wingfoil` is swept as Q3 step 3 lists it, before the
      v0.2.2 publish (task, via `build-backlog`).
- [ ] On `ready`, `dl-093` uses the chosen namespace for `mcpName` and `server.json`, and the chosen
      display name in `package.json` `description` and the directory listings.
- [ ] Record each reserved identity as a `service` element once it exists (`dl-088`), with the date
      and account the approver reports: the organisation, the npm scope, both domains, the handles,
      the transferred repository and the MCP namespace.
- [ ] Tasks are derived by v0.2.2 `release-planning` (`build-backlog`), not created here.

## Relations

- **Origin:** `retro-v0.2`; `retrospective-rel-v0.2-plan` §6.7 (the v0.2.2 gates) and §6.8 (step 5).
- **Gates:** `dl-093-package-metadata-for-discovery` (uses Q2's namespace).
- **Related:** `dl-088` (the `service` records), `dl-092` (the third v0.2.2 gate),
  `dl-130-visibility-steps-in-the-release-flow` (MCP Registry publish in the release flow).
- **Traceability:** REQ-SYS-09 (distribution as an npm package); P5.2.1 (the MCP server it lists).
