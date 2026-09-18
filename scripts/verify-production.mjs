#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { verifyDeployment } from "./lib/release-integrity.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const manifest = JSON.parse(
  readFileSync(new URL("../release/source-manifest.json", import.meta.url), "utf8"),
);
const origin = argument("--url") || process.env.PRODUCTION_URL;
const expectedSha = argument("--expected-sha") || process.env.EXPECTED_SHA || process.env.GITHUB_SHA;
const expectedSourceHash =
  argument("--expected-source-hash") ||
  process.env.EXPECTED_SOURCE_HASH ||
  manifest.sourceHash;
const attempts = positiveInteger(argument("--attempts") || process.env.VERIFY_ATTEMPTS, 1);
const delayMs = positiveInteger(argument("--delay-ms") || process.env.VERIFY_DELAY_MS, 0);

if (!origin) {
  console.error("Production verification requires --url or PRODUCTION_URL.");
  process.exit(2);
}
if (!expectedSha) {
  console.error("Production verification requires --expected-sha, EXPECTED_SHA, or GITHUB_SHA.");
  process.exit(2);
}
if (!expectedSourceHash) {
  console.error("Production verification requires a certified source hash.");
  process.exit(2);
}

const report = await verifyDeployment({
  origin,
  expectedSha,
  expectedSourceHash,
  attempts,
  delayMs,
});
console.log(JSON.stringify(report, null, 2));

if (!report?.ok) {
  console.error("Production source-integrity/readiness verification failed.");
  process.exit(1);
}
