#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";

const [command, ...args] = process.argv.slice(2);
const baseUrl = (process.env.PROVENANCE_API_URL || "http://localhost:3000").replace(/\/$/u, "");
const apiKey = process.env.PROVENANCE_API_KEY?.trim();

function usage(exitCode = 0) {
  console.error(`Usage:
  PROVENANCE_API_KEY=pc_sk_... npm run provenance:cli -- usage
  PROVENANCE_API_KEY=pc_sk_... npm run provenance:cli -- scan <file|-> [none|conservative|aggressive]
  PROVENANCE_API_KEY=pc_sk_... npm run provenance:cli -- transform <file|-> <mode> [operation-id]

Optional: PROVENANCE_API_URL=https://your-host.example`);
  process.exit(exitCode);
}

if (!command || !["usage", "scan", "transform"].includes(command)) usage(1);
if (!apiKey) {
  console.error("PROVENANCE_API_KEY is required.");
  process.exit(1);
}

async function readInput(path) {
  if (!path) usage(1);
  if (path === "-") {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
  }
  return readFile(path, "utf8");
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({ error: { message: "Non-JSON response" } }));
  if (!response.ok) {
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(body, null, 2));
}

if (command === "usage") {
  await request("/api/v1/usage");
} else if (command === "scan") {
  const text = await readInput(args[0]);
  const sanitize = args[1] || "none";
  if (!["none", "conservative", "aggressive"].includes(sanitize)) usage(1);
  await request("/api/v1/scan", { method: "POST", body: JSON.stringify({ text, sanitize }) });
} else {
  const text = await readInput(args[0]);
  const mode = args[1];
  if (!mode) usage(1);
  const operationId = args[2] || crypto.randomUUID();
  await request("/api/v1/transform", { method: "POST", body: JSON.stringify({ operationId, text, mode }) });
}
