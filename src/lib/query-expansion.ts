const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Expand a user query into multiple diverse sub-queries.
 *
 * Requires OPENAI_API_KEY to be set. Throws an error if the key is missing.
 */
export async function expandQuery(
  query: string,
  count: number = 5,
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set — query expansion requires an OpenAI key",
    );
  }
  return expandWithLLM(query, count, apiKey);
}

// ---------- LLM-based expansion (OpenAI) ----------

async function expandWithLLM(
  query: string,
  count: number,
  apiKey: string,
): Promise<string[]> {
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are a search query expansion engine. Given a user query, generate exactly ${count} diverse search queries that would help thoroughly research this topic. Cover different angles, synonyms, and related aspects. Return ONLY a JSON array of strings, no explanation.`,
        },
        {
          role: "user",
          content: query,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "[]";

  // Strip markdown code fences if present
  const cleaned = content.replace(/```(?:json)?\n?/g, "").trim();
  const queries = JSON.parse(cleaned);
  if (Array.isArray(queries) && queries.length > 0) {
    return queries.slice(0, count);
  }

  return [query];
}
