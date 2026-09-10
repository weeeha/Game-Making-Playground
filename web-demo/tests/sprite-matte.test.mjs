import assert from "node:assert/strict";
import test from "node:test";

import { cleanSpriteMatte } from "../sprite-matte.js";

function fixture() {
  const width = 9;
  const height = 7;
  const data = new Uint8ClampedArray(width * height * 4);

  function pixel(x, y, [red, green, blue, alpha = 255]) {
    const offset = (y * width + x) * 4;
    data.set([red, green, blue, alpha], offset);
  }

  // Dark outline around white armor.
  for (let y = 2; y <= 4; y += 1) {
    for (let x = 3; x <= 5; x += 1) {
      pixel(x, y, [22, 20, 18]);
    }
  }
  pixel(4, 3, [244, 242, 238]);

  // Baked checkerboard fringe outside the outline.
  pixel(2, 2, [246, 247, 245]);
  pixel(2, 3, [185, 187, 184]);
  pixel(1, 3, [252, 250, 247]);

  // A saturated gold edge highlight is legitimate sprite art.
  pixel(6, 3, [236, 170, 34]);

  return { width, height, data };
}

test("removes bright neutral matte connected to the exterior", () => {
  const image = fixture();
  const cleaned = cleanSpriteMatte(image);

  const alphaAt = (x, y) => cleaned.data[(y * cleaned.width + x) * 4 + 3];
  assert.equal(alphaAt(1, 3), 0);
  assert.equal(alphaAt(2, 3), 0);
  assert.equal(alphaAt(2, 2), 0);
});

test("preserves armor behind the outline and saturated edge colors", () => {
  const image = fixture();
  const cleaned = cleanSpriteMatte(image);

  const alphaAt = (x, y) => cleaned.data[(y * cleaned.width + x) * 4 + 3];
  assert.equal(alphaAt(4, 3), 255);
  assert.equal(alphaAt(3, 3), 255);
  assert.equal(alphaAt(6, 3), 255);
});
