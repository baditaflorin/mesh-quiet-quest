import { useEffect, useState } from "react";
import { MeshShell } from "@baditaflorin/mesh-common";
import { QuietQuest, type Mode } from "./features/quiet/QuietQuest";
import { SettingsExtras } from "./features/settings/SettingsExtras";
import { appConfig } from "./shared/config";

const STORAGE = {
  room: `${appConfig.storagePrefix}:room`,
  duration: `${appConfig.storagePrefix}:duration`,
  mode: `${appConfig.storagePrefix}:mode`,
  threshold: `${appConfig.storagePrefix}:threshold`,
};

function readString(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback;
}
function readNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function App() {
  const [roomId, setRoomId] = useState(() => readString(STORAGE.room, "default"));
  const [durationMin, setDurationMin] = useState(() =>
    Math.max(1, Math.min(180, readNumber(STORAGE.duration, 30))),
  );
  const [mode, setMode] = useState<Mode>(() =>
    readString(STORAGE.mode, "shared") === "vipassana" ? "vipassana" : "shared",
  );
  const [dbThreshold, setDbThreshold] = useState(() =>
    Math.max(-50, Math.min(-30, readNumber(STORAGE.threshold, -40))),
  );

  useEffect(() => {
    localStorage.setItem(STORAGE.room, roomId);
  }, [roomId]);
  useEffect(() => {
    localStorage.setItem(STORAGE.duration, String(durationMin));
  }, [durationMin]);
  useEffect(() => {
    localStorage.setItem(STORAGE.mode, mode);
  }, [mode]);
  useEffect(() => {
    localStorage.setItem(STORAGE.threshold, String(dbThreshold));
  }, [dbThreshold]);

  return (
    <MeshShell
      config={appConfig}
      roomId={roomId}
      onRoomChange={setRoomId}
      settingsExtras={
        <SettingsExtras
          durationMin={durationMin}
          onDurationChange={setDurationMin}
          mode={mode}
          onModeChange={setMode}
          dbThreshold={dbThreshold}
          onDbThresholdChange={setDbThreshold}
        />
      }
    >
      <QuietQuest roomId={roomId} durationMin={durationMin} mode={mode} dbThreshold={dbThreshold} />
    </MeshShell>
  );
}
