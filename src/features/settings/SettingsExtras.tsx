import type { Mode } from "../quiet/QuietQuest";

type Props = {
  durationMin: number;
  onDurationChange: (next: number) => void;
  mode: Mode;
  onModeChange: (next: Mode) => void;
  dbThreshold: number;
  onDbThresholdChange: (next: number) => void;
};

export function SettingsExtras({
  durationMin,
  onDurationChange,
  mode,
  onModeChange,
  dbThreshold,
  onDbThresholdChange,
}: Props) {
  return (
    <>
      <label>
        <span>Duration (minutes)</span>
        <input
          type="number"
          min={1}
          max={180}
          step={1}
          value={durationMin}
          onChange={(e) =>
            onDurationChange(Math.max(1, Math.min(180, Number(e.target.value) || 30)))
          }
        />
      </label>

      <label>
        <span>Mode</span>
        <select value={mode} onChange={(e) => onModeChange(e.target.value as Mode)}>
          <option value="shared">shared (aggregate only)</option>
          <option value="vipassana">vipassana (private, you see your own)</option>
        </select>
        <span className="mesh-settings-help">
          Shared: the room sees an aggregate "X of N phones quiet right now" — never who. Vipassana:
          nothing is published; only your own phone sees how long you spoke.
        </span>
      </label>

      <label>
        <span>Speech threshold ({dbThreshold} dBFS)</span>
        <input
          type="range"
          min={-50}
          max={-30}
          step={1}
          value={dbThreshold}
          onChange={(e) => onDbThresholdChange(Number(e.target.value))}
        />
        <span className="mesh-settings-help">
          Mic RMS above this for 500 ms continuous = speech. Lower (e.g. −50) = stricter (more
          sensitive); higher (e.g. −30) = looser. Calibrate to your room's baseline.
        </span>
      </label>

      <p className="mesh-settings-help">
        Use the <strong>Clear session</strong> button on the main screen to wipe the active session
        and per-minute break counter.
      </p>
    </>
  );
}
