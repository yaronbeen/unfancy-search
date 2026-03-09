const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Expand a user query into multiple diverse sub-queries.
 *
 * Requires ANTHROPIC_API_KEY to be set. Throws an error if the key is missing.
 */
export async function expandQuery(
  query: string,
  count: number = 5,
): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — query expansion requires an Anthropic key",
    );
  }
  return expandWithLLM(query, count, apiKey);
}

async function expandWithLLM(
  query: string,
  count: number,
  apiKey: string,
): Promise<string[]> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: `You are a search query expansion engine. Given a user query, generate exactly ${count} diverse search queries that would help thoroughly research this topic. Cover different angles, synonyms, and related aspects. Return ONLY a JSON array of strings, no explanation.`,
      messages: [
        {
          role: "user",
          content: query,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text || "[]";

  // Strip markdown code fences if present
  const cleaned = content.replace(/```(?:json)?\n?/g, "").trim();
  const queries = JSON.parse(cleaned);
  if (Array.isArray(queries) && queries.length > 0) {
    return queries.slice(0, count);
  }

  return [query];
}
