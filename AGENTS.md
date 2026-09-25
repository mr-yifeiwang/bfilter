# AGENTS.md

Before making changes, read `main.user.js`, `README.md`, and `docs/manual.md`.

## Development and Testing

1. Follow test-driven development (TDD). When changing behavior in `main.user.js`, update the corresponding tests and run `npm test` to verify the changes.
1. Update `docs/manual.md` whenever behavior defined in `main.user.js` changes.
1. Follow the Conventional Commits specification for commit messages. Update the version according to the type of change:
   - Increment the minor version when adding a feature.
   - Increment the patch version when fixing a bug.
