#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { checkSourceManifest, SOURCE_MANIFEST_PATH } from "./source-manifest.mjs";

const TRANSPORT_PATHS = Array.from(
  { length: 14 },
  (_, index) => `release/oauth-bundle-${index + 1}.json`,
);
const DIRECT_SOURCE_PATHS = new Set([
  "package.json",
  "package-lock.json",
  "release/oauth-unpack.mjs",
  "vercel.json",
]);
const TRANSPORT_PATH_SET = new Set(TRANSPORT_PATHS);

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

function canonicalJsonSha256(content) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalJson(JSON.parse(content))), "utf8")
    .digest("hex");
}

function trackedEntries() {
  const output = execFileSync("git", ["ls-files", "-s"], { encoding: "utf8" });
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf("\t");
      if (tab < 0) throw new Error(`Invalid git ls-files entry: ${line}`);
      const [mode, sha, stage] = line.slice(0, tab).trim().split(/\s+/u);
      const path = line.slice(tab + 1);
      if (!mode || !sha || stage !== "0") {
        throw new Error(`Unsupported git index entry: ${line}`);
      }
      return { path, sha };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

for (const path of TRANSPORT_PATHS) {
  if (existsSync(path)) unlinkSync(path);
}

const certification = checkSourceManifest();
const entries = trackedEntries();

for (const { path } of entries) {
  if (TRANSPORT_PATH_SET.has(path)) {
    throw new Error(`OAuth transport files must never be tracked in the certified source tree: ${path}`);
  }
}

const sourceFiles = [];
for (const { path, sha } of entries) {
  if (path === SOURCE_MANIFEST_PATH || DIRECT_SOURCE_PATHS.has(path)) continue;
  const data = readFileSync(path, "utf8");
  const actualSha = gitBlobSha(data);
  if (actualSha !== sha) {
    throw new Error(
      `OAuth packer requires UTF-8 source whose Git blob matches the index: ${path}`,
    );
  }
  sourceFiles.push({
    path,
    blobSha: sha,
    data,
    bytes: Buffer.byteLength(data, "utf8"),
  });
}

const bootstrap = [];
for (const path of DIRECT_SOURCE_PATHS) {
  const entry = entries.find((item) => item.path === path);
  if (!entry) throw new Error(`OAuth packer missing required direct source file: ${path}`);
  const data = readFileSync(path, "utf8");
  if (gitBlobSha(data) !== entry.sha) {
    throw new Error(`OAuth packer direct file differs from the Git index: ${path}`);
  }
  bootstrap.push({
    path,
    blobSha: entry.sha,
    ...(path === "vercel.json" ? { canonicalJsonSha256: canonicalJsonSha256(data) } : {}),
  });
}

const bins = Array.from({ length: TRANSPORT_PATHS.length }, () => ({
  bytes: 0,
  files: [],
}));

for (const file of [...sourceFiles].sort((a, b) => b.bytes - a.bytes)) {
  bins.sort((a, b) => a.bytes - b.bytes);
  bins[0].files.push(file);
  bins[0].bytes += file.bytes;
}

bins.forEach((bin, index) => {
  const payload = {
    schemaVersion: 2,
    sourceHash: certification.sourceHash,
    bootstrap,
    files: bin.files.map(({ path, blobSha, data }) => ({ path, blobSha, data })),
  };
  writeFileSync(TRANSPORT_PATHS[index], JSON.stringify(payload), "utf8");
});

const totalBytes = bins.reduce((sum, bin) => sum + bin.bytes, 0);
console.log(
  `OAuth transport: packed ${sourceFiles.length} tracked files (${totalBytes} UTF-8 bytes) into ${TRANSPORT_PATHS.length} certified parts for ${certification.releaseId}.`,
);
