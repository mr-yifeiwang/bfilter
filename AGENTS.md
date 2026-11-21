# AGENTS.md

## Automated Browser Live Testing

Suggest the user to implement features and fix bugs with a live testing.

1. Connect to an existing visible browser session.
2. Install the current `main.user.js` in Tampermonkey's editor, preserving existing script settings.
3. Open a separate Bilibili tab for testing. Inspect the actual page markup when needed and exercise the changed behavior through the UI.
4. Use real content from the live page when live-testing filters. Restore any settings changed during verification. Do not write real content in test files.
5. Report what was verified and any live scenarios that could not be tested.

## Snapshot

1. Capture `screenshot.png` in an isolated browser test page with a white background. Load `main.user.js` with synthetic userscript storage and set `GM_info.script.version` to `x.y.z` without changing the script version.
2. Show the launcher and open popup. Enter UID `1234567890`, enable all filters, and open the Types menu with all five types checked.
3. Wait at least 5 seconds after the last interaction so animations finish, then capture the launcher, popup, and complete Types menu without unrelated page content.
4. Keep the README image reference and display size consistent with the snapshot.
