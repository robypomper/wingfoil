---
id: svc-011-alternativeto-listing-wingfoil
type: service
title: "AlternativeTo listing WingFoil"
status: active
provider: "alternativeto.net"
kind: "listing"
owner_role: "approver"
verify: "open https://alternativeto.net/software/wingfoil/ — the listing renders with license MIT and the repository link"
url: "https://alternativeto.net/software/wingfoil/"
account: "RobyPomper (Google sign-in, robypomper@gmail.com), a personal account of the approver"
renews: ""
repo_refs: []
decision: "dl-130-visibility-steps-in-the-release-flow"
set_up_in: "v0.2"
tmpl_version: 260929
---

## Purpose

A directory entry that lets people looking for a tool like WingFoil find it next to the products they
already know. It is one of the external listings `dl-130` counts as part of the project's visibility.

## Configuration

Created by the approver on 2026-09-29.

- **Account:** `RobyPomper`, a **personal** account of the approver, signed in with Google. It is not
  owned by the `wingfoil` organisation, because alternativeto.net has no organisation accounts.
- **Alternatives linked:** none yet. The creation form found none of the suggested products (GitHub Spec
  Kit, BMAD Method). Alternatives are added from the other products' pages, with *Suggest alternative*;
  the candidates are Claude Code, Kiro, Cline and Aider.
- **Moderation:** new listings may sit in moderation before they are public.

## Verification

Manual: alternativeto.net has no public API. Open `https://alternativeto.net/software/wingfoil/` and
check that the listing renders with license MIT and the link to `github.com/wingfoil/wingfoil`. The page
is not readable from cloud sessions, whose network policy denies alternativeto.net; the agent did not
read it for this element.

## Management

- **Open action (approver):** link 2–3 alternatives from the candidates above.
- **Ownership:** the listing belongs to a personal account. If the `approver` role ever changes hands,
  the listing must be transferred or re-claimed by the new holder; until then this element names the
  account so the dependency is visible.
- **Retirement:** `memory deprecate`, with a `Reason:` that says whether the listing was deleted or
  taken over by another account.
