#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, posix } from "node:path";

const manifest = JSON.parse(readFileSync("release/source-manifest.json", "utf8"));
const expectedSourceHash = String(manifest?.sourceHash ?? "").trim().toLowerCase();
const bundlePaths = [
  "release/oauth-bundle-1.json",
  "release/oauth-bundle-2.json",
  "release/oauth-bundle-3.json",
  "release/oauth-bundle-4.json",
].filter(existsSync);

if (bundlePaths.length === 0) {
  console.log("OAuth transport: no bundle parts present; using checked-out source tree.");
  process.exit(0);
}

if (!/^[0-9a-f]{64}$/u.test(expectedSourceHash)) {
  throw new Error("OAuth transport requires a valid certified source manifest.");
}

const reserved = new Set([
  "package.json",
  "package-lock.json",
  "release/source-manifest.json",
  "release/oauth-unpack.mjs",
]);

let written = 0;
for (const bundlePath of bundlePaths) {
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  const bundleHash = String(bundle?.sourceHash ?? "").trim().toLowerCase();
  if (bundle?.schemaVersion !== 1 || bundleHash !== expectedSourceHash || !Array.isArray(bundle.files)) {
    throw new Error(`OAuth transport bundle failed certification: ${bundlePath}`);
  }

  for (const entry of bundle.files) {
    const rawPath = String(entry?.path ?? "");
    const normalized = posix.normalize(rawPath.replaceAll("\\", "/"));
    if (
      !rawPath ||
      normalized !== rawPath ||
      normalized.startsWith("/") ||
      normalized === ".." ||
      normalized.startsWith("../") ||
      reserved.has(normalized) ||
      typeof entry?.data !== "string"
    ) {
      throw new Error(`OAuth transport rejected unsafe or reserved path: ${rawPath || "<empty>"}`);
    }

    mkdirSync(dirname(normalized), { recursive: true });
    writeFileSync(normalized, entry.data, "utf8");
    written += 1;
  }
}

for (const bundlePath of bundlePaths) unlinkSync(bundlePath);
console.log(`OAuth transport: reconstructed ${written} certified source files for ${manifest.releaseId}.`);
