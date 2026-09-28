import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceGame,
  beginMove,
  createGameState,
  isLegalRookMove,
  resetGame,
  triggerAnimation,
} from "../game-model.js";

test("rook accepts orthogonal destinations and rejects diagonals", () => {
  const state = createGameState();

  assert.equal(isLegalRookMove(state, 0, 4), true);
  assert.equal(isLegalRookMove(state, 3, 7), true);
  assert.equal(isLegalRookMove(state, 3, 4), false);
  assert.equal(isLegalRookMove(state, 0, 7), false);
});

test("invalid movement leaves the rook in place and briefly marks the square", () => {
  const state = createGameState();

  assert.equal(beginMove(state, 2, 5), false);
  assert.deepEqual(state.square, { file: 0, rank: 7 });
  assert.deepEqual(state.invalidSquare, { file: 2, rank: 5, remainingMs: 300 });
  advanceGame(state, 300);
  assert.equal(state.invalidSquare, null);
});

test("move interpolates, commits its target, and returns to idle", () => {
  const state = createGameState();

  assert.equal(beginMove(state, 4, 7), true);
  advanceGame(state, 425);
  assert.deepEqual(state.position, { file: 2, rank: 7 });
  assert.equal(state.mode, "move");
  assert.equal(state.inputLocked, true);

  advanceGame(state, 425);
  assert.deepEqual(state.square, { file: 4, rank: 7 });
  assert.deepEqual(state.position, { file: 4, rank: 7 });
  assert.equal(state.mode, "idle");
  assert.equal(state.inputLocked, false);
  assert.equal(state.facing, "right");
});

test("leftward movement mirrors while vertical movement retains facing", () => {
  const state = createGameState({ file: 4, rank: 7 });

  beginMove(state, 1, 7);
  advanceGame(state, 850);
  assert.equal(state.facing, "left");

  beginMove(state, 1, 2);
  advanceGame(state, 850);
  assert.equal(state.facing, "left");
});

test("strike returns to idle and death holds until reset", () => {
  const state = createGameState();

  assert.equal(triggerAnimation(state, "strike"), true);
  advanceGame(state, 1000);
  assert.equal(state.mode, "idle");
  assert.equal(state.inputLocked, false);

  assert.equal(triggerAnimation(state, "death"), true);
  advanceGame(state, 2000);
  assert.equal(state.mode, "dead");
  assert.equal(state.frame, 9);
  assert.equal(state.inputLocked, true);
  assert.equal(triggerAnimation(state, "strike"), false);

  resetGame(state);
  assert.equal(state.mode, "idle");
  assert.deepEqual(state.square, { file: 0, rank: 7 });
  assert.equal(state.frame, 0);
  assert.equal(state.inputLocked, false);
});
