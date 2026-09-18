#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const SOURCE_MANIFEST_PATH = "release/source-manifest.json";

function trackedBlobEntries() {
  const output = execFileSync("git", ["ls-files", "-s"], { encoding: "utf8" });
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf("\t");
      if (tab < 0) throw new Error(`Invalid git ls-files entry: ${line}`);
      const metadata = line.slice(0, tab).trim().split(/\s+/u);
      const path = line.slice(tab + 1);
      const [, sha, stage] = metadata;
      if (!sha || stage !== "0") throw new Error(`Unsupported git index entry: ${line}`);
      return { path, sha };
    })
    .filter(({ path }) => path !== SOURCE_MANIFEST_PATH)
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function computeTrackedSourceHash() {
  const hash = createHash("sha256");
  for (const { path, sha } of trackedBlobEntries()) {
    hash.update(path, "utf8");
    hash.update("\0", "utf8");
    hash.update(sha, "utf8");
    hash.update("\n", "utf8");
  }
  return hash.digest("hex");
}

export function loadSourceManifest() {
  return JSON.parse(readFileSync(SOURCE_MANIFEST_PATH, "utf8"));
}

export function checkSourceManifest() {
  const manifest = loadSourceManifest();
  const actual = computeTrackedSourceHash();
  const expected = String(manifest?.sourceHash ?? "").trim().toLowerCase();
  const releaseId = String(manifest?.releaseId ?? "").trim();

  if (!/^[0-9a-f]{64}$/u.test(expected)) {
    throw new Error("release/source-manifest.json must contain a 64-character sourceHash");
  }
  if (!releaseId) {
    throw new Error("release/source-manifest.json must contain releaseId");
  }
  if (actual !== expected) {
    throw new Error(`source manifest mismatch: expected ${expected}, actual ${actual}`);
  }

  return { releaseId, sourceHash: actual };
}

if (process.argv.includes("--check")) {
  const result = checkSourceManifest();
  console.log(`source manifest ok: ${result.releaseId} ${result.sourceHash}`);
} else if (process.argv.includes("--print")) {
  console.log(computeTrackedSourceHash());
}
