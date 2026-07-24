/**
 * Version is the single source of truth for the SDK's reported version and
 * must stay in sync with the repo-root VERSION file. This test pins the two
 * together so a release that bumps VERSION without updating the constant
 * fails CI.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Version } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const versionFromFile = readFileSync(join(repoRoot, "VERSION"), "utf8").trim();

test("Version constant matches repo-root VERSION file", () => {
  assert.equal(
    Version,
    versionFromFile,
    `src/version.ts Version (${Version}) disagrees with VERSION file (${versionFromFile})`,
  );
});
