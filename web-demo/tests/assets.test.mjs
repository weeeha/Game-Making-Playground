import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("the demo contains all declared rook frames", async () => {
  const root = new URL("../assets/rook/", import.meta.url);
  const metadata = JSON.parse(
    await readFile(new URL("rook-animation.json", root), "utf8"),
  );
  let total = 0;

  for (const [name, animation] of Object.entries(metadata.animations)) {
    for (let index = 1; index <= animation.frames; index += 1) {
      const filename = `${name}/${name}-${String(index).padStart(2, "0")}.png`;
      await access(new URL(filename, root));
      total += 1;
    }
  }

  assert.equal(total, 32);
});
