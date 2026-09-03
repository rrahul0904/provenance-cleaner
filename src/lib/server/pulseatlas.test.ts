import { afterEach, describe, expect, it, vi } from "vitest";
import { trackInspectionCompleted } from "./pulseatlas";

afterEach(() => { vi.restoreAllMocks(); delete process.env.PULSEATLAS_ENDPOINT; delete process.env.PULSEATLAS_WRITE_KEY; });

describe("PulseAtlas observability", () => {
  it("is disabled and fail-open without configuration", async () => {
    expect(await trackInspectionCompleted({ fileType: "text", operation: "inspect", result: "success" })).toBe(false);
  });
  it("sends only the explicit safe inspection fields", async () => {
    process.env.PULSEATLAS_ENDPOINT = "https://pulse.example/api/events";
    process.env.PULSEATLAS_WRITE_KEY = "test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 202 }));
    await trackInspectionCompleted({ fileType: "text", operation: "inspect", result: "success" });
    const init = fetchMock.mock.calls[0]?.[1];
    const payload = JSON.parse(String(init?.body));
    expect(payload.properties).toEqual({ file_type: "text", operation: "inspect", result: "success" });
    expect(JSON.stringify(payload)).not.toMatch(/document_content|extracted_text|prompt_text/i);
  });
});
