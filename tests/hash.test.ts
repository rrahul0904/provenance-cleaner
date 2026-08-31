import { describe, expect, it } from "vitest";
import { sha256Hex } from "../src/lib/files/hash";

describe("SHA-256 receipts", () => {
  it("hashes bytes deterministically", async () => {
    const bytes = new TextEncoder().encode("abc");
    await expect(sha256Hex(bytes)).resolves.toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
