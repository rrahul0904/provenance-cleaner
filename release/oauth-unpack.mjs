#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, posix } from "node:path";

const MANIFEST_PATH = "release/source-manifest.json";
const TRANSPORT_PATHS = Array.from(
  { length: 14 },
  (_, index) => `release/oauth-bundle-${index + 1}.json`,
);
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

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalJson(item)]),
    );
  }
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

function assertVercelConfigCompatible(actualContent, certifiedContent) {
  const actual = JSON.parse(actualContent);
  const certified = JSON.parse(certifiedContent);
  const allowedTopLevel = new Set(["$schema", "name", "installCommand", "git", "crons", "framework"]);

  for (const key of Object.keys(actual)) {
    if (!allowedTopLevel.has(key)) {
      throw new Error(`OAuth transport rejected unexpected Vercel configuration key: ${key}`);
    }
  }

  if (actual.name !== undefined && actual.name !== "provenance-cleaner") {
    throw new Error("OAuth transport Vercel project name integrity failed.");
  }

  if (actual.installCommand !== certified.installCommand) {
    throw new Error("OAuth transport Vercel install command integrity failed.");
  }
  if (!sameJson(actual.crons ?? [], certified.crons ?? [])) {
    throw new Error("OAuth transport Vercel cron configuration integrity failed.");
  }

  if (actual.git !== undefined) {
    const git = actual.git;
    if (
      !git ||
      typeof git !== "object" ||
      Array.isArray(git) ||
      git.deploymentEnabled !== false ||
      Object.keys(git).some((key) => key !== "deploymentEnabled")
    ) {
      throw new Error("OAuth transport Vercel Git configuration integrity failed.");
    }
  }

  if (actual.framework !== undefined && actual.framework !== "nextjs") {
    throw new Error("OAuth transport Vercel framework integrity failed.");
  }
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

const firstBundle = JSON.parse(readFileSync(bundlePaths[0], "utf8"));
if (
  firstBundle?.schemaVersion !== 3 ||
  String(firstBundle?.sourceHash ?? "").trim().toLowerCase() !== expectedSourceHash ||
  !Array.isArray(firstBundle.bootstrap)
) {
  throw new Error("OAuth transport bootstrap certification is invalid.");
}

const bootstrapJson = JSON.stringify(firstBundle.bootstrap);
const bootstrapMap = new Map(firstBundle.bootstrap.map((entry) => [entry?.path, entry]));
if (bootstrapMap.size !== DIRECT_SOURCE_PATHS.length) {
  throw new Error("OAuth transport bootstrap certification has an invalid file count.");
}

const sourceEntries = [];
const seenPaths = new Set();
let written = 0;

for (const directPath of DIRECT_SOURCE_PATHS) {
  const expected = bootstrapMap.get(directPath);
  if (
    !expected ||
    !/^[0-9a-f]{40}$/u.test(String(expected.blobSha ?? "")) ||
    !existsSync(directPath)
  ) {
    throw new Error(`OAuth transport missing direct certified file: ${directPath}`);
  }

  const data = readFileSync(directPath, "utf8");
  if (directPath === "vercel.json") {
    const certifiedData = typeof expected.data === "string" ? expected.data : "";
    if (!certifiedData || gitBlobSha(certifiedData) !== expected.blobSha) {
      throw new Error("OAuth transport certified Vercel configuration blob is invalid.");
    }
    assertVercelConfigCompatible(data, certifiedData);
    writeFileSync(directPath, certifiedData, "utf8");
  } else if (gitBlobSha(data) !== expected.blobSha) {
    throw new Error(`OAuth transport bootstrap blob integrity failed: ${directPath}`);
  }

  const certifiedBlobSha = gitBlobSha(readFileSync(directPath, "utf8"));
  if (certifiedBlobSha !== expected.blobSha) {
    throw new Error(`OAuth transport restored bootstrap blob integrity failed: ${directPath}`);
  }
  sourceEntries.push({ path: directPath, blobSha: certifiedBlobSha });
  seenPaths.add(directPath);
}

for (const bundlePath of bundlePaths) {
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  const bundleHash = String(bundle?.sourceHash ?? "").trim().toLowerCase();
  if (
    bundle?.schemaVersion !== 3 ||
    bundleHash !== expectedSourceHash ||
    JSON.stringify(bundle.bootstrap) !== bootstrapJson ||
    !Array.isArray(bundle.files)
  ) {
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
