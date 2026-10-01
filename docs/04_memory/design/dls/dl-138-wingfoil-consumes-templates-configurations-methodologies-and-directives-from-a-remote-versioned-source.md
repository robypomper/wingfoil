---
id: dl-138-wingfoil-consumes-templates-configurations-methodologies-and-directives-from-a-remote-versioned-source
type: decision-log
title: "WingFoil consumes templates, configurations, methodologies and directives from a remote, versioned source"
status: in-discussion
context: "ad-hoc"            # optional — short label for the context, e.g. "retrospective", "planning", "ad-hoc"
release: ""            # optional — implementation release this DL is assigned to (stamped at release-planning/build-backlog, dl-016), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author (dl-020); credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note (dl-020)
tmpl_version: 260703   # Orignal template version
tags: ["governance","templates","init","update"]
---

## Context

**Today every template WingFoil installs ships inside the npm package.**
- `wingfoil init --template Scrum|Kanban` scaffolds the configuration from the package's own
  template definitions (`templateScaffold`, `src/core/init.ts`).
- The P3.8 directive templates are copied into `.wingfoil/directives/built-in/`, under the
  REQ-SEC-10 integrity check.
- REQ-SEC-07 ("Immutable built-in assets") keys removability on the `built-in/` vs `custom/`
  distinction.

There is no way to take a template, a methodology, a workflow, a directive or a starting DNA from
anywhere else, and no way to update one after `init`.

**The approver has created a separate public repository** to hold WingFoil's templates and starting
configurations: methodologies, workflows, directives, starting DNA. It is empty for now, and its
design is under discussion. Its purpose:
- to version and release that content independently of the WingFoil tool;
- to allow third-party sources, for example a company's own templates.

Its name is recorded at ratification.

**v0.4 already plans the content side of this.**
- The reference workflow templates P4.18–P4.20 (Scrum, Kanban, Lean Inception, Trunk-Based, with
  expansion and customisation) moved to `minor-v0.4`.
- That release also carries the idea of composable **methodology packs**: directives, workflows and
  configuration per methodology, selectable at `init` and addable afterwards.

This decision changes where that content lives and how it reaches a project over time.

**The impact is not limited to `init`.** It reaches how WingFoil governance is first set up in a
host project and how it is **updated afterwards**. A project initialised from a template must be
able to receive a later version of that template, methodology or directive, without losing its
local customisations and without breaking determinism.

## Decision

The approver has decided the direction:
- **WingFoil consumes templates, configurations, methodologies and directives from a remote,
  versioned source**, starting with the approver's public template repository and open to
  third-party sources.
- **No separate "lite" profile.** How much ceremony a project carries is decided by the templates
  and configurations it chooses at `wingfoil init`.

Open, settled at ratification:

**Q1 — how a project holds remote content.**
- **(a) Vendored and pinned.** `init` copies the chosen content into `.wingfoil/`, and a lock entry
  records each source's URL and exact commit (or version) in the project's configuration. Every
  later read is local, so runs are reproducible and offline.
- **(b) Referenced.** The project stores only the source and version, and content is fetched when
  needed.

**Q2 — how an initialised project is updated.**
- **(i) Explicit update command.** For example `wingfoil template update`. It fetches a newer pinned
  version, shows a diff, three-way merges against local customisations (the old upstream, the new
  upstream, the local file) and reports conflicts. It writes one audited commit per update, naming
  the source and both versions in a trailer.
- **(ii) Report only.** WingFoil reports that a newer version exists, and the update is applied by
  hand.

**Q3 — the asset classes.** REQ-SEC-07 knows `built-in` and `custom`. Options:
- a third class, `remote`, vendored under its own folder with its own removability and override
  rules;
- remote content treated as `built-in` once vendored, with the pin as its provenance.

**Q4 — trust and safety of a source.**
- Which sources a project accepts: an allowlist declared in the project's configuration.
- What fetched content must pass before it is written: the REQ-SEC-10 schema check, the secret scan
  (`spec-007`), and no executable content.
- Whether a third-party source must be signed or tagged.

**Q5 — release.** The approver chooses. The proposal is v0.4, next to P4.18–P4.20 and the
methodology packs, whose source this decides.

**Recommendation:**

| Question | Choice | Why |
|---|---|---|
| Q1 | (a) | Only a vendored, pinned copy keeps a run deterministic (REQ-SYS-07) and offline |
| Q2 | (i) | An update is a governance change, so it must be explicit, reviewable and one audited commit, like every other WingFoil write |
| Q3 | a third class `remote` | Customisation and removability differ from both `built-in` and `custom` |
| Q4 | allowlist plus REQ-SEC-10 and `spec-007` checks on fetched content | Gates content before it is written |
| Q5 | v0.4 | Next to P4.18–P4.20 and the methodology packs |

## Rationale

- **Templates evolve at a different pace from the tool.** Shipping them in the package couples a
  methodology fix to a WingFoil release, and leaves companies no way to publish their own.
- **The update path matters more than the first install.** A template applied once and then frozen
  ages, and an unaudited overwrite destroys local customisation. That is why Q1 and Q2 are decided
  together, and why the pin is the determinism anchor.
- **No lite profile:** ceremony is a property of the chosen configuration, not a second product
  mode. Choosing a smaller template is the lite path.

## Actions

1. **Ratify Q1–Q5** at `in-discussion → ready`, and record the template repository's name. Owner:
   approver.
2. **A tech-spec** for the remote source:
   - the lock format and where it lives (`dna.yaml` or a new file);
   - fetch and verify;
   - the update and merge algorithm and its conflict report;
   - the `remote` asset class and its REQ-SEC-07 consequences;
   - offline behaviour;
   - the update commit's trailer.
3. **Fold into v0.4 planning**, together with P4.18–P4.20 and the methodology packs: the packs
   become content of the template repository rather than of the package.
4. **Amend REQ-SEC-07 and REQ-SEC-10** for the new asset class, through their owning tasks.

## Relations

- **Related:**
  - `minor-v0.4` (P4.18–P4.20 and the methodology packs);
  - REQ-SEC-07 (immutable built-in assets) and REQ-SEC-10 (built-in template integrity);
  - `spec-011` (built-in assets);
  - `dl-137` (AGENTS.md: the agent instruction file could itself be generated from, or shipped by,
    a template);
  - `bug-040` (the built-in vs stand-in directives in this repository);
  - `task-135` (secret scan of built-in templates at `init`).
