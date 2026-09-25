# AGENTS.md

Before making changes, read `main.user.js`, `README.md`, and `docs/manual.md`.

## Development and Testing

1. Follow test-driven development (TDD). When changing behavior in `main.user.js`, update the corresponding tests and run `npm test` to verify the changes.
1. Update `docs/manual.md` whenever behavior defined in `main.user.js` changes.
1. Follow the Semantic Versioning (SemVer) specification for versioning. Update the version across the whole repo:
   - Increment the minor version when adding a feature.
   - Increment the patch version when fixing a bug.
