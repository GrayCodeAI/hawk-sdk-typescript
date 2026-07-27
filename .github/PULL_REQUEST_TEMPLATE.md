<!--
  Thanks for your contribution! Please fill out this template so reviewers can
  understand the change quickly. Anything that does not apply can be left in
  place; do not delete unanswered sections — write "n/a".
-->

## Summary

<!--
  One paragraph describing what this PR does and why. Link the related
  issue(s) with `Fixes #N` or `Refs #N` if applicable.
-->

## Changes

<!--
  Bullet list of what changed, grouped by area (client, agent, tools,
  streaming, errors, retry, types, version, CI, docs).
  Reviewers should be able to skim this and know what to look at first.
-->

-

## API impact

<!--
  Did you add, remove, rename, or change the signature of any exported
  symbol? List them here. If yes, confirm whether this is a breaking
  change and bump the version accordingly in `package.json` and
  `VERSION`. If no exported surface changed, write "n/a".
-->

## Daemon compatibility

<!--
  This SDK targets the hawk daemon `v1` API. Did you change endpoints,
  request/response shapes, headers, or status-code handling?

  - Which daemon versions did you test against (commit SHA / tag)?
  - Is the change wire-compatible with the latest released daemon?
  - If not, link the corresponding daemon PR.
-->

## Testing

<!--
  Describe how you tested. Paste output of `npm test` and `npm run typecheck`.
  If you added new tests, list them.
-->

```text
$ npm test
...
$ npm run typecheck
...
$ npm run lint
...
```

## Checklist

- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
      (`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `test:`, etc.)
- [ ] `npm test` passes locally
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] New or changed code has tests
- [ ] Public APIs have doc comments and type annotations
- [ ] `CHANGELOG.md` updated under `## [Unreleased]` if user-visible
- [ ] `package.json` version and `VERSION` file are bumped together if this is a release-eligible change
- [ ] No secrets, tokens, or PII added to the repo
