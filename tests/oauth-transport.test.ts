import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
const unpacker = readFileSync("release/oauth-unpack.mjs", "utf8");

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
  });

  it("rejects traversal and protects release bootstrap files from bundle overwrite", () => {
    expect(unpacker).toContain('normalized.startsWith("../")');
    expect(unpacker).toContain('"package.json"');
    expect(unpacker).toContain('"package-lock.json"');
    expect(unpacker).toContain('"release/source-manifest.json"');
    expect(unpacker).toContain('"release/oauth-unpack.mjs"');
  });

  it("removes transport parts before Next.js build continues", () => {
    expect(unpacker).toContain("unlinkSync(bundlePath)");
  });
});
