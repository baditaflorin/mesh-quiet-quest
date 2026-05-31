# mesh-quiet-quest

[![Live](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh--quiet--quest-5ED390?style=flat-square)](https://baditaflorin.github.io/mesh-quiet-quest/)
[![Version](https://img.shields.io/github/package-json/v/baditaflorin/mesh-quiet-quest?style=flat-square&color=6e8a7a)](https://github.com/baditaflorin/mesh-quiet-quest/blob/main/package.json)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![No backend](https://img.shields.io/badge/backend-none-112720?style=flat-square)](docs/adr/0001-deployment-mode.md)

> Peer-to-peer mesh: gamified group silence. Mic-monitored quiet game; shared score ticks up while the room stays quiet.

**Live:** https://baditaflorin.github.io/mesh-quiet-quest/

Set a duration. Pick a mode. Allow mic. Tap Begin. Every phone in the room listens to its own mic; while the whole room stays below the speech threshold, the shared score ticks up. Speak above the threshold for half a second and the room loses points.

**No mic, or running the room from a laptop?** "Join without mic (facilitator)" lets you start/clear the shared session and **log a break by hand** when you hear someone speak. The manual break writes the exact same shared `breaks` Y.Map the automatic mic detection does, so the score and every peer's view update identically — mic-driven or hand-logged.

Two modes:

- **Shared** — the room sees an aggregate "5 of 8 phones quiet right now." Never who.
- **Vipassana** — nothing is published about who's talking. Each phone tracks its own speech-time locally and shows it to only that person at the end.

## How it works

- Each phone joins a shared Yjs document over y-webrtc.
- A `Y.Map("session")` carries `{ startedAt, durationMs, mode }`.
- A `Y.Map<minuteIdx, breakCount>("breaks")` tracks aggregate speech events per minute.
- In shared mode: each peer publishes `{ talking: boolean, ts }` to awareness every 500 ms.
- A 500 ms continuous-above-threshold debounce gates "speech" — see [ADR 0003](docs/adr/0003-speech-debounce.md).
- A break (mic rising-edge **or** a facilitator's manual "Log a break") increments `Y.Map("breaks")` and subtracts from the room silence score; the mutation propagates to every peer over the Yjs doc.
- Threshold is **calibratable** (−50 to −30 dBFS, default −40). Calibrate up if your room has HVAC hum.

## Privacy threat model

See [docs/privacy.md](docs/privacy.md). The short version: no audio bytes ever leave your device; only a boolean "talking" state in shared mode, and nothing extra in vipassana mode. See [ADR 0002](docs/adr/0002-aggregate-or-private.md) for the design rationale.

## Architecture

- **Mode A** — pure GitHub Pages, zero backend at runtime ([ADR 0001](docs/adr/0001-deployment-mode.md)).
- **WebRTC** — Yjs + y-webrtc with self-hosted signaling and TURN.
- **No GitHub Actions** — `docs/` is the built site, committed directly.

## Run it locally

```bash
git clone https://github.com/baditaflorin/mesh-quiet-quest.git
cd mesh-quiet-quest
npm install
npm run dev
```

## Settings (in-app)

- **Room ID** — phones must share one to see each other.
- **Duration** (1–180 min).
- **Mode** — shared (default) or vipassana.
- **Speech threshold** — −50 to −30 dBFS. Default −40.
- **Signaling URL** / **TURN credentials URL** — override the self-hosted defaults.

All persisted to `localStorage`.

## Self-hosted infrastructure

| Repo                                                                   | Endpoint                               | Role                      |
| ---------------------------------------------------------------------- | -------------------------------------- | ------------------------- |
| [signaling-server](https://github.com/baditaflorin/signaling-server)   | `wss://turn.0docker.com/ws`            | y-webrtc protocol fan-out |
| [turn-token-server](https://github.com/baditaflorin/turn-token-server) | `https://turn.0docker.com/credentials` | HMAC TURN creds           |
| [coturn-hetzner](https://github.com/baditaflorin/coturn-hetzner)       | `turn:turn.0docker.com:3479`           | TURN relay                |

## ADRs

- [0001 — Deployment mode (Mode A)](docs/adr/0001-deployment-mode.md)
- [0002 — Aggregate-only by default, private-only in vipassana](docs/adr/0002-aggregate-or-private.md)
- [0003 — Speech debounce window](docs/adr/0003-speech-debounce.md)
- [0010 — GitHub Pages publishing](docs/adr/0010-pages-publishing.md)

## License

[MIT](LICENSE) © 2026 Florin Badita
