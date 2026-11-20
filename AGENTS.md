# AGENTS.md

## Automated Browser Live Testing

Suggest the user to implement features and fix bugs with a live testing.

1. Connect to an existing visible browser session.
2. Install the current `main.user.js` in Tampermonkey's editor, preserving existing script settings.
3. Open a separate Bilibili tab for testing. Inspect the actual page markup when needed and exercise the changed behavior through the UI.
4. Use real content from the live page when live-testing filters. Restore any settings changed during verification. Do not write real content in test files.
5. Report what was verified and any live scenarios that could not be tested.
