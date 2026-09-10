const ORTHOGONAL_NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function isMattePixel(data, offset, minimumBrightness, neutralTolerance) {
  if (data[offset + 3] === 0) {
    return false;
  }

  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const darkest = Math.min(red, green, blue);
  const lightest = Math.max(red, green, blue);
  return darkest >= minimumBrightness && lightest - darkest <= neutralTolerance;
}

export function cleanSpriteMatte(
  imageData,
  { maxDepth = 3, minimumBrightness = 132, neutralTolerance = 28 } = {},
) {
  const { width, height } = imageData;
  const data = new Uint8ClampedArray(imageData.data);
  const size = width * height;
  const exterior = new Uint8Array(size);
  const queue = [];

  const enqueueTransparent = (x, y) => {
    const index = y * width + x;
    if (exterior[index] || data[index * 4 + 3] !== 0) {
      return;
    }
    exterior[index] = 1;
    queue.push(index);
  };

  for (let x = 0; x < width; x += 1) {
    enqueueTransparent(x, 0);
    enqueueTransparent(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueueTransparent(0, y);
    enqueueTransparent(width - 1, y);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const x = index % width;
    const y = Math.floor(index / width);
    for (const [dx, dy] of ORTHOGONAL_NEIGHBORS) {
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
        enqueueTransparent(nextX, nextY);
      }
    }
  }

  let frontier = queue;
  let removedPixels = 0;
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const nextFrontier = [];
    const queued = new Uint8Array(size);
    for (const index of frontier) {
      const x = index % width;
      const y = Math.floor(index / width);
      for (const [dx, dy] of ORTHOGONAL_NEIGHBORS) {
        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
          continue;
        }
        const nextIndex = nextY * width + nextX;
        if (exterior[nextIndex] || queued[nextIndex]) {
          continue;
        }
        const offset = nextIndex * 4;
        if (!isMattePixel(data, offset, minimumBrightness, neutralTolerance)) {
          continue;
        }
        queued[nextIndex] = 1;
        nextFrontier.push(nextIndex);
      }
    }

    for (const index of nextFrontier) {
      data[index * 4 + 3] = 0;
      exterior[index] = 1;
      removedPixels += 1;
    }
    frontier = nextFrontier;
  }

  return { width, height, data, removedPixels };
}
