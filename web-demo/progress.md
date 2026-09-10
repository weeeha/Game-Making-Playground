Original prompt: can you now create chess board and add the character there (animated)

## Progress

- 2026-09-10: Confirmed the asset integrity test fails before staging the rook files.
- 2026-09-10: Added the responsive HTML/CSS shell and copied the corrected 32-frame RGBA rook set.
- 2026-09-10: Added the deterministic rook state machine; 6 asset/model tests pass.
- 2026-09-10: Added the Canvas board, asset loader, responsive scaling, controls, fullscreen shortcut, and deterministic browser hooks; 7 tests pass including Chrome smoke coverage.
- 2026-09-10: Verified horizontal and vertical movement, diagonal rejection, Strike, Death, dead-state input blocking, Reset, desktop and narrow layouts, and zero console errors in Playwright.
- 2026-09-10: Ran the prescribed web-game client; captured `test-artifacts/game-client/shot-0.png` with state `move`, target `e1`, position file `2.353`, frame `5`, and input locked.
- 2026-09-10: Final verification: `npm test` passed 8/8 tests; the source rook-frame isolation regression passed 1/1; `git diff --check` returned clean.

## Open items

- Consider adding an opposing character and capture choreography after this one-piece pilot is approved.
