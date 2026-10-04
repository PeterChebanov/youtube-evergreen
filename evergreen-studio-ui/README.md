# Evergreen Studio UI package

Hand this folder to the coding agent. Start with `DESIGN_SPEC.md`.

1. Read `DESIGN_SPEC.md` (rules, tokens, components, all 8 screens, acceptance checklist).
2. Open `reference/index.html` in a browser. It is the visual source of truth.
3. Copy `tokens.css` and `components.css` into the app's global styles unchanged.
4. Rebuild each screen from `reference/screens/*.html` as Angular components using the same markup and class names.
5. Verify with `npm i -D playwright && npx playwright install chromium && node check-layout.js`. It must print `ALL CLEAR`.

Suggested prompt for the agent:
"Implement the UI in this package exactly. Follow DESIGN_SPEC.md. Do not change tokens.css or components.css. Do not add a UI library. Finish only when check-layout.js passes against the real app."
