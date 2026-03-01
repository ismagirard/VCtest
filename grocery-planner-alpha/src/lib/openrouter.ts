import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Default model: GPT-4o Mini — cheap, fast, good tool use, bilingual
export const defaultModel = openrouter("openai/gpt-4o-mini");
