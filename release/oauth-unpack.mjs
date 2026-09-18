#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, posix } from "node:path";

const MANIFEST_PATH = "release/source-manifest.json";
const TRANSPORT_PATHS = [
  "release/oauth-bundle-1.json",
  "release/oauth-bundle-2.json",
  "release/oauth-bundle-3.json",
  "release/oauth-bundle-4.json",
];
const DIRECT_SOURCE_PATHS = [
  "package.json",
  "package-lock.json",
  "release/oauth-unpack.mjs",
  "vercel.json",
];
const RESERVED_PATHS = new Set([MANIFEST_PATH, ...TRANSPORT_PATHS, ...DIRECT_SOURCE_PATHS]);

function gitBlobSha(content) {
  const body = Buffer.from(content, "utf8");
  return createHash("sha1")
    .update(`blob ${body.length}\0`, "utf8")
    .update(body)
    .digest("hex");
}

function sourceFingerprint(entries) {
  const hash = createHash("sha256");
  for (const { path, blobSha } of [...entries].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(path, "utf8");
    hash.update("\0", "utf8");
    hash.update(blobSha, "utf8");
    hash.update("\n", "utf8");
  }
  return hash.digest("hex");
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const expectedSourceHash = String(manifest?.sourceHash ?? "").trim().toLowerCase();
const bundlePaths = TRANSPORT_PATHS.filter(existsSync);

if (bundlePaths.length === 0) {
  console.log("OAuth transport: no bundle parts present; using checked-out source tree.");
  process.exit(0);
}

if (!/^[0-9a-f]{64}$/u.test(expectedSourceHash)) {
  throw new Error("OAuth transport requires a valid certified source manifest.");
}

const sourceEntries = [];
const seenPaths = new Set();
let written = 0;

for (const directPath of DIRECT_SOURCE_PATHS) {
  if (!existsSync(directPath)) throw new Error(`OAuth transport missing direct certified file: ${directPath}`);
  const data = readFileSync(directPath, "utf8");
  sourceEntries.push({ path: directPath, blobSha: gitBlobSha(data) });
  seenPaths.add(directPath);
}

for (const bundlePath of bundlePaths) {
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  const bundleHash = String(bundle?.sourceHash ?? "").trim().toLowerCase();
  if (bundle?.schemaVersion !== 1 || bundleHash !== expectedSourceHash || !Array.isArray(bundle.files)) {
    throw new Error(`OAuth transport bundle failed certification: ${bundlePath}`);
  }

  for (const entry of bundle.files) {
    const rawPath = String(entry?.path ?? "");
    const normalized = posix.normalize(rawPath.replaceAll("\\", "/"));
    const declaredBlobSha = String(entry?.blobSha ?? "").trim().toLowerCase();
    if (
      !rawPath ||
      normalized !== rawPath ||
      normalized.startsWith("/") ||
      normalized === ".." ||
      normalized.startsWith("../") ||
      RESERVED_PATHS.has(normalized) ||
      seenPaths.has(normalized) ||
      typeof entry?.data !== "string" ||
      !/^[0-9a-f]{40}$/u.test(declaredBlobSha)
    ) {
      throw new Error(`OAuth transport rejected unsafe, duplicate, or reserved path: ${rawPath || "<empty>"}`);
    }

    const actualBlobSha = gitBlobSha(entry.data);
    if (actualBlobSha !== declaredBlobSha) {
      throw new Error(`OAuth transport blob integrity failed: ${normalized}`);
    }

    mkdirSync(dirname(normalized), { recursive: true });
    writeFileSync(normalized, entry.data, "utf8");
    sourceEntries.push({ path: normalized, blobSha: actualBlobSha });
    seenPaths.add(normalized);
    written += 1;
  }
}

const actualSourceHash = sourceFingerprint(sourceEntries);
if (actualSourceHash !== expectedSourceHash) {
  throw new Error(
    `OAuth transport reconstructed source hash ${actualSourceHash} does not match certified hash ${expectedSourceHash}`,
  );
}

for (const bundlePath of bundlePaths) unlinkSync(bundlePath);
console.log(
  `OAuth transport: reconstructed ${written} source files; certified ${sourceEntries.length} tracked files for ${manifest.releaseId}.`,
);
