type StructuredResponseRequest = {
  instructions: string;
  input: string;
  schema: Record<string, unknown>;
};

const GENERATION_ERROR = "The checklist could not be generated. Please try again.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractOutputText(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload["output"])) return "";

  return payload["output"].reduce<string>((output, item) => {
    if (!isRecord(item) || item["type"] !== "message" || !Array.isArray(item["content"])) {
      return output;
    }

    return (
      output +
      item["content"].reduce<string>((contentText, content) => {
        if (
          isRecord(content) &&
          content["type"] === "output_text" &&
          typeof content["text"] === "string"
        ) {
          return contentText + content["text"];
        }
        return contentText;
      }, "")
    );
  }, "");
}

export async function generateStructuredResponse({
  instructions,
  input,
  schema,
}: StructuredResponseRequest): Promise<string> {
  const apiKey = process.env["READINESS_AI_API_KEY"];
  if (!apiKey) {
    throw new Error("Readiness AI is not configured. Set READINESS_AI_API_KEY on the server.");
  }

  let response: Response;
  try {
    response = await fetch(
      process.env["READINESS_AI_API_URL"] || "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env["READINESS_AI_MODEL"] || "gpt-4.1-mini",
          instructions,
          input,
          text: {
            format: {
              type: "json_schema",
              name: "readiness",
              strict: true,
              schema,
            },
          },
        }),
      },
    );
  } catch (error) {
    console.error("Readiness AI request failed", error);
    throw new Error(GENERATION_ERROR);
  }

  if (response.status === 429) {
    throw new Error("The assistant is busy. Please try again in a minute.");
  }
  if (response.status === 402) {
    throw new Error("AI credits are used up. Please top up to continue.");
  }
  if (!response.ok) {
    console.error("Readiness AI returned an unsuccessful response", response.status);
    throw new Error(GENERATION_ERROR);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    console.error("Readiness AI returned invalid JSON", error);
    throw new Error(GENERATION_ERROR);
  }

  const output = extractOutputText(payload);
  if (!output) throw new Error(GENERATION_ERROR);
  return output;
}
