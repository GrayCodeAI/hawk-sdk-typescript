# Contributing to hawk-sdk-typescript

Thanks for your interest! This guide covers the conventions used across the
hawk-eco. The eco-wide standards (versioning, release tooling, repo layout)
are defined in <https://github.com/GrayCodeAI/hawk/blob/main/VERSIONING.md>.

## Quick start

1. Fork the repo and create a feature branch off `main`:
   ```bash
   git checkout -b feat/short-description
   ```
2. Make your changes in small, focused commits.
3. Run the full local check before pushing:
   ```bash
   npm test
   npm run typecheck
   npm run lint
   ```
4. Open a pull request. CI will re-run the same checks plus security
   scanning and dependency auditing.

## Build & test

```bash
npm install       # install dev dependencies (typescript, tsx, node:test)
npm run build     # compile to dist/
npm run typecheck # type-check without emitting
npm test          # run the test suite (node:test via tsx)
npm run lint      # run linter
```

The runtime build in `dist/` has **zero dependencies** — it relies only on the
global `fetch`, `ReadableStream`, and `TextDecoder` available in Node 18+.

## Commit message convention

We use [Conventional Commits](https://www.conventionalcommits.org/). This
isn't cosmetic — release-please reads commit messages to bump the `VERSION`
file and generate the CHANGELOG, so getting them right matters.

```
<type>(<optional scope>): <short summary>

<optional body>

<optional footer(s)>
```

**Types:**

- `feat:` — a new feature (triggers a minor version bump)
- `fix:` — a bug fix (triggers a patch version bump)
- `perf:` — performance improvement
- `refactor:` — code restructure with no behaviour change
- `docs:` — documentation only
- `test:` — adding or fixing tests
- `build:` — build system or dependencies
- `ci:` — CI configuration
- `chore:` — anything else (no release effect)
- `revert:` — reverts a previous commit

**Breaking changes:** add `!` after the type/scope or include `BREAKING
CHANGE:` in the footer. This triggers a major version bump.

## Pull request checklist

Before requesting review:

- [ ] `npm test` passes locally.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] New behaviour has tests; bug fixes have a regression test.
- [ ] `CHANGELOG.md` entries are **not** edited manually — release-please
      generates them from your commit messages.
- [ ] The `VERSION` file is **not** edited manually — release-please bumps
      it on release.
- [ ] Public API changes have updated doc comments.
- [ ] No secrets, API keys, or PII in code, comments, tests, or fixtures.

## Code review etiquette

- Reviewers focus on correctness, design, and tests; formatting is
  enforced by tooling, not humans.
- Authors respond to every comment (resolved, addressed, or politely
  declined with rationale) — no silent dismissals.
- Squash-merge by default; the PR title becomes the commit (so it must
  be a valid Conventional Commit message).
- One approving review from a CODEOWNERS-listed reviewer is required.

## Reporting bugs

Open an issue using the bug-report template. Include the
`hawk-sdk-typescript` version, reproduction steps, expected behaviour, and
actual behaviour.

## Reporting security issues

**Do not open a public issue.** See [SECURITY.md](./SECURITY.md) for
private reporting channels.

## License

By contributing, you agree that your contributions will be licensed under
the same license as this repo (see [LICENSE](./LICENSE)).
