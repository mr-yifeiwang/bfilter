# AGENTS.md

## Scope

This repository is a plain JavaScript userscript for Bilibili. The main file is `main.user.js`. Documentation is in `README.md` and `docs/manual.md`.

## Rules

Match the existing JavaScript style. Use named helper functions when they reduce duplication, isolate nontrivial logic, or make DOM/filtering behavior easier to reason about. Do not split simple linear code into extra functions solely for abstraction. Use conservative DOM selectors.

## Testing

There is no assumed automated test harness unless one already exists.

## Documentation

Update `docs/manual.md` for behavior, setting, storage, or UI changes. Update `README.md` only for high-level installation or feature changes.
