import {
  advanceGame,
  beginMove,
  createGameState,
  isLegalRookMove,
  resetGame,
  triggerAnimation,
} from "./game-model.js";

const LOGICAL_SIZE = 1024;
const BOARD_ORIGIN = 96;
const BOARD_PIXELS = 832;
const CELL_SIZE = BOARD_PIXELS / 8;
const ROOK_PIVOT = { x: 128, y: 236 };
const ROOK_SCALE = 0.64;

const canvas = document.querySelector("#game-canvas");
const context = canvas.getContext("2d");
const loadingPanel = document.querySelector("#loading-panel");
const loadingCopy = document.querySelector("#loading-copy");
const status = document.querySelector("#status");
const buttons = [...document.querySelectorAll("[data-action]")];

const state = createGameState();
state.loaded = false;

const assets = {
  metadata: null,
  frames: {},
  loadedFrames: 0,
};

let hoverSquare = null;
let lastTimestamp = null;
let manualClock = false;
let devicePixelRatio = 1;

function frameUrl(animation, frameNumber) {
  const number = String(frameNumber + 1).padStart(2, "0");
  return `./assets/rook/${animation}/${animation}-${number}.png`;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${url}`));
    image.src = url;
  });
}

async function loadAssets() {
  try {
    const response = await fetch("./assets/rook/rook-animation.json");
    if (!response.ok) {
      throw new Error(`Animation metadata returned ${response.status}`);
    }

    assets.metadata = await response.json();
    const jobs = [];
    for (const [name, definition] of Object.entries(assets.metadata.animations)) {
      assets.frames[name] = [];
      for (let index = 0; index < definition.frames; index += 1) {
        jobs.push(
          loadImage(frameUrl(name, index)).then((image) => {
            assets.frames[name][index] = image;
            assets.loadedFrames += 1;
            loadingCopy.textContent = `Preparing the board… ${assets.loadedFrames}/32`;
          }),
        );
      }
    }

    await Promise.all(jobs);
    state.loaded = true;
    loadingPanel.hidden = true;
    updateControls();
    render();
    return true;
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
    loadingCopy.textContent = "The rook animation could not be loaded.";
    loadingPanel.classList.add("error");
    status.textContent = state.error;
    updateControls();
    render();
    return false;
  }
}

function resizeCanvas() {
  devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.round(LOGICAL_SIZE * devicePixelRatio);
  if (canvas.width !== width || canvas.height !== width) {
    canvas.width = width;
    canvas.height = width;
  }
  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  context.imageSmoothingEnabled = false;
  render();
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawBackdrop() {
  const gradient = context.createRadialGradient(512, 310, 40, 512, 512, 700);
  gradient.addColorStop(0, "#24334a");
  gradient.addColorStop(0.58, "#121b29");
  gradient.addColorStop(1, "#090d15");
  context.fillStyle = gradient;
  context.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);

  context.save();
  context.globalAlpha = 0.13;
  context.strokeStyle = "#91a4c2";
  context.lineWidth = 2;
  for (let offset = -600; offset < 1200; offset += 72) {
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset + 620, LOGICAL_SIZE);
    context.stroke();
  }
  context.restore();
}

function drawBoardFrame() {
  context.save();
  context.shadowColor = "rgba(0, 0, 0, 0.58)";
  context.shadowBlur = 34;
  context.shadowOffsetY = 20;
  const frameGradient = context.createLinearGradient(64, 64, 960, 960);
  frameGradient.addColorStop(0, "#8f6738");
  frameGradient.addColorStop(0.34, "#4f321e");
  frameGradient.addColorStop(0.72, "#6d4828");
  frameGradient.addColorStop(1, "#2e1b12");
  context.fillStyle = frameGradient;
  roundedRect(context, 56, 56, 912, 912, 30);
  context.fill();
  context.restore();

  context.save();
  context.strokeStyle = "rgba(246, 208, 124, 0.58)";
  context.lineWidth = 4;
  roundedRect(context, 73, 73, 878, 878, 18);
  context.stroke();
  context.strokeStyle = "rgba(18, 10, 6, 0.8)";
  context.lineWidth = 8;
  roundedRect(context, 88, 88, 848, 848, 7);
  context.stroke();
  context.restore();
}

function squarePath(file, rank) {
  context.beginPath();
  context.rect(
    BOARD_ORIGIN + file * CELL_SIZE,
    BOARD_ORIGIN + rank * CELL_SIZE,
    CELL_SIZE,
    CELL_SIZE,
  );
}

function sameSquare(first, second) {
  return Boolean(
    first && second && first.file === second.file && first.rank === second.rank,
  );
}

function drawBoard() {
  const light = "#d7bd89";
  const dark = "#806044";
  const files = "abcdefgh";

  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const x = BOARD_ORIGIN + file * CELL_SIZE;
      const y = BOARD_ORIGIN + rank * CELL_SIZE;
      context.fillStyle = (file + rank) % 2 === 0 ? light : dark;
      context.fillRect(x, y, CELL_SIZE, CELL_SIZE);

      const tileLight = context.createLinearGradient(x, y, x, y + CELL_SIZE);
      tileLight.addColorStop(0, "rgba(255,255,255,0.08)");
      tileLight.addColorStop(0.54, "rgba(255,255,255,0)");
      tileLight.addColorStop(1, "rgba(20,10,4,0.12)");
      context.fillStyle = tileLight;
      context.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    }
  }

  context.save();
  context.font = "700 15px ui-sans-serif, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (let file = 0; file < 8; file += 1) {
    context.fillStyle = file % 2 === 0 ? "rgba(73,45,28,.68)" : "rgba(238,219,178,.72)";
    context.fillText(
      files[file],
      BOARD_ORIGIN + (file + 0.5) * CELL_SIZE,
      BOARD_ORIGIN + BOARD_PIXELS - 14,
    );
  }
  context.textAlign = "left";
  for (let rank = 0; rank < 8; rank += 1) {
    context.fillStyle = rank % 2 === 0 ? "rgba(73,45,28,.68)" : "rgba(238,219,178,.72)";
    context.fillText(
      String(8 - rank),
      BOARD_ORIGIN + 9,
      BOARD_ORIGIN + (rank + 0.5) * CELL_SIZE,
    );
  }
  context.restore();

  if (state.loaded && !state.inputLocked && hoverSquare) {
    const legal = isLegalRookMove(state, hoverSquare.file, hoverSquare.rank);
    squarePath(hoverSquare.file, hoverSquare.rank);
    context.fillStyle = legal ? "rgba(48, 107, 185, 0.28)" : "rgba(171, 48, 55, 0.25)";
    context.fill();
    context.strokeStyle = legal ? "#6ca7f2" : "#d96566";
    context.lineWidth = 5;
    context.stroke();
  }

  if (state.invalidSquare) {
    squarePath(state.invalidSquare.file, state.invalidSquare.rank);
    context.fillStyle = "rgba(198, 47, 53, 0.34)";
    context.fill();
    context.strokeStyle = "#f07a73";
    context.lineWidth = 7;
    context.stroke();
  }

  squarePath(state.square.file, state.square.rank);
  context.strokeStyle = "rgba(247, 201, 100, 0.88)";
  context.lineWidth = 6;
  context.stroke();
}

function boardPositionToCanvas(position) {
  return {
    x: BOARD_ORIGIN + (position.file + 0.5) * CELL_SIZE,
    y: BOARD_ORIGIN + (position.rank + 0.5) * CELL_SIZE,
  };
}

function drawRook() {
  if (!state.loaded || state.error) {
    return;
  }

  const animation = state.mode === "dead" ? "death" : state.mode;
  const frames = assets.frames[animation];
  const frame = frames?.[Math.min(state.frame, frames.length - 1)];
  if (!frame) {
    return;
  }

  const position = boardPositionToCanvas(state.position);
  const floorY = position.y + CELL_SIZE * 0.35;

  context.save();
  context.globalAlpha = state.mode === "dead" ? 0.6 : 0.24;
  context.fillStyle = "#0b0c10";
  context.beginPath();
  context.ellipse(position.x, floorY, 43, 15, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.translate(position.x, floorY);
  context.scale(state.facing === "left" ? -ROOK_SCALE : ROOK_SCALE, ROOK_SCALE);
  context.imageSmoothingEnabled = false;
  context.drawImage(frame, -ROOK_PIVOT.x, -ROOK_PIVOT.y);
  context.restore();
}

function drawLoadingState() {
  if (state.loaded) {
    return;
  }

  context.save();
  context.fillStyle = "rgba(8, 13, 22, 0.5)";
  context.fillRect(BOARD_ORIGIN, BOARD_ORIGIN, BOARD_PIXELS, BOARD_PIXELS);
  context.restore();
}

function updateControls() {
  const unavailable = !state.loaded || Boolean(state.error);
  for (const button of buttons) {
    const action = button.dataset.action;
    button.disabled = unavailable || (state.inputLocked && action !== "reset");
    button.setAttribute("aria-pressed", String(action === state.mode));
  }

  if (state.error) {
    status.textContent = state.error;
  } else if (!state.loaded) {
    status.textContent = `Loading ${assets.loadedFrames}/32 frames…`;
  } else if (state.mode === "dead") {
    status.textContent = "The Iron Rook has fallen · Reset to continue";
  } else if (state.mode === "move") {
    const target = state.targetSquare;
    status.textContent = `Moving to ${String.fromCharCode(97 + target.file)}${8 - target.rank}`;
  } else {
    status.textContent = `${state.mode[0].toUpperCase()}${state.mode.slice(1)} · ${String.fromCharCode(97 + state.square.file)}${8 - state.square.rank}`;
  }
}

function render() {
  context.save();
  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
  drawBackdrop();
  drawBoardFrame();
  drawBoard();
  drawRook();
  drawLoadingState();
  context.restore();
  updateControls();
}

function pointerToSquare(event) {
  const rect = canvas.getBoundingClientRect();
  const logicalX = ((event.clientX - rect.left) / rect.width) * LOGICAL_SIZE;
  const logicalY = ((event.clientY - rect.top) / rect.height) * LOGICAL_SIZE;
  const file = Math.floor((logicalX - BOARD_ORIGIN) / CELL_SIZE);
  const rank = Math.floor((logicalY - BOARD_ORIGIN) / CELL_SIZE);
  if (file < 0 || file > 7 || rank < 0 || rank > 7) {
    return null;
  }
  return { file, rank };
}

canvas.addEventListener("pointermove", (event) => {
  hoverSquare = pointerToSquare(event);
});

canvas.addEventListener("pointerleave", () => {
  hoverSquare = null;
});

canvas.addEventListener("click", (event) => {
  if (!state.loaded || state.inputLocked || state.error) {
    return;
  }
  const square = pointerToSquare(event);
  if (square) {
    beginMove(state, square.file, square.rank);
    render();
  }
});

for (const button of buttons) {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "reset") {
      resetGame(state);
    } else {
      triggerAnimation(state, action);
    }
    render();
  });
}

document.addEventListener("keydown", async (event) => {
  if (event.key.toLowerCase() !== "f" || event.repeat) {
    return;
  }
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.querySelector(".game-shell").requestFullscreen();
    }
  } catch {
    // Fullscreen is an optional enhancement and must not interrupt play.
  }
});

window.addEventListener("resize", resizeCanvas);
document.addEventListener("fullscreenchange", resizeCanvas);

window.render_game_to_text = () =>
  JSON.stringify({
    coordinateSystem: "file 0-7 left-to-right; rank 0-7 top-to-bottom",
    board: {
      logicalSize: LOGICAL_SIZE,
      origin: BOARD_ORIGIN,
      cellSize: CELL_SIZE,
    },
    mode: state.mode,
    square: { ...state.square },
    targetSquare: state.targetSquare ? { ...state.targetSquare } : null,
    position: {
      file: Number(state.position.file.toFixed(3)),
      rank: Number(state.position.rank.toFixed(3)),
    },
    frame: state.frame,
    facing: state.facing,
    inputLocked: state.inputLocked,
    hoverSquare: hoverSquare ? { ...hoverSquare } : null,
    invalidSquare: state.invalidSquare
      ? { file: state.invalidSquare.file, rank: state.invalidSquare.rank }
      : null,
    assets: {
      loadedFrames: assets.loadedFrames,
      ready: state.loaded,
      error: state.error,
    },
  });

window.advanceTime = (milliseconds) => {
  manualClock = true;
  advanceGame(state, milliseconds);
  render();
};

function tick(timestamp) {
  if (lastTimestamp === null) {
    lastTimestamp = timestamp;
  }
  if (!manualClock && state.loaded && !state.error) {
    const elapsed = Math.min(50, Math.max(0, timestamp - lastTimestamp));
    advanceGame(state, elapsed);
    render();
  }
  lastTimestamp = timestamp;
  window.requestAnimationFrame(tick);
}

resizeCanvas();
window.__livingChessReady = loadAssets();
window.requestAnimationFrame(tick);
