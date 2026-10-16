
interface Env {
  AI: {
    run: (
      model: string,
      inputs: Record<string, unknown>
    ) => Promise<unknown>;
  };
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function extractText(value: any): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  const candidates = [
    value.response,
    value.result?.response,
    value.output,
    value.content,
    value.message?.content,
    value.choices?.[0]?.message?.content
  ];

  for (const item of candidates) {
    if (typeof item === "string" && item.trim()) {
      return item.trim();
    }

    if (Array.isArray(item)) {
      const text = item
        .map((part: any) => part?.text || "")
        .join("\n")
        .trim();

      if (text) return text;
    }
  }

  return "";
}

async function handleChat(request: Request, env: Env) {
  const body = await request.json() as Record<string, unknown>;

  const idea = typeof body.idea === "string"
    ? body.idea.trim()
    : "";

  if (idea.length < 8) {
    return json({
      error: "Maglagay muna ng mas malinaw na drama idea."
    }, 400);
  }

  const language = String(body.language || "Tagalog");
  const genre = String(body.genre || "Horror");
  const style = String(body.visualStyle || "Cinematic realistic");
  const minutes = Math.min(
    10,
    Math.max(1, Number(body.durationMinutes) || 5)
  );

  const prompt = `
You are AI Drama Studio, an original drama screenwriter.

Create a complete first-draft production plan.
Write naturally in ${language}.

USER IDEA:
${idea}

GENRE: ${genre}
VISUAL STYLE: ${style}
TARGET LENGTH: ${minutes} minutes.

Include these sections:

1. TITLE
2. OPENING HOOK
3. STORY SUMMARY
4. CHARACTER BIBLE
   - Name and role
   - Approximate age
   - Face, hair, body and clothing
   - Personality, goal and fear
5. LOCATION AND VISUAL CONTINUITY
6. SCENE-BY-SCENE BREAKDOWN
7. NATURAL DIALOGUE
8. CAMERA DIRECTIONS
9. LIGHTING AND SOUND
10. AI VIDEO PROMPT FOR EACH SCENE
11. NEGATIVE PROMPT
12. ENDING OR CLIFFHANGER

Rules:
- Keep character appearances and clothing consistent.
- Each scene must have a distinct story purpose.
- Avoid repetitive dialogue and meaningless filler.
- Respect the user's original idea.
- For horror, build tension and provide a clear scare or reveal.
- For comedy, make the setup and punchline clear.
- Use correct, natural Filipino when Tagalog is selected.
- Do not claim that a video has been generated.
- This request produces a written plan only.
`;

  const result = await env.AI.run(MODEL, {
    messages: [
      {
        role: "system",
        content: "Create original, coherent drama production plans."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: 3500,
    temperature: 0.65
  });

  const plan = extractText(result);

  if (!plan) {
    return json({
      error: "Walang mabasang text mula sa AI response. Suriin ang Workers AI response format."
    }, 502);
  }

  return json({
    success: true,
    plan,
    model: MODEL,
    durationMinutes: minutes
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "AI Drama Studio",
        model: MODEL
      });
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      try {
        return await handleChat(request, env);
      } catch (error) {
        return json({
          error: errorText(error)
        }, 500);
      }
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Missing static asset configuration.", {
      status: 500
    });
  }
};
