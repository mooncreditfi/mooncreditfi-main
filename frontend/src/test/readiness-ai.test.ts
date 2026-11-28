import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateStructuredResponse } from "@/lib/readiness-ai.server";

const request = {
  instructions: "Return a checklist.",
  input: JSON.stringify({ business_name: "Test business" }),
  schema: { type: "object" },
};

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("generateStructuredResponse", () => {
  beforeEach(() => {
    vi.stubEnv("READINESS_AI_API_URL", "https://ai.example.test/v1/responses");
    vi.stubEnv("READINESS_AI_API_KEY", "test-token");
    vi.stubEnv("READINESS_AI_MODEL", "test-model");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends a structured-output request and extracts response text", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      response(200, {
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: '{"summary":"Ready","checklist":[]}' }],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateStructuredResponse(request)).resolves.toBe(
      '{"summary":"Ready","checklist":[]}',
    );

    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error("Expected the AI request to be sent.");
    const [url, options] = call;
    expect(url).toBe("https://ai.example.test/v1/responses");
    expect(new Headers(options?.headers).get("authorization")).toBe("Bearer test-token");
    expect(JSON.parse(String(options?.body))).toMatchObject({
      model: "test-model",
      instructions: request.instructions,
      input: request.input,
      text: { format: { type: "json_schema", schema: request.schema } },
    });
  });

  it("fails explicitly when the server API key is missing", async () => {
    vi.stubEnv("READINESS_AI_API_KEY", "");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateStructuredResponse(request)).rejects.toThrow(
      "Readiness AI is not configured.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves the rate-limit message from the AI service", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response(429, {})));

    await expect(generateStructuredResponse(request)).rejects.toThrow(
      "The assistant is busy. Please try again in a minute.",
    );
  });
});
