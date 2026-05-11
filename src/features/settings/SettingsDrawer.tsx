import { useEffect, useState } from "react";
import {
  loadSignalingUrl,
  loadTurnTokenUrl,
  resetIceServers,
  saveSignalingUrl,
  saveTurnTokenUrl,
} from "../sync/iceConfig";
import { appConfig } from "../../shared/config";
import type { Mode } from "../quiet/QuietQuest";

type Props = {
  open: boolean;
  onClose: () => void;
  roomId: string;
  onRoomChange: (next: string) => void;
  durationMin: number;
  onDurationChange: (next: number) => void;
  mode: Mode;
  onModeChange: (next: Mode) => void;
  dbThreshold: number;
  onDbThresholdChange: (next: number) => void;
};

export function SettingsDrawer({
  open,
  onClose,
  roomId,
  onRoomChange,
  durationMin,
  onDurationChange,
  mode,
  onModeChange,
  dbThreshold,
  onDbThresholdChange,
}: Props) {
  const [signaling, setSignaling] = useState(loadSignalingUrl());
  const [tokenUrl, setTokenUrl] = useState(loadTurnTokenUrl());

  useEffect(() => {
    if (open) {
      setSignaling(loadSignalingUrl());
      setTokenUrl(loadTurnTokenUrl());
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-drawer" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <label>
          <span>Room ID</span>
          <input value={roomId} onChange={(e) => onRoomChange(e.target.value)} />
        </label>

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
          <span className="settings-help">
            Shared: the room sees an aggregate "X of N phones quiet right now" — never who.
            Vipassana: nothing is published; only your own phone sees how long you spoke.
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
          <span className="settings-help">
            Mic RMS above this for 500 ms continuous = speech. Lower (e.g. −50) = stricter (more
            sensitive); higher (e.g. −30) = looser. Calibrate to your room's baseline.
          </span>
        </label>

        <p className="settings-help">
          Use the <strong>Clear session</strong> button on the main screen to wipe the active
          session and per-minute break counter.
        </p>

        <hr />

        <h3>Self-hosted infra (advanced)</h3>
        <p className="settings-help">
          Override the default signaling and TURN endpoints. Leave blank to use the built-in
          defaults (<code>{appConfig.signalingUrl}</code> and <code>{appConfig.turnTokenUrl}</code>
          ).
        </p>

        <label>
          <span>Signaling URL</span>
          <input
            value={signaling}
            onChange={(e) => setSignaling(e.target.value)}
            placeholder={appConfig.signalingUrl}
          />
        </label>

        <label>
          <span>TURN credentials URL</span>
          <input
            value={tokenUrl}
            onChange={(e) => setTokenUrl(e.target.value)}
            placeholder={appConfig.turnTokenUrl}
          />
        </label>

        <div className="settings-actions">
          <button
            type="button"
            onClick={() => {
              saveSignalingUrl(signaling);
              saveTurnTokenUrl(tokenUrl);
              onClose();
              location.reload();
            }}
          >
            Save and reload
          </button>
          <button
            type="button"
            onClick={() => {
              saveSignalingUrl("");
              saveTurnTokenUrl("");
              resetIceServers();
              onClose();
              location.reload();
            }}
          >
            Reset to defaults
          </button>
        </div>

        <hr />

        <footer className="settings-footer">
          <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
            source on github
          </a>
          <span>
            v{appConfig.version} · {appConfig.commit}
          </span>
        </footer>
      </div>
    </div>
  );
}
