import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker = readFileSync("public/sw.js", "utf8");
const scanner = readFileSync("src/components/scanner-workbench.tsx", "utf8");
const editor = readFileSync("src/components/transform-workbench.tsx", "utf8");

describe("local-first offline boundary", () => {
  it("never places API responses into the offline cache", () => {
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain('request.method !== "GET"');
    expect(worker).not.toMatch(/cache\.put\([^\n]*api/iu);
  });

  it("keeps local scanning enabled and server-authoritative actions network gated", () => {
    expect(scanner).toContain("Offline mode is active.");
    expect(scanner).toContain("!challengeToken || !online");
    expect(editor).toContain("model-backed edits are disabled until connectivity returns");
    expect(editor).toContain("!challengeToken || !online");
  });
});
