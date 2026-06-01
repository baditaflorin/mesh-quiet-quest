import { useEffect, useMemo, useRef, useState } from "react";
import { createRoomSync } from "../sync/yjsRoom";
import { createClockSync } from "../sync/clockSync";
import { maybeFetchTurnCredentials } from "../sync/iceConfig";

export type Mode = "shared" | "vipassana";

type SessionState = {
  startedAt: number | null;
  durationMs: number;
  mode: Mode;
};

type AwarenessClock = {
  clientID: number;
  setLocalStateField: (key: string, value: unknown) => void;
  getStates: () => Map<number, Record<string, unknown>>;
  on: (event: string, cb: () => void) => void;
  off: (event: string, cb: () => void) => void;
};

const SPEECH_DEBOUNCE_MS = 500;
const PUBLISH_INTERVAL_MS = 500;

const phones = (n: number) => `${n} ${n === 1 ? "phone" : "phones"}`;

type Props = {
  roomId: string;
  durationMin: number;
  mode: Mode;
  dbThreshold: number;
};

export function QuietQuest({ roomId, durationMin, mode, dbThreshold }: Props) {
  const [armed, setArmed] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionState>({
    startedAt: null,
    durationMs: durationMin * 60_000,
    mode,
  });
  const [dbfs, setDbfs] = useState(-Infinity);
  const [iAmTalking, setIAmTalking] = useState(false);
  const [talkingCount, setTalkingCount] = useState(0); // peers currently talking (incl. self if shared)
  const [peerCount, setPeerCount] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [mySpeechMs, setMySpeechMs] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const aboveSinceRef = useRef<number | null>(null);
  const lastTalkingPublishedRef = useRef(false);
  const speechAccumStartRef = useRef<number | null>(null);

  const mesh = useMemo(() => {
    if (!armed) return null;
    const room = createRoomSync(roomId);
    const clock = createClockSync(room.provider);
    const sessionMap = room.doc.getMap<SessionState[keyof SessionState]>("session");
    const breaks = room.doc.getMap<number>("breaks");
    return { room, clock, sessionMap, breaks };
  }, [armed, roomId]);

  useEffect(() => {
    if (!armed) return;
    void maybeFetchTurnCredentials();
  }, [armed]);

  useEffect(() => {
    return () => {
      mesh?.clock.destroy();
      mesh?.room.provider?.destroy();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [mesh]);

  // Mirror Yjs session map → local state
  useEffect(() => {
    if (!mesh) return undefined;
    const update = () => {
      const startedAt = mesh.sessionMap.get("startedAt");
      const durationMs = mesh.sessionMap.get("durationMs");
      const sessMode = mesh.sessionMap.get("mode");
      setSession({
        startedAt: typeof startedAt === "number" ? startedAt : null,
        durationMs: typeof durationMs === "number" ? durationMs : durationMin * 60_000,
        mode: sessMode === "vipassana" ? "vipassana" : "shared",
      });
    };
    mesh.sessionMap.observe(update);
    update();
    return () => mesh.sessionMap.unobserve(update);
  }, [mesh, durationMin]);

  // Tick: detect speech, publish awareness, count peers, advance clock
  useEffect(() => {
    if (!mesh) return undefined;
    let raf = 0;
    let lastPub = 0;
    const buf = new Float32Array(2048);

    const tick = () => {
      const t = mesh.clock.meshNow();
      setNow(t);
      const analyser = analyserRef.current;
      if (analyser) {
        // dB level
        analyser.getFloatTimeDomainData(buf);
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) sumSq += (buf[i] ?? 0) ** 2;
        const rms = Math.sqrt(sumSq / buf.length);
        const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
        setDbfs(db);

        const above = db >= dbThreshold;
        if (above) {
          aboveSinceRef.current ??= t;
        } else {
          aboveSinceRef.current = null;
        }
        const sustained =
          aboveSinceRef.current !== null && t - aboveSinceRef.current >= SPEECH_DEBOUNCE_MS;
        setIAmTalking(sustained);

        // Accumulate own speech time (used in vipassana, also useful in shared)
        if (sustained) {
          if (speechAccumStartRef.current === null) speechAccumStartRef.current = t;
        } else if (speechAccumStartRef.current !== null) {
          setMySpeechMs((prev) => prev + (t - (speechAccumStartRef.current ?? t)));
          speechAccumStartRef.current = null;
        }

        // Publish awareness every PUBLISH_INTERVAL_MS in shared mode only
        if (session.mode === "shared" && t - lastPub > PUBLISH_INTERVAL_MS) {
          lastPub = t;
          const aw = (mesh.room.provider as unknown as { awareness: AwarenessClock } | null)
            ?.awareness;
          if (aw && sustained !== lastTalkingPublishedRef.current) {
            lastTalkingPublishedRef.current = sustained;
            aw.setLocalStateField("talk", { talking: sustained, ts: t });
            // Also increment per-minute break counter on rising edge.
            if (sustained && session.startedAt !== null) {
              const minIdx = Math.floor((t - session.startedAt) / 60_000);
              if (minIdx >= 0 && minIdx < 1000) {
                const cur = mesh.breaks.get(String(minIdx)) ?? 0;
                mesh.breaks.set(String(minIdx), cur + 1);
              }
            }
          } else if (aw) {
            aw.setLocalStateField("talk", { talking: sustained, ts: t });
          }
        }
      }

      // Count talking peers from awareness
      const aw = (mesh.room.provider as unknown as { awareness: AwarenessClock } | null)?.awareness;
      if (aw) {
        const states = aw.getStates();
        let talking = 0;
        let total = 0;
        states.forEach((state, id) => {
          total += 1;
          const tk = state["talk"] as { talking?: boolean; ts?: number } | undefined;
          if (tk?.talking) {
            // Self awareness in shared mode is included; in vipassana we suppress publishing
            // so self never appears.
            if (id === aw.clientID && session.mode === "vipassana") return;
            talking += 1;
          }
        });
        setTalkingCount(talking);
        setPeerCount(Math.max(0, total - 1));
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mesh, dbThreshold, session.mode, session.startedAt]);

  const onArm = async () => {
    try {
      const ctx = new AudioContext();
      await ctx.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2;
      src.connect(analyser);

      audioCtxRef.current = ctx;
      streamRef.current = stream;
      analyserRef.current = analyser;
      setMicEnabled(true);
      setArmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // Join without granting the mic — for a facilitator on a laptop (no mic,
  // or doesn't want to be monitored). They can still start/clear the shared
  // session and manually log breaks they hear; phones with mics auto-detect.
  // This path mutates the SAME shared Yjs doc the mic path does, so the
  // session and score sync to every peer identically.
  const onJoinNoMic = () => {
    setError(null);
    setMicEnabled(false);
    setArmed(true);
  };

  // Manually record a speech break into the SAME `breaks` Y.Map the mic-driven
  // rising-edge increments. Each break subtracts from the room silence score,
  // and the mutation propagates to every peer over the Yjs doc.
  const onLogBreak = () => {
    if (!mesh) return;
    const startedAtNow = mesh.sessionMap.get("startedAt");
    if (typeof startedAtNow !== "number") return;
    const t = mesh.clock.meshNow();
    const minIdx = Math.floor((t - startedAtNow) / 60_000);
    if (minIdx < 0 || minIdx >= 1000) return;
    mesh.room.doc.transact(() => {
      const cur = mesh.breaks.get(String(minIdx)) ?? 0;
      mesh.breaks.set(String(minIdx), cur + 1);
    });
  };

  const onStart = () => {
    if (!mesh) return;
    mesh.room.doc.transact(() => {
      mesh.sessionMap.set("startedAt", mesh.clock.meshNow());
      mesh.sessionMap.set("durationMs", durationMin * 60_000);
      mesh.sessionMap.set("mode", mode);
      // Clear any previous breaks
      mesh.breaks.forEach((_, k) => mesh.breaks.delete(k));
    });
    setMySpeechMs(0);
  };

  const onClear = () => {
    if (!mesh) return;
    mesh.room.doc.transact(() => {
      mesh.sessionMap.set("startedAt", null);
      mesh.breaks.forEach((_, k) => mesh.breaks.delete(k));
    });
    setMySpeechMs(0);
  };

  if (!armed) {
    return (
      <div className="quiet-arm">
        <h1>mesh-quiet-quest</h1>
        <p>
          A group silence game. Every phone listens to its own mic. While the whole room stays below
          the speech threshold, the shared score ticks up. Speak and the room loses points.
        </p>
        <p className="quiet-meta">
          Duration: <strong>{durationMin} min</strong> · mode: <strong>{mode}</strong>
        </p>
        <button type="button" className="quiet-arm-button" onClick={onArm}>
          Allow mic &amp; connect
        </button>
        <button type="button" className="quiet-arm-nomic" onClick={onJoinNoMic}>
          Join without mic (facilitator)
        </button>
        {error && <p className="quiet-error">Mic error: {error}</p>}
        <p className="quiet-hint">
          Calibrate the dB threshold in Settings to your room. No mic? Join as a facilitator — you
          can run the session and log breaks you hear by hand.
        </p>
      </div>
    );
  }

  const startedAt = session.startedAt;
  const isActive = startedAt !== null && now < startedAt + session.durationMs;
  const isFinished = startedAt !== null && now >= startedAt + session.durationMs;

  if (startedAt === null) {
    return (
      <div className="quiet-stage">
        <div className="quiet-hud">
          {phones(peerCount + 1)} connected
          {peerCount === 0 && " · waiting for others to join the room"}
        </div>
        <div className="quiet-pre">
          <h2>Ready</h2>
          <p>
            When everyone is in, tap Begin. The clock will tick down for{" "}
            <strong>{durationMin} min</strong>. Mode: <strong>{session.mode}</strong>.
          </p>
          <button type="button" className="quiet-begin" onClick={onStart}>
            Begin {durationMin}-minute session
          </button>
          <MicMeter db={dbfs} threshold={dbThreshold} talking={iAmTalking} />
        </div>
      </div>
    );
  }

  const remainingMs = Math.max(0, startedAt + session.durationMs - now);
  const elapsedMs = Math.min(session.durationMs, Math.max(0, now - startedAt));

  // Room score: at any moment we approximate "seconds of room-silence" as
  //   elapsedMs - sum(per-minute break overruns)
  // For simplicity we treat each "talking transition" as N seconds of penalty
  // by looking at awareness right now (anyone talking = the room is not silent).
  // The honest aggregate is the cumulative time-integral; we approximate by
  // counting now+history: per-minute counter says "this minute had K breaks";
  // each break ~ SPEECH_DEBOUNCE_MS+1s penalty (debounce window). We treat each
  // break = 2s penalty, and additionally subtract live talking time.
  // (Simple enough for the user-facing display.)

  // Live silence score:
  const elapsedSec = elapsedMs / 1000;
  let penaltySec = 0;
  if (mesh) {
    mesh.breaks.forEach((count) => {
      penaltySec += count * 2;
    });
  }
  const silenceSec = Math.max(0, Math.round(elapsedSec - penaltySec));
  const totalSec = session.durationMs / 1000;
  const silencePct = totalSec > 0 ? Math.min(100, (silenceSec / totalSec) * 100) : 0;

  if (isFinished) {
    return (
      <div className="quiet-stage">
        <div className="quiet-end">
          <h2>Session ended</h2>
          <p>
            The room kept silence for <strong>{silenceSec}s</strong> of {Math.round(totalSec)}s —{" "}
            <strong>{silencePct.toFixed(0)}%</strong>.
          </p>
          {session.mode === "vipassana" && (
            <p className="quiet-personal">
              You personally spoke for <strong>{(mySpeechMs / 1000).toFixed(0)}s</strong>. (Only you
              can see this.)
            </p>
          )}
          <button type="button" className="quiet-begin" onClick={onClear}>
            Reset session
          </button>
        </div>
      </div>
    );
  }

  // Active
  const mins = Math.floor(remainingMs / 60_000);
  const secs = Math.floor((remainingMs % 60_000) / 1000);
  // In vipassana, the talkingCount we render is the public one (excluded self).
  // In shared, talkingCount includes self if you are talking.
  const quietCount = peerCount + 1 - talkingCount;

  return (
    <div className="quiet-stage">
      <div className="quiet-hud">
        {phones(peerCount + 1)} · mode {session.mode}
      </div>
      <div className="quiet-active">
        <div className="quiet-remaining" data-testid="quiet-remaining">
          {mins}:{String(secs).padStart(2, "0")}
        </div>
        <div className="quiet-counts">
          <strong>{quietCount}</strong> of {phones(peerCount + 1)} quiet right now
        </div>
        <div className="quiet-score" data-testid="quiet-score">
          {silenceSec}s of room silence · {silencePct.toFixed(0)}%
        </div>
        <div className="quiet-penalty" data-testid="quiet-penalty">
          {Math.round(penaltySec)}s penalty from breaks
        </div>
        {micEnabled ? (
          <MicMeter db={dbfs} threshold={dbThreshold} talking={iAmTalking} />
        ) : (
          <button type="button" className="quiet-log-break" onClick={onLogBreak}>
            Log a break (someone spoke)
          </button>
        )}
      </div>
      <button type="button" className="quiet-clear" onClick={onClear}>
        Clear session
      </button>
    </div>
  );
}

function MicMeter({ db, threshold, talking }: { db: number; threshold: number; talking: boolean }) {
  // Map dBFS roughly: -80 .. 0 → 0..100%
  const pct = Math.max(0, Math.min(100, ((db + 80) / 80) * 100));
  const thrPct = Math.max(0, Math.min(100, ((threshold + 80) / 80) * 100));
  const safeDb = Number.isFinite(db) ? db.toFixed(0) : "−∞";
  return (
    <div className="quiet-mic">
      <div className="quiet-mic-bar">
        <div
          className="quiet-mic-bar-fill"
          style={{ width: `${pct}%`, background: talking ? "#ff5e7a" : "#5ed390" }}
        />
        <div className="quiet-mic-bar-threshold" style={{ left: `${thrPct}%` }} />
      </div>
      <div className="quiet-mic-label">
        {safeDb} dBFS · threshold {threshold} · {talking ? "talking" : "quiet"}
      </div>
    </div>
  );
}
