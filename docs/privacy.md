# Privacy threat model — mesh-quiet-quest

## What other peers in the same room can see

Depends on **mode**:

**Shared mode (default):**

- A per-peer awareness field `{ talking: boolean, ts: number }`, published every 500 ms.
- The shared `Y.Map` of session metadata (`startedAt`, `durationMs`, `mode`).
- A shared per-minute counter `Y.Map<minuteIdx, breakCount>`.

The in-app UI **never** renders who is talking — only the aggregate count "X of N phones currently quiet" and the cumulative penalty. A sophisticated peer running their own client could correlate `awareness.clientID` to "talking right now" — see ADR 0002 for the full discussion of this trade-off.

**Vipassana mode:**

- The shared session metadata.
- Nothing else. The `talk` awareness field is **not published**. Each phone tracks its own speech-time locally and shows it to ONLY that person at the end of the session.

Plus, from the mesh clock-sync layer (both modes):

- Your phone's wall-clock time (`Date.now()`), published every 1.5 s.
- Your Yjs awareness `clientID` — a per-session 32-bit random integer regenerated on every page load.

## What stays local — including audio

Your microphone stream goes into one `AnalyserNode` and is read frame-by-frame for RMS dBFS energy only. The bytes are never:

- buffered into an audio file,
- encoded by `MediaRecorder`,
- uploaded anywhere,
- written to `localStorage` or IndexedDB.

The classifier output (a boolean "above threshold for 500 ms continuous") is the only thing derived. In vipassana mode even that boolean stays local.

Your room ID, duration, mode, and threshold setting are in `localStorage` and never leave your device.

## What the signaling server can see

`signaling-server` (mine) sees:

- The room name (`mesh-quiet-quest:<roomId>`).
- Encrypted SDP offer/answer blobs.
- The IP address of each WebSocket peer.

It does not see talking state or audio. Those flow peer-to-peer over WebRTC DataChannel.

## What the TURN server can see

`coturn-hetzner` (mine) relays encrypted WebRTC traffic when peers cannot connect directly. It sees IP addresses and ciphertext. It cannot decrypt the contents.

## Permissions asked

- **Microphone.** Required.

That's it.

## What's NOT in the threat model

- **Anonymity within the room.** See ADR 0002. The shared mode publishes `clientID → talking`. The default UI does not surface this, but the data is on the wire.
- **Adversarial peers spoofing silence.** A malicious peer can publish `{ talking: false }` permanently and skew the aggregate. This is a "trusted group" app — host a private room with people you trust.
