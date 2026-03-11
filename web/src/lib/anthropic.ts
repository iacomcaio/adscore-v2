import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey && process.env.LLM_PROVIDER === "anthropic") {
  throw new Error("ANTHROPIC_API_KEY is not set but LLM_PROVIDER=anthropic");
}

export const anthropic = new Anthropic({
  apiKey: apiKey || "not-configured",
});
