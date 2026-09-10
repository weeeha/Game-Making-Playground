import assert from "node:assert/strict";
import test from "node:test";

import { chromium } from "playwright";

test("browser loads the board and exposes deterministic state", async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    await page.goto("http://127.0.0.1:4173/web-demo/");
    await page.evaluate(() => window.__livingChessReady);
    const state = JSON.parse(
      await page.evaluate(() => window.render_game_to_text()),
    );

    assert.equal(state.mode, "idle");
    assert.deepEqual(state.square, { file: 0, rank: 7 });
    assert.equal(state.assets.loadedFrames, 32);
  } finally {
    await browser.close();
  }
});
