---
status: accepted
date: 2026-05-12
---

# 0002 — Aggregate-only by default, private-only in vipassana

## Context

A group silence game needs to surface enough information for the players to know how they're doing, but the information that's most directly available — "is microphone N above threshold right now?" — is also the most sensitive: it identifies who's not keeping silence. A naive design publishes per-peer talking state and renders "Alice is talking" on every screen, which is mortifying and also creates a different kind of social pressure than the game wants.

## Decision

Two modes, both privacy-preserving:

**Shared (default).** Each phone publishes a single awareness field `{ talking: boolean, ts: number }` and also bumps a `Y.Map<minuteIdx, breakCount>("breaks")` on the rising edge of `talking`. The UI **never** renders WHO is talking — only the AGGREGATE: "5 of 8 phones quiet right now," and the cumulative score in "seconds-of-room-silence." The peer identity is technically observable in the Yjs awareness stream by a sophisticated peer, but no UI surfaces it. The threat model in `docs/privacy.md` is explicit about this.

**Vipassana.** Awareness publishing for `talk` is suppressed entirely — each phone tracks its own speech-time locally and shows it to ONLY that person at the end. Nothing about who-talked-when leaves the device. The cumulative break counter still works for everyone else's view of room aggregate (in vipassana, peers don't see your contribution; in vipassana mode each phone is essentially isolated for talking tracking, only the session metadata is shared).

## Consequences

- **Shared mode** preserves the social game ("we're keeping silence together") without naming-and-shaming. A determined peer reading the awareness stream could still link a `clientID` to "talking right now," but no off-the-shelf UI shows this and the `clientID` is regenerated on every page load.
- **Vipassana** is the right tier for a personal practice — the phone is just your private bell timer with mic confirmation.
- The cost is the score is approximate in shared mode (per-minute break counts × estimated penalty per break) rather than a precise integral.

## Alternatives considered

- **Per-peer scoreboard.** Rejected — exactly the failure mode this app exists to avoid.
- **End-of-session only reveal.** Rejected — the live aggregate "5 of 8 quiet" is the load-bearing UI for the group experience.
- **Differential privacy noise on the publish rate.** Overkill; the aggregate cardinality is `count >= threshold` rather than a precise mean.
