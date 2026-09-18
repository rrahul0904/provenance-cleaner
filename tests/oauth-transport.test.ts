import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
const unpacker = readFileSync("release/oauth-unpack.mjs", "utf8");
const packer = readFileSync("scripts/oauth-pack.mjs", "utf8");
const payloadWorkflow = readFileSync(".github/workflows/prepare-oauth-production-payload.yml", "utf8");

describe("OAuth production transport", () => {
  it("runs the certified unpacker before every production build", () => {
    expect(pkg.scripts.build).toBe("node release/oauth-unpack.mjs && next build");
  });

  it("is a no-op for normal Git checkouts without transport bundles", () => {
    expect(unpacker).toContain("bundlePaths.length === 0");
    expect(unpacker).toContain("using checked-out source tree");
  });

  it("requires the transport source hash to match the certified manifest", () => {
    expect(unpacker).toContain("bundleHash !== expectedSourceHash");
    expect(unpacker).toContain("OAuth transport bundle failed certification");
    expect(unpacker).toContain("gitBlobSha(entry.data)");
    expect(unpacker).toContain("actualBlobSha !== declaredBlobSha");
    expect(unpacker).toContain("sourceFingerprint(sourceEntries)");
    expect(unpacker).toContain("actualSourceHash !== expectedSourceHash");
  });

  it("rejects traversal and protects release bootstrap files from bundle overwrite", () => {
    expect(unpacker).toContain('normalized.startsWith("../")');
    expect(unpacker).toContain('"package.json"');
    expect(unpacker).toContain('"package-lock.json"');
    expect(unpacker).toContain('"release/source-manifest.json"');
    expect(unpacker).toContain('"release/oauth-unpack.mjs"');
    expect(unpacker).toContain("seenPaths.has(normalized)");
  });

  it("removes transport parts before Next.js build continues", () => {
    expect(unpacker).toContain("unlinkSync(bundlePath)");
  });

  it("packs only the certified tracked tree into bounded transport parts", () => {
    expect(pkg.scripts["release:oauth:pack"]).toBe("node scripts/oauth-pack.mjs");
    expect(packer).toContain("checkSourceManifest()");
    expect(packer).toContain("gitBlobSha(data)");
    expect(packer).toContain("TRANSPORT_PATHS.length");
    expect(packer).toContain("OAuth transport files must never be tracked");
    expect(packer).toContain("actualSha !== sha");
    expect(packer).toContain("writeFileSync(TRANSPORT_PATHS[index]");
  });

  it("publishes the OAuth payload only from the exact production-release SHA", () => {
    expect(payloadWorkflow).toContain("production-release");
    expect(payloadWorkflow).toContain("Refuse a different SHA");
    expect(payloadWorkflow).toContain("Require production-release push to match current main");
    expect(payloadWorkflow).toContain("npm run release:manifest:check");
    expect(payloadWorkflow).toContain("npm run release:oauth:pack");
    expect(payloadWorkflow).toContain("oauth-production-payload");
  });
});
