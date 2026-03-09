const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Expand a user query into multiple diverse sub-queries.
 *
 * Uses OpenAI if a key is available, otherwise falls back to
 * a rule-based expansion that still produces useful variety.
 */
export async function expandQuery(
  query: string,
  count: number = 5,
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      return await expandWithLLM(query, count, apiKey);
    } catch (err) {
      console.warn("LLM expansion failed, falling back to rules:", err);
    }
  }

  return expandWithRules(query, count);
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

// ---------- Rule-based expansion (no API key needed) ----------

const ANGLE_TEMPLATES = [
  (q: string) => q, // original query
  (q: string) => `best ${q}`,
  (q: string) => `${q} guide`,
  (q: string) => `${q} examples`,
  (q: string) => `${q} comparison`,
  (q: string) => `${q} alternatives`,
  (q: string) => `how does ${q} work`,
  (q: string) => `${q} pros and cons`,
  (q: string) => `${q} tutorial`,
  (q: string) => `${q} review 2025`,
  (q: string) => `what is ${q}`,
  (q: string) => `${q} vs`,
  (q: string) => `top ${q}`,
  (q: string) => `${q} explained`,
  (q: string) => `${q} for beginners`,
];

function expandWithRules(query: string, count: number): string[] {
  const q = query.toLowerCase().trim();
  const expanded: string[] = [];

  for (let i = 0; i < Math.min(count, ANGLE_TEMPLATES.length); i++) {
    expanded.push(ANGLE_TEMPLATES[i](q));
  }

  return expanded;
}
