---
id: "bug-083-dna-set-cannot-write-array-valued-fields"
type: bug
title: "`dna set` writes scalars only, so no command can add a team member or a role — and seeding the first approver has no CLI path at all"
status: open
severity: "high"
release-origin: "v0.2"
release: ""
feature: "P2.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`wingfoil dna set` accepts a key and a value and writes the value as a **string**. Every array-valued
field in `dna.yaml` therefore rejects it at validation, `team.members` and `team.roles` included. Since
no other command in the surface writes those fields, **there is no CLI path to add a team member or a
role** — including the first approver, without whom no element can ever be approved.

## Steps to Reproduce

Measured on a scratch project on 2026-09-23 against the CLI built from `main`:

```
$ wingfoil dna set 'team.members' '[{"name":"X","email":"x@y.z","roles":["approver"]}]'
error: E_VALIDATION team.members (…/.wingfoil/dna.yaml): Invalid input: expected array, received string

$ wingfoil dna set 'team.roles' '[{"name":"reviewer2"}]'
error: E_VALIDATION team.roles (…/.wingfoil/dna.yaml): Invalid input: expected array, received string

$ wingfoil dna set 'project.name' 'Renamed'
→ exit 0, commits `wf(dna): set project.name`
```

The whole command surface — `dna set|show`, `directive create|assign|remove`, `directives list`,
`memory …`, `paths`, `workflow list`, `init`, `mcp` — contains no other writer for those fields.

## Expected Behavior

`dna set` can write the value types the DNA schema declares, or the surface offers another command
that can. **P2.1** specifies `wingfoil dna set` as "Define/update project DNA" with "Basic CRUD
operations" at Critical priority, and **P2.4** names *team members* among what the DNA defines;
`spec-002` describes the pair as commands that "display and mutate the DNA map". A field the feature
names explicitly is not writable by the command the feature names explicitly.

## Actual Behavior

Scalars work. Arrays fail at validation. The two array fields that gate everything else — who exists,
and what roles exist — are reachable only by hand-editing `dna.yaml` and committing it yourself.

## Notes

**This became load-bearing on 2026-09-23.** `dl-080-which-baseline-each-command-reads` was ratified as
option (B): reads resolve at `HEAD`, writes refuse while their target is dirty. Under that rule a role
must be **committed** before a directive can be assigned to it, and an approver must be committed
before they can approve. Both flows are fine when a command performs them — it commits as it goes —
and both become a hand edit plus a manual `git commit` because no command does.

So the awkwardness that looked like a cost of the baseline rule is in fact this gap. `dl-080`'s
ratification says so and defers the repair here rather than weakening the rule. E6 of that document
carries the measurements.

**It is a defect rather than a missing feature**, on the specs' own wording: the command is specified
to mutate the DNA map, and the DNA is specified to contain team members. Filing it as a bug rather
than recording it in the retrospective is deliberate — a retrospective produces a decision-log, whose
contents are lessons rather than schedulable work, and this release opened `bug-062` precisely because
findings parked in prose are rescheduled by nothing. It was already proposed once, by `task-090`, and
not filed.

Worth establishing before fixing, rather than assuming: whether the remedy is `dna set` parsing a JSON
value when the schema expects an array, or an append-style verb (`dna add-role`, `dna add-member`)
that avoids making a user hand-write a whole array to add one entry. The second is friendlier and
matches how the fields are actually used; the first is one behaviour rather than two new commands.
`spec-008-cli-grammar` pins the CLI grammar, so either route touches a ratified document.

## Triage & Execution Notes

- triage (2026-09-23): **high**. Nothing is corrupted and nothing lies, so it is not critical — but a
  new user cannot use the tool to establish who may approve in their own project, which is the first
  thing a git-identity-based authorisation model needs, and `dl-080`'s ratification now rests on this
  being repaired.
- Not declared a release blocker here; that is the approver's call, and it is a different question
  from the baseline class, all five of which are blocking.
