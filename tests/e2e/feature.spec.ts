import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

/**
 * Load-bearing cross-peer assertions for the advertised core action:
 * "a mic-monitored group silence game; the shared score ticks up while the
 * room stays quiet, and drops when someone speaks."
 *
 * The live mic level cannot be driven from two headless browsers, so we use
 * the no-mic facilitator path (which arms the SAME shared Yjs doc without
 * getUserMedia) and the manual break button (which increments the EXACT SAME
 * `breaks` Y.Map the mic's rising-edge writes). We drive both on peer A and
 * assert the OPPOSITE peer B sees the propagated result — proving the shared
 * session and the shared score genuinely cross the mesh, sensor or no sensor.
 */
test("starting a session on peer A and logging a break syncs to peer B", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // Both peers join as no-mic facilitators (no getUserMedia needed headless).
    await a.getByRole("button", { name: /join without mic/i }).click();
    await b.getByRole("button", { name: /join without mic/i }).click();

    // Both should now be in the pre-session "Ready" screen.
    await expect(a.getByRole("heading", { name: /ready/i })).toBeVisible();
    await expect(b.getByRole("heading", { name: /ready/i })).toBeVisible();

    // Peer A starts the shared session (mutates the `session` Y.Map).
    await a.getByRole("button", { name: /begin .*minute session/i }).click();

    // Cross-peer #1: peer B leaves "Ready" and shows the live countdown —
    // because the started session propagated over the shared Yjs doc.
    await expect(b.getByTestId("quiet-remaining")).toBeVisible({ timeout: 15_000 });
    await expect(b.getByTestId("quiet-penalty")).toContainText("0s penalty from breaks");

    // Peer A logs a manual speech break (increments the shared `breaks` Y.Map).
    await a.getByRole("button", { name: /log a break/i }).click();

    // Cross-peer #2 (the load-bearing one): peer B's penalty — computed purely
    // from the `breaks` map it received over the mesh — now reflects the break.
    await expect(b.getByTestId("quiet-penalty")).toContainText("2s penalty from breaks", {
      timeout: 15_000,
    });
  } finally {
    await cleanup();
  }
});
