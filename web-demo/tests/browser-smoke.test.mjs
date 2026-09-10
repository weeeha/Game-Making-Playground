import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { chromium } from "playwright";

const artifacts = new URL("../test-artifacts/", import.meta.url);

async function readState(page) {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

async function clickSquare(page, file, rank) {
  const state = await readState(page);
  const bounds = await page.locator("#game-canvas").boundingBox();
  assert.ok(bounds, "canvas should have a visible bounding box");
  const logicalX = state.board.origin + (file + 0.5) * state.board.cellSize;
  const logicalY = state.board.origin + (rank + 0.5) * state.board.cellSize;
  await page.mouse.click(
    bounds.x + (logicalX / state.board.logicalSize) * bounds.width,
    bounds.y + (logicalY / state.board.logicalSize) * bounds.height,
  );
}

function collectConsoleErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  return errors;
}

test("browser loads the board and exposes deterministic state", async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = collectConsoleErrors(page);

  try {
    await page.goto("http://127.0.0.1:4173/web-demo/");
    await page.evaluate(() => window.__livingChessReady);
    await page.evaluate(() => window.advanceTime(0));
    const state = await readState(page);

    assert.equal(state.mode, "idle");
    assert.deepEqual(state.square, { file: 0, rank: 7 });
    assert.equal(state.assets.loadedFrames, 32);
    assert.deepEqual(consoleErrors, []);
  } finally {
    await browser.close();
  }
});

test("rook movement and one-shot animations complete end to end", async () => {
  await mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = collectConsoleErrors(page);

  try {
    await page.goto("http://127.0.0.1:4173/web-demo/");
    await page.evaluate(() => window.__livingChessReady);
    await page.evaluate(() => window.advanceTime(0));
    await page.screenshot({
      path: fileURLToPath(new URL("idle-desktop.png", artifacts)),
      fullPage: true,
    });

    await clickSquare(page, 4, 7);
    let state = await readState(page);
    assert.equal(state.mode, "move");
    assert.equal(state.inputLocked, true);

    await page.evaluate(() => window.advanceTime(425));
    state = await readState(page);
    assert.equal(state.mode, "move");
    assert.deepEqual(state.position, { file: 2, rank: 7 });
    await page.screenshot({
      path: fileURLToPath(new URL("move-midpoint.png", artifacts)),
      fullPage: true,
    });

    await page.evaluate(() => window.advanceTime(425));
    state = await readState(page);
    assert.equal(state.mode, "idle");
    assert.deepEqual(state.square, { file: 4, rank: 7 });

    await clickSquare(page, 4, 2);
    await page.evaluate(() => window.advanceTime(850));
    state = await readState(page);
    assert.deepEqual(state.square, { file: 4, rank: 2 });

    await clickSquare(page, 2, 4);
    state = await readState(page);
    assert.deepEqual(state.square, { file: 4, rank: 2 });
    assert.deepEqual(state.invalidSquare, { file: 2, rank: 4 });
    await page.evaluate(() => window.advanceTime(300));

    await page.locator('[data-action="strike"]').click();
    await page.evaluate(() => window.advanceTime(340));
    state = await readState(page);
    assert.equal(state.mode, "strike");
    await page.screenshot({
      path: fileURLToPath(new URL("strike-midpoint.png", artifacts)),
      fullPage: true,
    });
    await page.evaluate(() => window.advanceTime(340));
    assert.equal((await readState(page)).mode, "idle");

    await page.locator('[data-action="death"]').click();
    await page.evaluate(() => window.advanceTime(1100));
    state = await readState(page);
    assert.equal(state.mode, "dead");
    assert.equal(state.frame, 9);
    assert.equal(state.inputLocked, true);
    await page.screenshot({
      path: fileURLToPath(new URL("death-final.png", artifacts)),
      fullPage: true,
    });

    await clickSquare(page, 4, 6);
    assert.deepEqual((await readState(page)).square, { file: 4, rank: 2 });
    assert.equal(await page.locator('[data-action="strike"]').isDisabled(), true);

    await page.locator('[data-action="reset"]').click();
    state = await readState(page);
    assert.equal(state.mode, "idle");
    assert.deepEqual(state.square, { file: 0, rank: 7 });

    await page.setViewportSize({ width: 820, height: 1180 });
    await page.screenshot({
      path: fileURLToPath(new URL("idle-narrow.png", artifacts)),
      fullPage: true,
    });
    assert.deepEqual(consoleErrors, []);
  } finally {
    await browser.close();
  }
});
