export const BOARD_SIZE = 8;
export const MOVE_DURATION_MS = 850;

export const ANIMATIONS = Object.freeze({
  idle: Object.freeze({ frames: 6, frameDurationMs: 180, playback: "ping-pong" }),
  move: Object.freeze({ frames: 8, frameDurationMs: 100, playback: "loop" }),
  strike: Object.freeze({ frames: 8, frameDurationMs: 85, playback: "once" }),
  death: Object.freeze({ frames: 10, frameDurationMs: 110, playback: "once" }),
});

const IDLE_SEQUENCE = Object.freeze([0, 1, 2, 3, 4, 5, 4, 3, 2, 1]);

function copySquare(square) {
  return { file: square.file, rank: square.rank };
}

function isBoardCoordinate(value) {
  return Number.isInteger(value) && value >= 0 && value < BOARD_SIZE;
}

function enterMode(state, mode) {
  state.mode = mode;
  state.frame = mode === "dead" ? ANIMATIONS.death.frames - 1 : 0;
  state.frameStep = 0;
  state.frameElapsedMs = 0;
  state.inputLocked = mode !== "idle";
}

export function createGameState(startSquare = { file: 0, rank: 7 }) {
  if (!isBoardCoordinate(startSquare.file) || !isBoardCoordinate(startSquare.rank)) {
    throw new RangeError("Starting square must be on the 8 x 8 board");
  }

  return {
    mode: "idle",
    square: copySquare(startSquare),
    sourceSquare: null,
    targetSquare: null,
    position: copySquare(startSquare),
    facing: "right",
    frame: 0,
    frameStep: 0,
    frameElapsedMs: 0,
    moveElapsedMs: 0,
    inputLocked: false,
    invalidSquare: null,
    loaded: true,
    error: null,
  };
}

export function isLegalRookMove(state, file, rank) {
  if (!isBoardCoordinate(file) || !isBoardCoordinate(rank)) {
    return false;
  }

  const sameFile = file === state.square.file;
  const sameRank = rank === state.square.rank;
  const sameSquare = sameFile && sameRank;
  return !sameSquare && (sameFile || sameRank);
}

export function beginMove(state, file, rank) {
  if (state.inputLocked || state.error) {
    return false;
  }

  if (!isLegalRookMove(state, file, rank)) {
    if (isBoardCoordinate(file) && isBoardCoordinate(rank)) {
      state.invalidSquare = { file, rank, remainingMs: 300 };
    }
    return false;
  }

  state.sourceSquare = copySquare(state.square);
  state.targetSquare = { file, rank };
  state.position = copySquare(state.square);
  state.moveElapsedMs = 0;
  if (file > state.square.file) {
    state.facing = "right";
  } else if (file < state.square.file) {
    state.facing = "left";
  }
  enterMode(state, "move");
  return true;
}

export function triggerAnimation(state, name) {
  if (state.inputLocked || state.error || !["idle", "strike", "death"].includes(name)) {
    return false;
  }

  enterMode(state, name);
  return true;
}

export function resetGame(state) {
  const loaded = state.loaded;
  const error = state.error;
  Object.assign(state, createGameState(), { loaded, error });
  return state;
}

function advanceLoop(state, milliseconds, definition, sequence = null) {
  state.frameElapsedMs += milliseconds;
  const steps = Math.floor(state.frameElapsedMs / definition.frameDurationMs);
  state.frameElapsedMs %= definition.frameDurationMs;

  if (steps === 0) {
    return;
  }

  if (sequence) {
    state.frameStep = (state.frameStep + steps) % sequence.length;
    state.frame = sequence[state.frameStep];
  } else {
    state.frame = (state.frame + steps) % definition.frames;
  }
}

function advanceOneShot(state, milliseconds, definition, completedMode) {
  state.frameElapsedMs += milliseconds;
  const steps = Math.floor(state.frameElapsedMs / definition.frameDurationMs);
  state.frameElapsedMs %= definition.frameDurationMs;
  if (steps === 0) {
    return;
  }

  const nextFrame = state.frame + steps;
  if (nextFrame < definition.frames) {
    state.frame = nextFrame;
    return;
  }

  enterMode(state, completedMode);
}

function advanceMove(state, milliseconds) {
  const remaining = MOVE_DURATION_MS - state.moveElapsedMs;
  const movingMilliseconds = Math.min(milliseconds, remaining);
  state.moveElapsedMs += movingMilliseconds;
  advanceLoop(state, movingMilliseconds, ANIMATIONS.move);

  const progress = Math.min(1, state.moveElapsedMs / MOVE_DURATION_MS);
  state.position = {
    file:
      state.sourceSquare.file +
      (state.targetSquare.file - state.sourceSquare.file) * progress,
    rank:
      state.sourceSquare.rank +
      (state.targetSquare.rank - state.sourceSquare.rank) * progress,
  };

  if (progress === 1) {
    state.square = copySquare(state.targetSquare);
    state.position = copySquare(state.targetSquare);
    state.sourceSquare = null;
    state.targetSquare = null;
    state.moveElapsedMs = 0;
    enterMode(state, "idle");
  }
}

export function advanceGame(state, milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return state;
  }

  if (state.invalidSquare) {
    state.invalidSquare.remainingMs -= milliseconds;
    if (state.invalidSquare.remainingMs <= 0) {
      state.invalidSquare = null;
    }
  }

  if (state.mode === "move") {
    advanceMove(state, milliseconds);
  } else if (state.mode === "idle") {
    advanceLoop(state, milliseconds, ANIMATIONS.idle, IDLE_SEQUENCE);
  } else if (state.mode === "strike") {
    advanceOneShot(state, milliseconds, ANIMATIONS.strike, "idle");
  } else if (state.mode === "death") {
    advanceOneShot(state, milliseconds, ANIMATIONS.death, "dead");
  }

  return state;
}
