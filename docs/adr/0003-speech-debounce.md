---
status: accepted
date: 2026-05-12
---

# 0003 — Speech debounce: 500 ms continuous above threshold

## Context

A microphone RMS dBFS reading is jittery. A cough, a chair scrape, a microphone moving against a fabric pocket, an HVAC compressor kicking in — all of these create momentary spikes above any reasonable speech threshold. If we naively trigger "speech" the instant the RMS exceeds threshold, the silence game becomes a war of attrition against the room's mechanical sounds.

We want to register **speech**, not transients. Speech is a sustained signal: at minimum a syllable or two (~200 ms) and typically continuous over multiple words (>500 ms).

## Decision

Use an `AnalyserNode` with `fftSize = 2048` and `smoothingTimeConstant = 0.2`. Each rAF tick:

1. Pull `getFloatTimeDomainData` into a 2048-sample buffer.
2. Compute RMS in linear amplitude, convert to dBFS (`20 * log10(rms)`).
3. If `dBFS >= threshold`, mark this frame as "above" and record `aboveSince = now` if not already set.
4. If `dBFS < threshold`, clear `aboveSince`.
5. `talking = (aboveSince !== null) && (now - aboveSince >= 500 ms)`.

The 500 ms window is the debounce. Speech sustains that long; coughs, scrapes, and HVAC blips don't.

Default threshold is **−40 dBFS**, calibratable in Settings from **−50** (stricter, more sensitive) to **−30** (looser).

The smoothing constant 0.2 is a light low-pass to take the edge off frame-to-frame noise without sluggishness; we still get a fresh decision every ~16 ms.

## Consequences

- Brief incidental sounds do not count as speech.
- A whisper that's right at the threshold for 500+ ms **does** count, which is correct — the goal is silence, and a sustained whisper breaks silence.
- A long mechanical hum at the threshold level will be classified as speech. The recommended fix is to calibrate the threshold up in Settings until the baseline reads "quiet," then run the session.
- Reaction latency is 500 ms — the "talking" indicator lags real speech by half a second. Acceptable for a game played in minutes.

## Alternatives considered

- **Energy-only with no debounce.** Rejected — see Context. Too jumpy.
- **Spectral features (voice-band 80–300 Hz, formants).** More precise at distinguishing voice from mechanical noise but adds an FFT and tuning. Not worth the complexity for a calibratable threshold game.
- **VAD (e.g. WebRTC VAD via WASM).** A real voice-activity detector would handle the HVAC case better, but the bundle and integration cost is high and the user-facing improvement marginal once the threshold is calibrated.
