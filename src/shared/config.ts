export const appConfig = {
  appName: "mesh-quiet-quest",
  storagePrefix: "mesh-quiet-quest",
  description:
    "Gamified group silence — phones listen to their mics (or a facilitator logs breaks by hand) and the shared score ticks up while the room stays quiet.",
  accentHex: "#5ed390",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
  repositoryUrl: "https://github.com/baditaflorin/mesh-quiet-quest",
  pagesUrl: "https://baditaflorin.github.io/mesh-quiet-quest/",
  signalingUrl:
    (import.meta.env.VITE_WEBRTC_SIGNALING as string | undefined) ?? "wss://turn.0docker.com/ws",
  turnTokenUrl:
    (import.meta.env.VITE_TURN_TOKEN_URL as string | undefined) ??
    "https://turn.0docker.com/credentials",
  paypalUrl: "https://www.paypal.com/paypalme/florinbadita",
} as const;
